//! Montagem das linhas da letra a partir das sílabas e das respirações.

use crate::conserto::corrigir_silabas;
use crate::coro::{CORO, FINAL};
use crate::modelo::Marca;
use crate::percurso::Silaba;
use crate::versos::{comeca_verso, palavra_a_partir};
use crate::xml::sem_numero_inicial;
use std::collections::BTreeMap;

const EPS: f64 = 1e-6;

/// Quantas respirações já aconteceram até o instante `t`.
fn quebras_ate(respiracoes: &[f64], t: f64) -> usize {
    respiracoes.iter().filter(|&&r| r <= t + EPS).count()
}

/// Por estrofe, quantas respirações são seguidas de maiúscula (a palavra que cada sílaba abre está em `palavras`). Só com duas
/// ou mais a maiúscula vale como pista de começo de verso.
fn contar_maiusculas(
    silabas: &[Silaba],
    palavras: &[String],
    respiracoes: &[f64],
) -> BTreeMap<u32, usize> {
    let mut vistas: BTreeMap<u32, usize> = BTreeMap::new();
    let mut maiusculas: BTreeMap<u32, usize> = BTreeMap::new();
    for (i, sil) in silabas.iter().enumerate() {
        let quebras = quebras_ate(respiracoes, sil.t);
        let vista = vistas.entry(sil.verso).or_insert(0);
        if quebras > *vista {
            *vista = quebras;
            // Mesma condição de `comeca_verso`, sem a linha anterior (ainda não existe): nome reverencial não é pista.
            if comeca_verso(&palavras[i], "") {
                *maiusculas.entry(sil.verso).or_insert(0) += 1;
            }
        }
    }
    maiusculas
}

/// Uma estrofe sendo montada, linha a linha.
struct Estrofe {
    linhas: Vec<String>,
    espaco: bool,
    quebra_vista: usize,
    ultimo_t: f64,
    ultimo_texto: String,
    ultima_voz: usize,
}

impl Estrofe {
    fn nova() -> Self {
        Estrofe {
            linhas: vec![String::new()],
            espaco: false,
            quebra_vista: 0,
            ultimo_t: f64::NEG_INFINITY,
            ultimo_texto: String::new(),
            ultima_voz: usize::MAX,
        }
    }

    /// Só é duplicata a MESMA sílaba, no mesmo instante, vinda de OUTRA camada. Duas sílabas diferentes no
    /// mesmo instante (ou na mesma camada) são texto de verdade e ficam.
    fn e_duplicata(&self, sil: &Silaba) -> bool {
        (sil.t - self.ultimo_t).abs() < EPS
            && sil.voz != self.ultima_voz
            && sil.texto == self.ultimo_texto
    }

    fn lembrar(&mut self, sil: &Silaba) {
        self.ultimo_t = sil.t;
        self.ultimo_texto = sil.texto.clone();
        self.ultima_voz = sil.voz;
    }

    fn ultima_linha(&self) -> &str {
        self.linhas.last().map(String::as_str).unwrap_or("")
    }

    /// Abre uma linha nova, a não ser que a última ainda esteja vazia.
    fn quebrar_linha(&mut self) {
        if !self.linhas.last().is_some_and(|l| l.is_empty()) {
            self.linhas.push(String::new());
            self.espaco = false;
        }
    }

    /// Escreve o texto da sílaba na última linha e devolve a marca dele.
    fn escrever(&mut self, texto: &str, sil: &Silaba) -> Marca {
        // Linhas vazias só podem sobrar no fim (uma quebra nunca abre linha sobre linha vazia), então o índice daqui
        // é o mesmo da linha na letra pronta.
        let indice = self.linhas.len() - 1;
        let espaco = self.espaco;
        let linha = self.linhas.last_mut().unwrap();
        if espaco && !linha.is_empty() {
            linha.push(' ');
        }
        // Posições em unidades UTF-16: é como o JavaScript do app indexa o texto.
        let de = linha.encode_utf16().count();
        linha.push_str(texto);
        self.espaco = !sil.continua;
        Marca {
            verso: sil.verso,
            linha: indice,
            de,
            ate: de + texto.encode_utf16().count(),
            t: sil.t,
        }
    }
}

