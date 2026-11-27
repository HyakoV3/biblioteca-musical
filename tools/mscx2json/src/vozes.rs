//! Divisão das camadas de uma pauta em vozes pela altura das notas que soam juntas.

use crate::modelo::Evento;
use crate::percurso::Acorde;

/// Em décimos de milésimo de batida: o tempo como inteiro, para comparar sem erro de ponto flutuante.
fn chave(x: f64) -> i64 {
    (x * 10000.0).round() as i64
}

#[derive(Default)]
pub(crate) struct Trilha {
    pub(crate) notas: Vec<Evento>,
    /// Notas ligadas esperando continuação: (midi, índice em `notas`).
    pub(crate) pendentes: Vec<(u8, usize)>,
}

impl Trilha {
    /// Registra uma nota `(midi, termina_ligadura, começa_ligadura)` do acorde: uma nota que termina uma ligadura
    /// alonga a nota pendente de mesma altura, em vez de começar outra.
    pub(crate) fn registrar(&mut self, acorde: &Acorde, nota: (u8, bool, bool)) {
        let (midi, fim_liga, ini_liga) = nota;
        let (inicio, dur) = (acorde.inicio, acorde.dur);
        if fim_liga && let Some(i) = self.pendentes.iter().position(|(m, _)| *m == midi) {
            let (_, idx) = self.pendentes.remove(i);
            self.notas[idx].dur += dur;
            if ini_liga {
                self.pendentes.push((midi, idx));
            }
            return;
        }
        self.notas.push(Evento { inicio, dur, midi });
        if ini_liga {
            self.pendentes.push((midi, self.notas.len() - 1));
        }
    }
}

/// Uma pausa escrita de uma camada que tem notas: (camada, de, até), em décimos de milésimo de batida.
type Pausa = (usize, i64, i64);

/// Um trecho entre dois cortes consecutivos, com as notas que soam nele.
struct Intervalo {
    de: i64,
    ate: i64,
    /// As notas ativas SEM repetir a altura, da mais aguda para a mais grave.
    distintos: Vec<usize>,
    /// TODAS as notas ativas.
    todos: Vec<usize>,
    /// Quantas camadas estão em pausa escrita neste trecho.
    em_pausa: usize,
}

/// As notas de todas as camadas (já com as ligaduras unidas) e as pausas escritas.
struct Camadas {
    eventos: Vec<Evento>,
    pausas: Vec<Pausa>,
}

impl Camadas {
    fn ler(camadas: Vec<Vec<Acorde>>) -> Self {
        let mut lidas = Camadas {
            eventos: vec![],
            pausas: vec![],
        };
        for (c, acordes) in camadas.into_iter().enumerate() {
            let (notas, pausas) = ler_camada(c, &acordes);
            if !notas.is_empty() {
                lidas.pausas.extend(pausas); // camada só de pausas não conta: não tem voz a calar
            }
            lidas.eventos.extend(notas);
        }
        lidas
    }

    /// Os instantes em que alguma nota começa ou termina.
    fn cortes(&self) -> Vec<i64> {
        let mut cortes: Vec<i64> = self
            .eventos
            .iter()
            .flat_map(|e| [chave(e.inicio), chave(e.inicio + e.dur)])
            .collect();
        cortes.sort_unstable();
        cortes.dedup();
        cortes
    }

    fn intervalo(&self, de: i64, ate: i64) -> Option<Intervalo> {
        let eventos = &self.eventos;
        let mut todos: Vec<usize> = (0..eventos.len())
            .filter(|&i| {
                chave(eventos[i].inicio) <= de && chave(eventos[i].inicio + eventos[i].dur) >= ate
            })
            .collect();
        if todos.is_empty() {
            return None;
        }
        todos.sort_by(|&x, &y| eventos[y].midi.cmp(&eventos[x].midi).then(x.cmp(&y)));
        let mut distintos = todos.clone();
        distintos.dedup_by_key(|i| eventos[*i].midi);
        let mut em_pausa: Vec<usize> = self
            .pausas
            .iter()
            .filter(|&&(_, d, a)| d <= de && a >= ate)
            .map(|&(c, _, _)| c)
            .collect();
        em_pausa.sort_unstable();
        em_pausa.dedup();
        Some(Intervalo {
            de,
            ate,
            distintos,
            todos,
            em_pausa: em_pausa.len(),
        })
    }

    fn intervalos(&self) -> Vec<Intervalo> {
        self.cortes()
            .windows(2)
            .filter_map(|w| self.intervalo(w[0], w[1]))
            .collect()
    }
}

