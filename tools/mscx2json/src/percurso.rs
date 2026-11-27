//! O percurso dos elementos de um compasso: acordes, pausas, sílabas, respirações e marcadores de introdução.

use crate::coro::FINAL;
use crate::xml::{
    duracao, e_apojatura, filho, liga_fim, liga_inicio, numero, texto, texto_completo,
};
use roxmltree::Node;
use std::collections::BTreeMap;

/// Um acorde lido da partitura: notas como (midi, termina_ligadura, começa_ligadura). Sem notas, é uma PAUSA escrita da camada.
#[derive(Clone)]
pub(crate) struct Acorde {
    pub(crate) inicio: f64,
    pub(crate) dur: f64,
    pub(crate) notas: Vec<(u8, bool, bool)>,
}

/// Sílaba da letra com o instante (em batidas) da nota a que pertence.
#[derive(Clone)]
pub(crate) struct Silaba {
    pub(crate) t: f64,
    pub(crate) voz: usize,
    pub(crate) verso: u32,
    pub(crate) continua: bool, // "begin"/"middle": a palavra segue na próxima sílaba
    pub(crate) quebra_antes: bool, // pedido no arquivo de correções: começa uma linha nova aqui (dois versos colados)
    pub(crate) texto: String,
}

pub(crate) struct Estado<'a> {
    pub(crate) andamento: Option<u32>,
    pub(crate) tuplos: Vec<f64>,
    pub(crate) compasso: f64,
    /// MuseScore 2: vozes soltas no compasso, separadas por <tick> e <track>.
    pub(crate) plano: bool,
    /// Voz de quem está sendo lido (ignorado quando `plano`).
    pub(crate) voz_base: usize,
    /// Ticks por semínima (<Division>).
    pub(crate) divisao: f64,
    /// Acordes por voz da pauta atual.
    pub(crate) saida: &'a mut BTreeMap<usize, Vec<Acorde>>,
    /// Sílabas e respirações (instantes) da pauta atual.
    pub(crate) silabas: &'a mut Vec<Silaba>,
    pub(crate) respiracoes: &'a mut Vec<f64>,
    /// Instantes (em batidas) em que a introdução termina: o fim do acorde (ou da pausa) que leva o texto de pauta "*". O "*" é escrito sobre a
    /// ÚLTIMA nota da introdução, que o autor fecha com a respiração (em 413 dos 480 hinos do Dó vem "*", acorde, respiração): a introdução vai até o
    /// fim dessa nota, e não até o começo dela.
    pub(crate) asteriscos: &'a mut Vec<f64>,
    /// Posições, em `asteriscos`, dos "*" que ainda esperam o acorde ou a pausa que marcam. É uma lista (pode haver mais de um "*" antes da mesma nota,
    /// por exemplo um texto de pauta e uma cifra). Vale só dentro do compasso e da voz: um "*" que fica sem nota depois dele (no fim do compasso) marca o fim
    /// da nota anterior, que é o instante em que foi lido.
    pub(crate) asteriscos_pendentes: &'a mut Vec<usize>,
}

pub(crate) fn voz_do(c: Node, est: &Estado) -> usize {
    if est.plano {
        numero::<usize>(c, "track").map_or(0, |t| t % 4)
    } else {
        est.voz_base
    }
}

/// Uma respiração em `t` fecha os "*" que esperavam uma nota e não tiveram nenhuma antes dela: a introdução termina onde a respiração está.
pub(crate) fn fecha_asteriscos_na_respiracao(
    asteriscos: &mut [f64],
    pendentes: &mut Vec<usize>,
    t: f64,
) {
    pendentes.retain(|&i| {
        if asteriscos[i] <= t + 1e-6 {
            asteriscos[i] = t;
            false
        } else {
            true
        }
    });
}

/// O "*" marca a nota que o segue: a introdução termina no fim dela. `inicio` e `fim` são os da nota que acabou de ser lida, em batidas. Fecha TODOS os "*"
/// pendentes que estão no começo dessa nota ou antes dele; um "*" depois do começo da nota (a nota é de outra voz, que começa antes) continua esperando.
pub(crate) fn fecha_asterisco(est: &mut Estado, inicio: f64, fim: f64) {
    let asteriscos = &mut *est.asteriscos;
    est.asteriscos_pendentes.retain(|&i| {
        if inicio >= asteriscos[i] - 1e-6 {
            asteriscos[i] = fim;
            false
        } else {
            true
        }
    });
}