/// A letra sendo montada: o que não muda (respirações, palavras, pistas de maiúscula) e o que vai crescendo (estrofes, marcas).
struct Letra<'a> {
    respiracoes: &'a [f64],
    palavras: &'a [String],
    maiusculas: BTreeMap<u32, usize>,
    estrofes: BTreeMap<u32, Estrofe>,
    marcas: Vec<Marca>,
}

impl Letra<'_> {
    /// Põe a sílaba `i` (as sílabas vêm ordenadas pelo tempo) na estrofe dela.
    fn acrescentar(&mut self, i: usize, sil: &Silaba) {
        let e = self.estrofes.entry(sil.verso).or_insert_with(Estrofe::nova);
        if e.e_duplicata(sil) {
            return;
        }
        e.lembrar(sil);
        // O autor às vezes escreve o número da estrofe dentro da primeira sílaba ("1. Pa"): o app já numera.
        let primeira = e.linhas.iter().all(|l| l.is_empty());
        let texto = if primeira {
            sem_numero_inicial(&sil.texto)
        } else {
            sil.texto.as_str()
        };
        if texto.is_empty() {
            return;
        }
        if sil.quebra_antes {
            e.quebrar_linha();
        }
        let quebras = quebras_ate(self.respiracoes, sil.t);
        if quebras > e.quebra_vista {
            e.quebra_vista = quebras;
            let regra_do_verso = self.maiusculas.get(&sil.verso).copied().unwrap_or(0) >= 2;
            if !regra_do_verso || comeca_verso(&self.palavras[i], e.ultima_linha()) {
                e.quebrar_linha();
            }
        }
        self.marcas.push(e.escrever(texto, sil));
    }
}

/// O texto de cada linha da estrofe: a primeira leva o rótulo ("Coro. ", "Final. " ou "N. ") e as linhas vazias saem.
fn rotular(verso: u32, linhas: Vec<String>) -> Vec<String> {
    linhas
        .into_iter()
        .filter(|l| !l.is_empty())
        .enumerate()
        .map(|(i, l)| match (i, verso) {
            (0, CORO) => format!("Coro. {l}"),
            (0, FINAL) => format!("Final. {l}"),
            (0, _) => format!("{}. {l}", verso + 1),
            _ => l,
        })
        .collect()
}

/// As linhas da letra pronta: estrofes separadas por uma linha vazia e o coro logo depois da primeira, como no hinário impresso.
fn juntar_estrofes(estrofes: BTreeMap<u32, Estrofe>) -> Vec<String> {
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
        saida.extend(rotular(verso, e.linhas));
    }
    saida
}

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
    silabas.sort_by(|a, b| a.t.total_cmp(&b.t).then(a.voz.cmp(&b.voz)));
    respiracoes.sort_by(|a, b| a.total_cmp(b));
    corrigir_silabas(&mut silabas);

    // Pré-passo: a palavra que cada sílaba abre e, por estrofe, quantas respirações são seguidas de maiúscula.
    let palavras: Vec<String> = (0..silabas.len())
        .map(|i| palavra_a_partir(&silabas, i))
        .collect();
    let maiusculas = contar_maiusculas(&silabas, &palavras, &respiracoes);
    let mut letra = Letra {
        respiracoes: &respiracoes,
        palavras: &palavras,
        maiusculas,
        estrofes: BTreeMap::new(),
        marcas: vec![],
    };
    for (i, sil) in silabas.iter().enumerate() {
        letra.acrescentar(i, sil);
    }
    (juntar_estrofes(letra.estrofes), letra.marcas)
}
