//! Aplicação das correções às sílabas de um hino.

use super::{Acao, Correcao};
use crate::{Silaba, sem_numero_inicial};

const EPS: f64 = 1e-6;

/// A sílaba é a mesma da anterior, só que vinda de outra camada (mesmo instante e mesmo texto).
fn copia_de_outra_camada(a: &Silaba, b: &Silaba) -> bool {
    (a.t - b.t).abs() < EPS && a.voz != b.voz && a.texto == b.texto
}

/// Os índices das sílabas de uma estrofe, em ordem de tempo e sem a cópia da mesma sílaba vinda de outra camada
/// (como `montar_letra` faz).
fn sequencia(silabas: &[Silaba], verso: u32) -> Vec<usize> {
    let mut idx: Vec<usize> = (0..silabas.len())
        .filter(|&i| silabas[i].verso == verso)
        .collect();
    idx.sort_by(|&a, &b| {
        silabas[a]
            .t
            .total_cmp(&silabas[b].t)
            .then(silabas[a].voz.cmp(&silabas[b].voz))
    });
    let mut seq: Vec<usize> = vec![];
    for i in idx {
        if let Some(&u) = seq.last()
            && copia_de_outra_camada(&silabas[i], &silabas[u])
        {
            continue;
        }
        seq.push(i);
    }
    seq
}

/// As sílabas que a correção procura e a descrição dela para o aviso.
fn procurado_e_descricao(acao: &Acao) -> (&[String], String) {
    match acao {
        Acao::Trocar { de, por } => (
            de,
            format!("trocar \"{}\" por \"{}\"", de.join(" "), por.join(" ")),
        ),
        Acao::Juntar(p) => (p, format!("juntar \"{}\"", p.join(" "))),
        Acao::Separar(p) => (p, format!("separar \"{}\"", p.join(" "))),
        Acao::QuebrarAntes(p) => (p, format!("quebrar antes de \"{}\"", p.join(" "))),
    }
}

/// As posições (em `seq`) onde as sílabas procuradas aparecem em sequência.
fn achar(silabas: &[Silaba], seq: &[usize], procurado: &[String]) -> Vec<usize> {
    let n = procurado.len();
    (0..(seq.len() + 1).saturating_sub(n))
        .filter(|&p| {
            (0..n).all(|j| sem_numero_inicial(&silabas[seq[p + j]].texto).trim() == procurado[j])
        })
        .collect()
}

fn ligar(silabas: &mut [Silaba], indices: &[usize], continua: bool) {
    for &i in indices {
        silabas[i].continua = continua;
    }
}

/// Faz a mudança da correção a partir da posição `inicio` de `seq`.
fn efetivar(silabas: &mut [Silaba], seq: &[usize], inicio: usize, acao: &Acao) {
    match acao {
        Acao::Trocar { por, .. } => {
            for (j, texto) in por.iter().enumerate() {
                silabas[seq[inicio + j]].texto = texto.clone();
            }
        }
        Acao::Juntar(p) => ligar(silabas, &seq[inicio..inicio + p.len() - 1], true),
        Acao::Separar(p) => ligar(silabas, &seq[inicio..inicio + p.len() - 1], false),
        Acao::QuebrarAntes(_) => silabas[seq[inicio]].quebra_antes = true,
    }
}

/// Sem `ocorrencia` e com mais de um lugar possível, vale o primeiro e o aviso diz isso.
fn aviso_do_primeiro(c: &Correcao, achados: usize) -> String {
    if c.ocorrencia.is_none() && achados > 1 {
        format!("; havia {achados} lugares e valeu o primeiro (use \"ocorrencia\" para escolher)")
    } else {
        String::new()
    }
}

/// Aplica UMA correção e devolve o aviso dela (aplicada ou não).
fn aplicar_uma(silabas: &mut [Silaba], numero: u32, c: &Correcao) -> String {
    let seq = sequencia(silabas, c.estrofe - 1);
    let (procurado, descricao) = procurado_e_descricao(&c.acao);
    let achados = achar(silabas, &seq, procurado);
    let quem = format!("hino {numero}, estrofe {}", c.estrofe);
    if achados.is_empty() {
        return format!(
            "correção NÃO aplicada ({quem}): não achei as sílabas \"{}\"; confira o texto no arquivo de partitura (é o texto da sílaba, antes de qualquer conserto)",
            procurado.join(" ")
        );
    }
    let escolhida = c.ocorrencia.unwrap_or(1);
    let Some(&inicio) = achados.get(escolhida - 1) else {
        return format!(
            "correção NÃO aplicada ({quem}): pedi a ocorrência {escolhida} de \"{}\", mas há só {}",
            procurado.join(" "),
            achados.len()
        );
    };
    efetivar(silabas, &seq, inicio, &c.acao);
    let extra = aviso_do_primeiro(c, achados.len());
    format!("correção aplicada ({quem}): {descricao}{extra}")
}

/// Aplica as correções de UM hino às sílabas dele e devolve os avisos (um por correção, aplicada ou não). As estrofes são as do
/// arquivo de partitura, antes de qualquer reordenação do conversor; o texto procurado é o da sílaba como está no `.mscx`
/// (sem o "N." do começo da estrofe).
pub fn aplicar(silabas: &mut [Silaba], numero: u32, correcoes: &[Correcao]) -> Vec<String> {
    correcoes
        .iter()
        .map(|c| aplicar_uma(silabas, numero, c))
        .collect()
}