pub(crate) fn percorrer(no: Node, t: &mut f64, est: &mut Estado) -> Result<(), String> {
    for c in no.children().filter(|c| c.is_element()) {
        match c.tag_name().name() {
            "Tempo" if est.andamento.is_none() => {
                if let Some(v) = numero::<f64>(c, "tempo") {
                    est.andamento = Some((v * 60.0).round() as u32);
                }
            }
            "Tuplet" => {
                let normal: f64 = numero(c, "normalNotes").unwrap_or(2.0);
                let real: f64 = numero(c, "actualNotes").unwrap_or(3.0);
                est.tuplos.push(normal / real);
                // Formato aninhado: os acordes ficam dentro de <Tuplet>.
                if c.children()
                    .any(|x| x.has_tag_name("Chord") || x.has_tag_name("Rest"))
                {
                    percorrer(c, t, est)?;
                    est.tuplos.pop();
                }
            }
            "tick" if est.plano => {
                if let Some(v) = c.text().and_then(|x| x.trim().parse::<f64>().ok()) {
                    *t = v / est.divisao;
                }
            }
            "Breath" => {
                est.respiracoes.push(*t);
                // "*" logo antes da respiração, sem nota no meio: a introdução termina onde a respiração está (no 250, o "*" fica em 11 e a respiração em 12,
                // depois de um `tick`; parar no "*" deixava uma batida de fora).
                fecha_asteriscos_na_respiracao(est.asteriscos, est.asteriscos_pendentes, *t);
            }
            // O "*" aparece como texto de pauta (<StaffText><text>) ou como cifra (<Harmony><name>), conforme a partitura.
            "StaffText" | "Harmony" => {
                let rotulo = if c.has_tag_name("Harmony") {
                    "name"
                } else {
                    "text"
                };
                if filho(c, rotulo)
                    .map(texto_completo)
                    .as_deref()
                    .map(str::trim)
                    == Some("*")
                {
                    est.asteriscos.push(*t); // provisório: vira o fim da nota que vem a seguir (ver `fecha_asterisco`)
                    est.asteriscos_pendentes.push(est.asteriscos.len() - 1);
                }
            }
            "endTuplet" => {
                est.tuplos.pop();
            }
            "Rest" => {
                let dur = duracao(c, est.compasso)? * est.tuplos.iter().product::<f64>();
                fecha_asterisco(est, *t, *t + dur);
                // MUS-003: a pausa escrita fica registrada como um acorde SEM notas. Quem divide as camadas em vozes (`dividir_em_vozes`) a usa para
                // não repetir a nota da outra camada na voz que a partitura manda calar.
                let voz = voz_do(c, est);
                est.saida.entry(voz).or_default().push(Acorde {
                    inicio: *t,
                    dur,
                    notas: vec![],
                });
                *t += dur;
            }
            "Chord" => {
                if e_apojatura(c) {
                    continue;
                }
                let dur = duracao(c, est.compasso)? * est.tuplos.iter().product::<f64>();
                fecha_asterisco(est, *t, *t + dur);
                let mut notas = vec![];
                for nota in c.children().filter(|n| n.has_tag_name("Note")) {
                    if texto(nota, "play") == Some("0") {
                        continue;
                    }
                    let midi: u8 = numero(nota, "pitch").ok_or("nota sem <pitch> válido")?;
                    notas.push((midi, liga_fim(nota), liga_inicio(nota)));
                }
                let voz = voz_do(c, est);
                for l in c.children().filter(|x| x.has_tag_name("Lyrics")) {
                    let sil = filho(l, "text")
                        .map(texto_completo)
                        .filter(|t| !t.is_empty());
                    if let Some(sil) = sil {
                        est.silabas.push(Silaba {
                            t: *t,
                            voz,
                            verso: numero(l, "no").filter(|&v| v < FINAL).unwrap_or(0),
                            continua: matches!(texto(l, "syllabic"), Some("begin" | "middle")),
                            quebra_antes: false,
                            texto: sil,
                        });
                    }
                }
                if !notas.is_empty() {
                    est.saida.entry(voz).or_default().push(Acorde {
                        inicio: *t,
                        dur,
                        notas,
                    });
                }
                *t += dur;
            }
            _ => {}
        }
    }
    Ok(())
}
