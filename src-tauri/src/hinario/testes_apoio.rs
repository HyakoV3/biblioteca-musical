//! Apoio dos testes de `hinario.rs`: o que mais de um grupo de testes usa.

/// O erro decodificado: `[codigo, arg, ...]`.
pub(super) fn args(e: &str) -> Vec<String> {
    serde_json::from_str(e).unwrap_or_else(|_| panic!("erro não é um JSON de códigos: {e}"))
}

pub(super) fn dir_teste(nome: &str) -> std::path::PathBuf {
    let d = std::env::temp_dir().join(format!("bm_{nome}_{}", std::process::id()));
    std::fs::remove_dir_all(&d).ok();
    d
}
