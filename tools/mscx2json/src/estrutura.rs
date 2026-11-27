//! A estrutura de repetição da partitura e os recortes dela: plano das passadas, compassos e introdução.

use crate::modelo::{Evento, InicioDeCompasso, Voz, arredondar};
use crate::percurso::Acorde;
use roxmltree::Node;

/// Marcas de repetição lidas da primeira pauta (índices de compasso começam em 0).
#[derive(Default)]
pub(crate) struct Estrutura {
    /// Instante, em batidas, em que cada compasso começa; o último valor é o fim da partitura.
    pub(crate) inicios: Vec<f64>,
    pub(crate) inicio_repeticao: Option<usize>,
    pub(crate) fim_repeticao: Option<usize>,
    /// Quantas barras de início e de fim de repetição a partitura tem, e quantos saltos (`Jump`) e marcas (`Marker`): o padrão do final
    /// aceita no máximo uma barra de início, exatamente uma de fim e nenhum salto ou marca.
    pub(crate) barras_de_inicio: usize,
    pub(crate) barras_de_fim: usize,
    pub(crate) saltos: usize,
    /// Casas de volta: (primeiro compasso, compasso onde termina, exclusivo).
    pub(crate) voltas: Vec<(usize, Option<usize>)>,
    pub(crate) ids_volta: Vec<String>,
}

pub(crate) fn registrar_marcas(est: &mut Estrutura, compasso: Node, ci: usize) {
    for n in compasso.descendants() {
        match n.tag_name().name() {
            "startRepeat" => {
                est.inicio_repeticao = Some(ci);
                est.barras_de_inicio += 1;
            }
            "endRepeat" => {
                est.fim_repeticao = Some(ci);
                est.barras_de_fim += 1;
            }
            "Jump" | "Marker" => est.saltos += 1,
            "Volta" => {
                est.voltas.push((ci, None));
                est.ids_volta
                    .push(n.attribute("id").unwrap_or("").to_string());
            }
            // O colchete da volta termina no começo do compasso onde aparece o seu endSpanner.
            "endSpanner" => {
                if let Some(i) = n
                    .attribute("id")
                    .and_then(|id| est.ids_volta.iter().position(|v| v == id))
                {
                    est.voltas[i].1 = Some(ci);
                }
            }
            _ => {}
        }
    }
}

/// Quais compassos (intervalos `[de, até)`) tocam na passada normal e na passada do final.
pub(crate) struct Plano {
    pub(crate) normal: Vec<(usize, usize)>,
    pub(crate) final_: Vec<(usize, usize)>,
    pub(crate) descricao: String,
}

/// Reconhece o padrão dos hinos com final, confirmado pelo responsável no hino 457:
///   início de repetição no começo · compasso com fim de repetição e 1ª casa de volta · 2ª casa de volta
///   logo depois · trecho final até o fim da partitura.
/// Passada normal = do começo até o fim da 1ª casa. Passada do final = do começo até antes da 1ª casa,
/// depois a 2ª casa e tudo o que vem a seguir. Qualquer outra estrutura devolve `None`: mais de uma repetição, salto ou marca (`Jump`,
/// `Marker`) faria o plano ignorar um trecho que a partitura manda tocar.
pub(crate) fn plano_passadas(e: &Estrutura) -> Option<Plano> {
    let n = e.inicios.len().checked_sub(1)?;
    if e.voltas.len() != 2 || e.barras_de_inicio > 1 || e.barras_de_fim != 1 || e.saltos > 0 {
        return None;
    }
    let ((a1, f1), (a2, f2)) = (e.voltas[0], e.voltas[1]);
    let (f1, f2) = (f1?, f2?);
    let fim_rep = e.fim_repeticao?;
    if f1 != a2 || fim_rep + 1 != f1 || f2 > n || e.inicio_repeticao.unwrap_or(0) != 0 {
        return None;
    }
    Some(Plano {
        normal: vec![(0, f1)],
        final_: vec![(0, a1), (a2, n)],
        descricao: format!(
            "passada normal = compassos 1 a {f1}; passada do final = compassos 1 a {a1} e {} a {n}",
            a2 + 1
        ),
    })
}

