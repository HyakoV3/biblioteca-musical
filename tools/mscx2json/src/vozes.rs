//! Divisão das camadas de uma pauta em vozes pela altura das notas que soam juntas.

use crate::modelo::Evento;
use crate::percurso::Acorde;

#[derive(Default)]
pub(crate) struct Trilha {
    pub(crate) notas: Vec<Evento>,
    /// Notas ligadas esperando continuação: (midi, índice em `notas`).
    pub(crate) pendentes: Vec<(u8, usize)>,
}

pub(crate) fn registrar(
    tr: &mut Trilha,
    inicio: f64,
    dur: f64,
    midi: u8,
    fim_liga: bool,
    ini_liga: bool,
) {
    if fim_liga && let Some(i) = tr.pendentes.iter().position(|(m, _)| *m == midi) {
        let (_, idx) = tr.pendentes.remove(i);
        tr.notas[idx].dur += dur;
        if ini_liga {
            tr.pendentes.push((midi, idx));
        }
        return;
    }
    tr.notas.push(Evento { inicio, dur, midi });
    if ini_liga {
        tr.pendentes.push((midi, tr.notas.len() - 1));
    }
}

/// Junta as camadas de uma pauta e separa em vozes pela altura das notas que soam juntas:
/// a mais aguda é a voz 1, a mais grave a última. Se só uma nota soa, ela é repetida nas
/// demais vozes (uníssono). Uma nota longa continua sendo uma nota só enquanto ficar na
/// mesma voz. Com `limite`, nos trechos com mais notas que vozes ficam a mais aguda, a mais
/// grave e (se couberem) as intermediárias mais próximas; devolve também quantos trechos
/// tiveram notas omitidas.
pub(crate) fn dividir_em_vozes(
    camadas: Vec<Vec<Acorde>>,
    limite: Option<usize>,
) -> (Vec<Vec<Evento>>, usize) {
    let chave = |x: f64| (x * 10000.0).round() as i64;
    let mut eventos: Vec<Evento> = vec![];
    // As pausas escritas de cada camada que tem notas (camada, de, até), em décimos de milésimo de batida.
    let mut pausas: Vec<(usize, i64, i64)> = vec![];
    for (c, acordes) in camadas.into_iter().enumerate() {
        let mut tr = Trilha::default();
        let mut pausas_da_camada = vec![];
        for a in &acordes {
            if a.notas.is_empty() {
                pausas_da_camada.push((c, chave(a.inicio), chave(a.inicio + a.dur)));
                continue;
            }
            for &(midi, fim, ini) in &a.notas {
                registrar(&mut tr, a.inicio, a.dur, midi, fim, ini);
            }
        }
        if !tr.notas.is_empty() {
            pausas.extend(pausas_da_camada); // camada só de pausas não conta: não tem voz a calar
        }
        eventos.extend(tr.notas);
    }
    let mut cortes: Vec<i64> = eventos
        .iter()
        .flat_map(|e| [chave(e.inicio), chave(e.inicio + e.dur)])
        .collect();
    cortes.sort_unstable();
    cortes.dedup();

    // Por intervalo: (início, fim, notas ativas SEM repetir a altura, TODAS as ativas, camadas em pausa escrita).
    type Intervalo = (i64, i64, Vec<usize>, Vec<usize>, usize);
    let mut intervalos: Vec<Intervalo> = vec![];
    for w in cortes.windows(2) {
        let (a, b) = (w[0], w[1]);
        let mut todos: Vec<usize> = (0..eventos.len())
            .filter(|&i| {
                chave(eventos[i].inicio) <= a && chave(eventos[i].inicio + eventos[i].dur) >= b
            })
            .collect();
        if todos.is_empty() {
            continue;
        }
        todos.sort_by(|&x, &y| eventos[y].midi.cmp(&eventos[x].midi).then(x.cmp(&y)));
        let mut distintos = todos.clone();
        distintos.dedup_by_key(|i| eventos[*i].midi);
        let mut em_pausa: Vec<usize> = pausas
            .iter()
            .filter(|&&(_, de, ate)| de <= a && ate >= b)
            .map(|&(c, _, _)| c)
            .collect();
        em_pausa.sort_unstable();
        em_pausa.dedup();
        intervalos.push((a, b, distintos, todos, em_pausa.len()));
    }

    let mut max = intervalos.iter().map(|i| i.2.len()).max().unwrap_or(0);
    let vozes_total = max;
    let mut omitidos = 0;
    if let Some(l) = limite.filter(|&l| l > 0 && l < max) {
        omitidos = intervalos.iter().filter(|i| i.2.len() > l).count();
        max = l;
    }
    let mut saida = vec![];
    for r in 0..max {
        let mut evs: Vec<Evento> = vec![];
        let mut ultimo: Option<(usize, i64)> = None; // (nota de origem, fim)
        for (a, b, ativos, todos, em_pausa) in &intervalos {
            let n = ativos.len();
            // MUS-003: com camadas em pausa ESCRITA neste trecho, as vozes que passam das notas que soam e dos lugares que as pausas não ocupam ficam
            // em silêncio, em vez de repetirem a nota da outra camada. Sem pausa escrita (a camada nem foi escrita), o uníssono segue repetido nas
            // vozes de baixo. A voz calada é a de baixo: a altura não diz de qual camada era a nota que soa.
            if r >= n && r >= vozes_total.saturating_sub(*em_pausa) {
                ultimo = None;
                continue;
            }
            let pos = if n > max && max > 1 {
                (r * (n - 1) + (max - 1) / 2) / (max - 1)
            } else {
                r.min(n - 1)
            };
            let mut id = ativos[pos];
            // MSCX-005: de duas notas de mesma altura (camadas em uníssono), vale a que a voz já vinha tocando: trocar de id no meio de uma nota
            // longa a reataca (de `[(0,1,64)]` ficava `[(0,1,64),(1,1,64)]`).
            if let Some((i, fim)) = ultimo
                && fim == *a
                && eventos[i].midi == eventos[id].midi
                && todos.contains(&i)
            {
                id = i;
            }
            if matches!(ultimo, Some((i, fim)) if i == id && fim == *a) {
                let e = evs.last_mut().unwrap();
                e.dur = *b as f64 / 10000.0 - e.inicio;
            } else {
                evs.push(Evento {
                    inicio: *a as f64 / 10000.0,
                    dur: (*b - *a) as f64 / 10000.0,
                    midi: eventos[id].midi,
                });
            }
            ultimo = Some((id, *b));
        }
        saida.push(evs);
    }
    (saida, omitidos)
}
