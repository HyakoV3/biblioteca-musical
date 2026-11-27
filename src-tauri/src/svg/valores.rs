//! Os valores dos atributos do SVG (ver `svg.rs`): o que cada valor precisa ser para passar, o prefixo dos `id` e o escape do que vai para a saída.

use super::listas::PROIBIDOS_NO_VALOR;
use crate::hinario::erro;

/// Prefixo dos `id` (e dos `href="#..."`) do SVG, para não colidirem com os da página.
const PREFIXO_ID: &str = "bm-p-";

/// Um tempo em batidas como o gerador escreve: dígitos com no máximo um ponto decimal no meio, até 12 caracteres (`0`, `1.5`, `12.3333`).
/// Sem sinal, sem expoente, sem espaço: o app lê o valor com `parseFloat`, e nada mais que número passa.
fn tempo_valido(valor: &str) -> bool {
    let partes: Vec<&str> = valor.split('.').collect();
    valor.len() <= 12
        && partes.len() <= 2
        && partes
            .iter()
            .all(|p| !p.is_empty() && p.bytes().all(|b| b.is_ascii_digit()))
}

fn id_simples(id: &str) -> bool {
    !id.is_empty()
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "_-.:".contains(c))
}

/// O `id` com o prefixo do app. Idempotente: limpar de novo um SVG já limpo não prefixa outra vez.
fn com_prefixo(id: &str) -> String {
    if id.starts_with(PREFIXO_ID) {
        id.to_string()
    } else {
        format!("{PREFIXO_ID}{id}")
    }
}

/// Confere o valor de um atributo e devolve o que vai para a saída (`id` e `href` ganham o prefixo).
pub(super) fn valor_final(atributo: &str, valor: &str) -> Result<String, String> {
    match atributo {
        "id" if id_simples(valor) => Ok(com_prefixo(valor)),
        "id" => Err(erro("svg_valor_id", &[])),
        "data-t" | "data-f" if tempo_valido(valor) => Ok(valor.to_string()),
        "data-t" | "data-f" => Err(erro("svg_valor_tempo", &[])),
        "href" => href_final(valor),
        _ => sem_proibidos(valor),
    }
}

/// `href` só aponta para um `id` de dentro (`#id`), que ganha o prefixo do app.
fn href_final(valor: &str) -> Result<String, String> {
    let id = valor.strip_prefix('#').unwrap_or("");
    if id_simples(id) {
        Ok(format!("#{}", com_prefixo(id)))
    } else {
        Err(erro("svg_valor_href", &[]))
    }
}

/// Qualquer outro valor passa se não tiver um dos pedaços proibidos (`url(`, `javascript:`...).
fn sem_proibidos(valor: &str) -> Result<String, String> {
    let baixo = valor.to_ascii_lowercase();
    match PROIBIDOS_NO_VALOR.iter().find(|p| baixo.contains(**p)) {
        Some(p) => Err(erro("svg_valor_proibido", &[p.to_string()])),
        None => Ok(valor.to_string()),
    }
}

pub(super) fn escapar(texto: &str, atributo: bool, saida: &mut String) {
    for c in texto.chars() {
        match c {
            '&' => saida.push_str("&amp;"),
            '<' => saida.push_str("&lt;"),
            '>' => saida.push_str("&gt;"),
            '"' if atributo => saida.push_str("&quot;"),
            _ => saida.push(c),
        }
    }
}
