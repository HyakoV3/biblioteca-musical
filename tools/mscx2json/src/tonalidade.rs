//! Armadura, modo e nome da tonalidade.

use crate::modelo::Voz;
use crate::xml::{filho, texto};
use roxmltree::Document;

/// Armadura e modo escrito (se houver) do primeiro `KeySig` da partitura. MuseScore 2 e 3 gravam `<accidental>`; o 4 pode gravar
/// `<concertKey>` e `<mode>` (não confirmado: aceita o que existir). Modulações no meio da peça são ignoradas.
pub(crate) fn ler_armadura(doc: &Document) -> (i8, Option<&'static str>, Option<String>) {
    let Some(ks) = doc.descendants().find(|n| n.has_tag_name("KeySig")) else {
        return (0, None, None);
    };
    let modo = match texto(ks, "mode")
        .map(|m| m.trim().to_lowercase())
        .as_deref()
    {
        Some("major" | "maior" | "ionian") => Some("maior"),
        Some("minor" | "menor" | "aeolian") => Some("menor"),
        _ => None,
    };
    // Sem o número, a armadura é 0 (o MuseScore pode omitir o 0); com o número inválido, vira 0 COM aviso.
    let bruto = ["accidental", "concertKey"]
        .iter()
        .find_map(|n| filho(ks, n).and_then(|x| x.text()).map(str::trim));
    let Some(bruto) = bruto else {
        return (0, modo, None);
    };
    match bruto.parse::<i64>() {
        Ok(a) if (-7..=7).contains(&a) => (a as i8, modo, None),
        _ => (
            0,
            modo,
            Some(format!(
                "tonalidade: armadura inválida ({bruto}); assumido 0"
            )),
        ),
    }
}

/// Classe de nota (0 = Dó) da tônica da tonalidade maior com essa armadura, ou da relativa menor.
pub(crate) fn tonica_pc(armadura: i8, menor: bool) -> u8 {
    let maior = (i32::from(armadura) * 7).rem_euclid(12);
    (if menor { maior + 9 } else { maior }).rem_euclid(12) as u8
}

/// Última nota (a que começa mais tarde) de uma voz.
pub(crate) fn ultima_nota(v: &Voz) -> Option<u8> {
    v.notas
        .iter()
        .max_by(|a, b| a.inicio.total_cmp(&b.inicio))
        .map(|n| n.midi)
}

/// Modo pela nota final do baixo (última voz): da passada final, se houver, senão da normal; se não bater com nenhuma tônica,
/// pela primeira nota do baixo. `None` quando nada bate (o chamador assume maior e avisa).
pub(crate) fn modo_pelo_baixo(
    armadura: i8,
    vozes: &[Voz],
    final_: Option<&[Voz]>,
) -> Option<&'static str> {
    let qual = |pc: u8| {
        if pc == tonica_pc(armadura, false) {
            Some("maior")
        } else if pc == tonica_pc(armadura, true) {
            Some("menor")
        } else {
            None
        }
    };
    let fim = final_
        .and_then(<[Voz]>::last)
        .or(vozes.last())
        .and_then(ultima_nota);
    let inicio = vozes
        .last()
        .and_then(|v| v.notas.iter().min_by(|a, b| a.inicio.total_cmp(&b.inicio)))
        .map(|n| n.midi);
    fim.and_then(|m| qual(m % 12))
        .or_else(|| inicio.and_then(|m| qual(m % 12)))
}

pub(crate) const NOMES_MAIOR: [&str; 15] = [
    "Dó♭", "Sol♭", "Ré♭", "Lá♭", "Mi♭", "Si♭", "Fá", "Dó", "Sol", "Ré", "Lá", "Mi", "Si", "Fá♯",
    "Dó♯",
];
pub(crate) const NOMES_MENOR: [&str; 15] = [
    "Lá♭", "Mi♭", "Si♭", "Fá", "Dó", "Sol", "Ré", "Lá", "Mi", "Si", "Fá♯", "Dó♯", "Sol♯", "Ré♯",
    "Lá♯",
];

/// Nome da tonalidade em português ("Mi♭ maior"), pelo nome da armadura (não da tônica: +6 é Fá♯, −6 é Sol♭).
pub fn nome_da_tonalidade(armadura: i8, modo: &str) -> String {
    let i = (i32::from(armadura) + 7).clamp(0, 14) as usize;
    if modo == "menor" {
        format!("{} menor", NOMES_MENOR[i])
    } else {
        format!("{} maior", NOMES_MAIOR[i])
    }
}
