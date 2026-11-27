//! Separação do coro, do final e do refrão com estrofe trocada nas sílabas da letra.

use crate::percurso::Silaba;
use std::collections::{BTreeMap, BTreeSet};

const EPS: f64 = 1e-6;

/// Marcador interno do coro (refrão): não é número de estrofe. Na letra vira o parágrafo "Coro. ..." e na sincronia, a estrofe 0.
pub(crate) const CORO: u32 = u32::MAX - 1;
/// Marcador interno do final (o texto cantado só na última vez, num hino com final): na letra vira o parágrafo "Final. ..." depois da última
/// estrofe e, na sincronia, a estrofe 0 (um hino não tem coro e final juntos: o coro do hino com final é o próprio final).
pub(crate) const FINAL: u32 = u32::MAX - 2;
/// Com menos sílabas que isto depois das estrofes, o resto não é refrão: é o fim de uma estrofe escrito só uma vez (hinos 61, 62, 189...).
pub(crate) const SILABAS_MINIMAS_DO_CORO: usize = 6;

fn com_letra(s: &Silaba) -> bool {
    s.texto.chars().any(char::is_alphabetic)
}

/// O instante da última sílaba da estrofe `verso`.
fn fim_da_estrofe(silabas: &[Silaba], verso: u32) -> f64 {
    silabas
        .iter()
        .filter(|s| s.verso == verso)
        .map(|s| s.t)
        .fold(f64::NEG_INFINITY, f64::max)
}

/// Num hino com final, o texto do trecho final (cantado só na última vez, depois da última estrofe) costuma vir escrito pelo
/// autor sob a estrofe 1, que é a camada que ele já tinha aberta. No hinário impresso ele vem DEPOIS da última estrofe, em bloco à parte.
/// `t_final` é o início da 2ª casa, e a 2ª casa também traz o FIM da última estrofe (a última palavra, por exemplo), que o autor também pode ter escrito
/// sob a estrofe 1. Então, do que está sob uma estrofe que não é a última a partir de `t_final`: o que cai até a última sílaba da própria última estrofe
/// passa para ela (é o fecho dela); o que vem depois vira o bloco FINAL, logo depois da última estrofe.
/// Só se mexe quando esse texto está todo sob UMA estrofe: com mais de uma, não há como saber a qual cada trecho pertence. Devolve quantas sílabas viraram o final.
pub(crate) fn separar_o_final(silabas: &mut [Silaba], t_final: f64) -> usize {
    let Some(ultima) = silabas.iter().map(|s| s.verso).max() else {
        return 0;
    };
    let da_segunda_casa = |s: &Silaba| s.t >= t_final - EPS && s.verso != ultima;
    let origem: BTreeSet<u32> = silabas
        .iter()
        .filter(|s| da_segunda_casa(s))
        .map(|s| s.verso)
        .collect();
    if origem.len() != 1 {
        return 0;
    }
    // a última sílaba da própria última estrofe: até ela o texto da 2ª casa é o fecho dessa estrofe
    let fim_da_ultima = fim_da_estrofe(silabas, ultima);
    let mut no_final = 0;
    for sil in silabas.iter_mut().filter(|s| da_segunda_casa(s)) {
        let vira_final = sil.t > fim_da_ultima + EPS;
        sil.verso = if vira_final { FINAL } else { ultima };
        no_final += usize::from(vira_final);
    }
    no_final
}

/// O último instante em que mais de uma estrofe canta ao mesmo tempo (`None` se nunca). Depois dele não há mais estrofes: o que
/// sobra é refrão. Sílaba sem nenhuma letra (um "'" solto, por exemplo) não conta como estrofe cantando.
pub(crate) fn ultimo_instante_com_estrofes_juntas(silabas: &[Silaba]) -> Option<f64> {
    let com_letra = |s: &&Silaba| com_letra(s);
    silabas
        .iter()
        .filter(com_letra)
        .filter(|a| {
            silabas
                .iter()
                .filter(com_letra)
                .any(|b| b.verso != a.verso && (a.t - b.t).abs() < EPS)
        })
        .map(|s| s.t)
        .fold(None, |m: Option<f64>, t| Some(m.map_or(t, |x| x.max(t))))
}

/// A estrofe dona do resto cantado depois de `corte`, se esse resto é um coro: sílabas bastantes, todas sob UMA estrofe
/// e que não é a de maior número (aí seria só a última estrofe, mais longa que as outras).
fn dona_do_resto(silabas: &[Silaba], corte: f64) -> Option<u32> {
    let do_resto = |s: &&Silaba| s.t > corte + EPS && com_letra(s);
    // A mesma sílaba escrita em duas vozes (mesmo instante e texto) conta uma vez só, como na letra pronta.
    let cauda: BTreeSet<(u64, &str)> = silabas
        .iter()
        .filter(do_resto)
        .map(|s| (s.t.to_bits(), s.texto.as_str()))
        .collect();
    if cauda.len() < SILABAS_MINIMAS_DO_CORO {
        return None;
    }
    let donos: BTreeSet<u32> = silabas.iter().filter(do_resto).map(|s| s.verso).collect();
    let maior = silabas
        .iter()
        .filter(|s| com_letra(s))
        .map(|s| s.verso)
        .max();
    let dono = donos.first().copied();
    if donos.len() != 1 || dono == maior {
        return None;
    }
    dono
}