/// Recorta os acordes que começam em cada intervalo de compassos e os recoloca em sequência, sem buracos.
pub(crate) fn selecionar(
    acordes: &[Acorde],
    inicios: &[f64],
    segmentos: &[(usize, usize)],
) -> Vec<Acorde> {
    const EPS: f64 = 1e-6;
    let mut saida = vec![];
    let mut acumulado = 0.0;
    for &(de, ate) in segmentos {
        let (t0, t1) = (inicios[de], inicios[ate]);
        let primeiro = saida.len();
        for a in acordes
            .iter()
            .filter(|a| a.inicio >= t0 - EPS && a.inicio < t1 - EPS)
        {
            let mut novo = a.clone();
            novo.inicio = a.inicio - t0 + acumulado;
            novo.dur = a.dur.min(t1 - a.inicio);
            saida.push(novo);
        }
        cortar_ligaduras_do_segmento(&mut saida[primeiro..]);
        acumulado += t1 - t0;
    }
    saida
}

/// Uma ligadura que sai do último acorde de um segmento não continua no próximo segmento (que não é o que vem depois na partitura): sem isto, ela
/// engoliria a primeira nota igual do trecho seguinte (a 1ª nota da 2ª casa, por exemplo). Tira a marca de "começa ligadura" das notas cujo acorde
/// seguinte, DENTRO do segmento, não continua a ligadura (ou que não têm acorde seguinte).
pub(crate) fn cortar_ligaduras_do_segmento(acordes: &mut [Acorde]) {
    for i in 0..acordes.len() {
        for k in 0..acordes[i].notas.len() {
            let (midi, _, comeca) = acordes[i].notas[k];
            if !comeca {
                continue;
            }
            let continua = acordes.get(i + 1).is_some_and(|prox| {
                prox.notas
                    .iter()
                    .any(|&(m, termina, _)| m == midi && termina)
            });
            if !continua {
                acordes[i].notas[k].2 = false;
            }
        }
    }
}

/// O instante em que cada compasso dos `segmentos` começa na passada montada por `selecionar`: o mesmo deslocamento de cada intervalo
/// (`inicio - t0 + acumulado`), para o compasso cair exatamente onde as suas notas caem. Os índices são os do compasso ESCRITO.
pub(crate) fn compassos_da_passada(
    inicios: &[f64],
    segmentos: &[(usize, usize)],
) -> Vec<InicioDeCompasso> {
    let mut saida = vec![];
    let mut acumulado = 0.0;
    for &(de, ate) in segmentos {
        let t0 = inicios[de];
        for (i, &inicio) in inicios.iter().enumerate().take(ate).skip(de) {
            saida.push((arredondar(inicio - t0 + acumulado), i));
        }
        acumulado += inicios[ate] - t0;
    }
    saida
}

/// Os compassos da introdução: os que começam antes do marcador `*` (`fim_intro`, em batidas). O compasso que contém o `*` entra, porque
/// começa antes dele. A introdução é o começo da passada normal, então a régua é a mesma.
pub(crate) fn compassos_da_introducao(inicios: &[f64], fim_intro: f64) -> Vec<InicioDeCompasso> {
    const EPS: f64 = 1e-6;
    (0..inicios.len().saturating_sub(1))
        .take_while(|&i| inicios[i] < fim_intro - EPS)
        .map(|i| (arredondar(inicios[i]), i))
        .collect()
}

/// Recorta o começo de cada voz, até `ate` batidas: notas que começam antes entram, e as que atravessam o corte
/// são encurtadas. Devolve `None` se não sobrar nenhuma nota.
pub(crate) fn recortar_inicio(vozes: &[Voz], ate: f64) -> Option<Vec<Voz>> {
    const EPS: f64 = 1e-6;
    let recorte: Vec<Voz> = vozes
        .iter()
        .map(|v| Voz {
            nome: v.nome.clone(),
            notas: v
                .notas
                .iter()
                .filter(|n| n.inicio < ate - EPS)
                .map(|n| Evento {
                    inicio: n.inicio,
                    dur: n.dur.min(ate - n.inicio),
                    midi: n.midi,
                })
                .collect(),
        })
        .collect();
    recorte
        .iter()
        .any(|v| !v.notas.is_empty())
        .then_some(recorte)
}
