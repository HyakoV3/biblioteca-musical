//! Montagem das linhas da letra a partir das sílabas e das respirações.

use crate::conserto::corrigir_silabas;
use crate::coro::{CORO, FINAL};
use crate::modelo::Marca;
use crate::percurso::Silaba;
use crate::versos::{comeca_verso, palavra_a_partir};
use crate::xml::sem_numero_inicial;
use std::collections::BTreeMap;

/// Monta a letra a partir das sílabas, **ordenadas pelo tempo da nota** (e não pela ordem no
/// arquivo, onde as camadas de uma pauta vêm uma depois da outra). Cada estrofe (`<no>`,
/// 0 = primeira) vira uma sequência de linhas, com quebra nas respirações que terminam um VERSO
/// (ver `comeca_verso`). Se a estrofe não tem pelo menos duas respirações seguidas de maiúscula
/// (o autor escreveu tudo em minúscula), não há como distinguir e vale a quebra a cada respiração.
/// Estrofes são separadas por uma linha vazia e a primeira linha de cada uma leva "N. ". Se duas
/// camadas trazem sílaba para o mesmo instante e estrofe, vale a da voz mais alta (menor número).
pub(crate) fn montar_letra(
    mut silabas: Vec<Silaba>,
    mut respiracoes: Vec<f64>,
) -> (Vec<String>, Vec<Marca>) {
    const EPS: f64 = 1e-6;
    silabas.sort_by(|a, b| a.t.total_cmp(&b.t).then(a.voz.cmp(&b.voz)));
    respiracoes.sort_by(|a, b| a.total_cmp(b));
    corrigir_silabas(&mut silabas);

    // Pré-passo: a palavra que cada sílaba abre e, por estrofe, quantas respirações são seguidas de maiúscula. Só com duas ou
    // mais a maiúscula vale como pista de começo de verso.
    let palavras: Vec<String> = (0..silabas.len())
        .map(|i| palavra_a_partir(&silabas, i))
        .collect();
    let mut vistas: BTreeMap<u32, usize> = BTreeMap::new();
    let mut maiusculas: BTreeMap<u32, usize> = BTreeMap::new();
    for (i, sil) in silabas.iter().enumerate() {
        let quebras = respiracoes.iter().filter(|&&r| r <= sil.t + EPS).count();
        let vista = vistas.entry(sil.verso).or_insert(0);
        if quebras > *vista {
            *vista = quebras;
            // Mesma condição de `comeca_verso`, sem a linha anterior (ainda não existe): nome reverencial não é pista.
            if comeca_verso(&palavras[i], "") {
                *maiusculas.entry(sil.verso).or_insert(0) += 1;
            }
        }
    }

    struct Estrofe {
        linhas: Vec<String>,
        espaco: bool,
        quebra_vista: usize,
        ultimo_t: f64,
        ultimo_texto: String,
        ultima_voz: usize,
    }
    let mut estrofes: BTreeMap<u32, Estrofe> = BTreeMap::new();
    let mut marcas: Vec<Marca> = vec![];

    for (i, sil) in silabas.into_iter().enumerate() {
        let e = estrofes.entry(sil.verso).or_insert_with(|| Estrofe {
            linhas: vec![String::new()],
            espaco: false,
            quebra_vista: 0,
            ultimo_t: f64::NEG_INFINITY,
            ultimo_texto: String::new(),
            ultima_voz: usize::MAX,
        });
        // Só é duplicata a MESMA sílaba, no mesmo instante, vinda de OUTRA camada. Duas sílabas diferentes no
        // mesmo instante (ou na mesma camada) são texto de verdade e ficam.
        if (sil.t - e.ultimo_t).abs() < EPS
            && sil.voz != e.ultima_voz
            && sil.texto == e.ultimo_texto
        {
            continue;
        }
        e.ultimo_t = sil.t;
        e.ultimo_texto = sil.texto.clone();
        e.ultima_voz = sil.voz;
        // O autor às vezes escreve o número da estrofe dentro da primeira sílaba ("1. Pa"): o app já numera.
        let primeira = e.linhas.iter().all(|l| l.is_empty());
        let texto = if primeira {
            sem_numero_inicial(&sil.texto)
        } else {
            sil.texto.as_str()
        };
        if texto.is_empty() {
            continue;
        }
        if sil.quebra_antes && !e.linhas.last().is_some_and(|l| l.is_empty()) {
            e.linhas.push(String::new());
            e.espaco = false;
        }
        let quebras = respiracoes.iter().filter(|&&r| r <= sil.t + EPS).count();
        if quebras > e.quebra_vista {
            e.quebra_vista = quebras;
            let regra_do_verso = maiusculas.get(&sil.verso).copied().unwrap_or(0) >= 2;
            let anterior = e.linhas.last().map(String::as_str).unwrap_or("");
            let quebrar = !regra_do_verso || comeca_verso(&palavras[i], anterior);
            if quebrar && !e.linhas.last().is_some_and(|l| l.is_empty()) {
                e.linhas.push(String::new());
                e.espaco = false;
            }
        }
        // Linhas vazias só podem sobrar no fim (uma quebra nunca abre linha sobre linha vazia), então o índice daqui
        // é o mesmo da linha na letra pronta.
        let indice = e.linhas.len() - 1;
        let linha = e.linhas.last_mut().unwrap();
        if e.espaco && !linha.is_empty() {
            linha.push(' ');
        }
        // Posições em unidades UTF-16: é como o JavaScript do app indexa o texto.
        let de = linha.encode_utf16().count();
        linha.push_str(texto);
        marcas.push(Marca {
            verso: sil.verso,
            linha: indice,
            de,
            ate: de + texto.encode_utf16().count(),
            t: sil.t,
        });
        e.espaco = !sil.continua;
    }

    // O coro vem logo depois da primeira estrofe, como no hinário impresso.
    let mut ordem: Vec<(u32, Estrofe)> = estrofes.into_iter().collect();
    if let Some(p) = ordem.iter().position(|(v, _)| *v == CORO) {
        let coro = ordem.remove(p);
        ordem.insert(1.min(ordem.len()), coro);
    }
    let mut saida = vec![];
    for (verso, e) in ordem {
        if !saida.is_empty() {
            saida.push(String::new());
        }
        for (i, l) in e.linhas.into_iter().filter(|l| !l.is_empty()).enumerate() {
            saida.push(if i == 0 && verso == CORO {
                format!("Coro. {l}")
            } else if i == 0 && verso == FINAL {
                format!("Final. {l}")
            } else if i == 0 {
                format!("{}. {l}", verso + 1)
            } else {
                l
            });
        }
    }
    (saida, marcas)
}