/// O instante em que o coro começa na estrofe `dono`: o primeiro depois de `corte`, ou o seguinte se o corte cai no meio de uma palavra
/// (a sílaba anterior "continua": o pedaço que falta fica na estrofe).
fn instante_do_coro(silabas: &[Silaba], dono: u32, corte: f64) -> Option<f64> {
    let mut daestrofe: Vec<usize> = (0..silabas.len())
        .filter(|&i| silabas[i].verso == dono && com_letra(&silabas[i]))
        .collect();
    daestrofe.sort_by(|&a, &b| silabas[a].t.total_cmp(&silabas[b].t));
    let mut inicio = daestrofe.iter().position(|&i| silabas[i].t > corte + EPS);
    while let Some(k) = inicio {
        if k == 0 || !silabas[daestrofe[k - 1]].continua {
            break;
        }
        inicio = (k + 1 < daestrofe.len()).then_some(k + 1);
    }
    inicio.map(|k| silabas[daestrofe[k]].t)
}

/// Separa o refrão: tudo o que é cantado depois do último instante com estrofes juntas vira o **coro**, um bloco à parte da
/// estrofe 1, como no hinário impresso. Só vale com pelo menos `SILABAS_MINIMAS_DO_CORO` sílabas com letra. Devolve quantas.
pub(crate) fn separar_o_coro(silabas: &mut [Silaba]) -> usize {
    let Some(corte) = ultimo_instante_com_estrofes_juntas(silabas) else {
        return 0;
    };
    let Some(dono) = dona_do_resto(silabas, corte) else {
        return 0;
    };
    let Some(t_inicio) = instante_do_coro(silabas, dono, corte) else {
        return 0;
    };
    let n = silabas
        .iter()
        .filter(|s| s.t >= t_inicio - EPS && s.verso == dono && com_letra(s))
        .count();
    if n < SILABAS_MINIMAS_DO_CORO {
        return 0;
    }
    for s in silabas.iter_mut().filter(|s| s.t >= t_inicio - EPS) {
        s.verso = CORO;
    }
    n
}

/// Quantas sílabas com letra cada estrofe tem depois de `corte`.
fn contar_o_resto(silabas: &[Silaba], corte: f64) -> BTreeMap<u32, usize> {
    let mut contagem: BTreeMap<u32, usize> = BTreeMap::new();
    for s in silabas.iter().filter(|s| s.t > corte + EPS && com_letra(s)) {
        *contagem.entry(s.verso).or_insert(0) += 1;
    }
    contagem
}

/// Refrão (coro) escrito depois das estrofes, numa camada só, mas com o número de estrofe errado nas primeiras sílabas (visto nos hinos
/// 5, 7, 10, 16 e 28 do hinário 5: "A Ro cha" marcado como estrofe 2 e o resto do refrão como estrofe 1). Depois do ÚLTIMO instante em
/// que mais de uma estrofe canta ao mesmo tempo, não há mais estrofes: o que sobra é refrão e é de uma estrofe só. Se esse resto
/// aparece com mais de um número de estrofe, todo ele passa para o que tem mais sílabas (empate: o menor número). Se o resto já está
/// sob uma estrofe só, ou se não há instante com estrofes juntas, nada muda. Devolve quantas sílabas mudaram de estrofe.
pub(crate) fn refrao_com_estrofe_trocada(silabas: &mut [Silaba]) -> usize {
    let Some(corte) = ultimo_instante_com_estrofes_juntas(silabas) else {
        return 0;
    };
    let contagem = contar_o_resto(silabas, corte);
    if contagem.len() < 2 {
        return 0;
    }
    let (alvo, _) = contagem.iter().fold(
        (0, 0),
        |(av, ac), (&v, &c)| if c > ac { (v, c) } else { (av, ac) },
    );
    let mut mudaram = 0;
    for s in silabas
        .iter_mut()
        .filter(|s| s.t > corte + EPS && s.verso != alvo)
    {
        s.verso = alvo;
        mudaram += 1;
    }
    mudaram
}

/// A letra de uma partitura sem o plano de final: o refrão com estrofe trocada e o coro depois das estrofes, cada um com o seu aviso.
pub(crate) fn separar_sem_plano(silabas: &mut [Silaba], avisos: &mut Vec<String>) {
    let n = refrao_com_estrofe_trocada(silabas);
    let coro = separar_o_coro(silabas);
    if coro > 0 {
        avisos.push(format!(
            "coro separado: {coro} sílabas depois das estrofes viraram o bloco \"Coro\""
        ));
    }
    if n > 0 && coro == 0 {
        avisos.push(format!(
            "refrão com estrofe trocada: {n} sílabas do refrão (depois das estrofes) passaram para a estrofe do restante do refrão"
        ));
    }
}