/// As notas de UMA camada, com as ligaduras unidas, e as pausas escritas dela.
fn ler_camada(camada: usize, acordes: &[Acorde]) -> (Vec<Evento>, Vec<Pausa>) {
    let mut trilha = Trilha::default();
    let mut pausas = vec![];
    for a in acordes {
        if a.notas.is_empty() {
            pausas.push((camada, chave(a.inicio), chave(a.inicio + a.dur)));
            continue;
        }
        for &nota in &a.notas {
            trilha.registrar(a, nota);
        }
    }
    (trilha.notas, pausas)
}

/// Os dados que não mudam de uma voz para outra.
struct Montador<'a> {
    camadas: &'a Camadas,
    intervalos: &'a [Intervalo],
    /// Quantas vozes saem (já com o limite).
    max: usize,
    /// Quantas vozes o trecho mais cheio tem, sem o limite.
    vozes_total: usize,
}

impl Montador<'_> {
    fn voz(&self, r: usize) -> Vec<Evento> {
        let mut linha = Linha {
            montador: self,
            r,
            eventos: vec![],
            ultimo: None,
        };
        for intervalo in self.intervalos {
            linha.avancar(intervalo);
        }
        linha.eventos
    }
}

/// A voz `r` sendo montada, trecho a trecho.
struct Linha<'a> {
    montador: &'a Montador<'a>,
    r: usize,
    eventos: Vec<Evento>,
    /// (nota de origem, fim) do último trecho em que a voz tocou.
    ultimo: Option<(usize, i64)>,
}

impl Linha<'_> {
    fn avancar(&mut self, iv: &Intervalo) {
        // MUS-003: com camadas em pausa ESCRITA neste trecho, as vozes que passam das notas que soam e dos lugares que as pausas não ocupam ficam
        // em silêncio, em vez de repetirem a nota da outra camada. Sem pausa escrita (a camada nem foi escrita), o uníssono segue repetido nas
        // vozes de baixo. A voz calada é a de baixo: a altura não diz de qual camada era a nota que soa.
        let calada = self.r >= iv.distintos.len()
            && self.r >= self.montador.vozes_total.saturating_sub(iv.em_pausa);
        if calada {
            self.ultimo = None;
            return;
        }
        let id = self.escolher(iv);
        self.acrescentar(iv, id);
    }

    /// Qual das `n` notas distintas do trecho cabe a esta voz.
    fn posicao(&self, n: usize) -> usize {
        let (r, max) = (self.r, self.montador.max);
        if n > max && max > 1 {
            (r * (n - 1) + (max - 1) / 2) / (max - 1)
        } else {
            r.min(n - 1)
        }
    }

    fn escolher(&self, iv: &Intervalo) -> usize {
        let eventos = &self.montador.camadas.eventos;
        let id = iv.distintos[self.posicao(iv.distintos.len())];
        // MSCX-005: de duas notas de mesma altura (camadas em uníssono), vale a que a voz já vinha tocando: trocar de id no meio de uma nota
        // longa a reataca (de `[(0,1,64)]` ficava `[(0,1,64),(1,1,64)]`).
        if let Some((i, fim)) = self.ultimo
            && fim == iv.de
            && eventos[i].midi == eventos[id].midi
            && iv.todos.contains(&i)
        {
            return i;
        }
        id
    }

    fn acrescentar(&mut self, iv: &Intervalo, id: usize) {
        if matches!(self.ultimo, Some((i, fim)) if i == id && fim == iv.de) {
            let e = self.eventos.last_mut().unwrap();
            e.dur = iv.ate as f64 / 10000.0 - e.inicio;
        } else {
            self.eventos.push(Evento {
                inicio: iv.de as f64 / 10000.0,
                dur: (iv.ate - iv.de) as f64 / 10000.0,
                midi: self.montador.camadas.eventos[id].midi,
            });
        }
        self.ultimo = Some((id, iv.ate));
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
    let camadas = Camadas::ler(camadas);
    let intervalos = camadas.intervalos();
    let vozes_total = intervalos
        .iter()
        .map(|i| i.distintos.len())
        .max()
        .unwrap_or(0);
    let mut max = vozes_total;
    let mut omitidos = 0;
    if let Some(l) = limite.filter(|&l| l > 0 && l < max) {
        omitidos = intervalos.iter().filter(|i| i.distintos.len() > l).count();
        max = l;
    }
    let montador = Montador {
        camadas: &camadas,
        intervalos: &intervalos,
        max,
        vozes_total,
    };
    ((0..max).map(|r| montador.voz(r)).collect(), omitidos)
}
