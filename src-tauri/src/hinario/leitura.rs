//! A leitura do `hinario.json` (ver `hinario.rs` e docs/FORMATO.md): confere a versão, as notas, o andamento e as vozes, e descarta os extras malformados.

use super::{Hinario, Hino, Voz, erro};

const VERSAO_SUPORTADA: u32 = 1;
/// Faixa de andamento aceita (batidas por minuto): o conversor (`tools/mscx2json`) confere a mesma.
const ANDAMENTO_MIN: u32 = 20;
const ANDAMENTO_MAX: u32 = 300;

pub fn ler(json: &str) -> Result<Hinario, String> {
    let mut h: Hinario =
        serde_json::from_str(json).map_err(|e| erro("json_invalido", &[e.to_string()]))?;
    if h.versao != VERSAO_SUPORTADA {
        return Err(erro(
            "versao",
            &[h.versao.to_string(), VERSAO_SUPORTADA.to_string()],
        ));
    }
    // PERS-003: faixa inválida recusa o hinário (diferente da sincronia e dos compassos, que são extras): uma nota com tempo negativo ou infinito,
    // duração zero ou negativa, ou MIDI fora de 0 a 127 deixaria o sintetizador agendando lixo, e um andamento fora de 20 a 300 quebraria a conta de tempo.
    for hino in &h.hinos {
        conferir_andamento(hino)?;
        conferir_notas(hino)?;
    }
    // O karaokê e o destaque do compasso na partitura são extras: sincronia e compassos malformados são descartados, sem recusar o hino.
    for hino in &mut h.hinos {
        limpar_extras(hino);
    }
    // O final e a introdução precisam ter as mesmas vozes da passada normal, na mesma ordem (a interface as junta por posição).
    for hino in &h.hinos {
        conferir_vozes(hino)?;
    }
    Ok(h)
}

/// O andamento do hino, quando tem, fica entre `ANDAMENTO_MIN` e `ANDAMENTO_MAX`.
fn conferir_andamento(hino: &Hino) -> Result<(), String> {
    match hino.andamento {
        Some(a) if !(ANDAMENTO_MIN..=ANDAMENTO_MAX).contains(&a) => Err(erro(
            "andamento_invalido",
            &[hino.numero.to_string(), a.to_string()],
        )),
        _ => Ok(()),
    }
}

/// Toda nota das vozes (da passada normal, do final e da introdução) tem tempo, duração e MIDI válidos.
fn conferir_notas(hino: &Hino) -> Result<(), String> {
    let faixas = std::iter::once(&hino.vozes)
        .chain(hino.passada_final.iter().map(|f| &f.vozes))
        .chain(hino.introducao.iter().map(|i| &i.vozes));
    for voz in faixas.flatten() {
        if voz.notas.iter().any(|n| !n.valida()) {
            return Err(erro(
                "nota_invalida",
                &[hino.numero.to_string(), voz.nome.clone()],
            ));
        }
    }
    Ok(())
}

/// Os extras do hino (sincronia, títulos por idioma, compassos): o que vem malformado é descartado.
fn limpar_extras(hino: &mut Hino) {
    if hino.sincronia.as_ref().is_some_and(|s| !s.valida()) {
        hino.sincronia = None;
    }
    limpar_titulos(hino);
    if hino.compassos.as_ref().is_some_and(|c| !c.valida()) {
        hino.compassos = None;
    }
}

/// O final e a introdução, quando existem, têm os mesmos nomes de voz, na mesma ordem, que a passada normal.
fn conferir_vozes(hino: &Hino) -> Result<(), String> {
    if let Some(f) = &hino.passada_final {
        mesmas_vozes("vozes_final", hino, &f.vozes)?;
    }
    if let Some(i) = &hino.introducao {
        mesmas_vozes("vozes_intro", hino, &i.vozes)?;
    }
    Ok(())
}

fn mesmas_vozes(codigo: &str, hino: &Hino, outras: &[Voz]) -> Result<(), String> {
    let normal = nomes_das_vozes(&hino.vozes);
    let outras = nomes_das_vozes(outras);
    if normal == outras {
        return Ok(());
    }
    Err(erro(
        codigo,
        &[
            hino.numero.to_string(),
            outras.join(", "),
            normal.join(", "),
        ],
    ))
}

fn nomes_das_vozes(vozes: &[Voz]) -> Vec<&str> {
    vozes.iter().map(|v| v.nome.as_str()).collect()
}

/// Os idiomas da interface que podem ter título próprio (`titulos`).
const IDIOMAS_DO_TITULO: [&str; 3] = ["pt", "en", "es"];

/// `titulos` é um extra: fica só o que serve (idioma conhecido, texto não vazio) e some se nada sobrar; o hino nunca é recusado por causa dele.
fn limpar_titulos(hino: &mut Hino) {
    if let Some(t) = hino.titulos.as_mut() {
        t.retain(|k, v| IDIOMAS_DO_TITULO.contains(&k.as_str()) && !v.trim().is_empty());
    }
    if hino.titulos.as_ref().is_some_and(|t| t.is_empty()) {
        hino.titulos = None;
    }
}
