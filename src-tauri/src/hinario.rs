//! Leitura do pacote de conteúdo (ver docs/FORMATO.md).
//! O repositório só traz um pacote de exemplo com dados fictícios.

use serde::{Deserialize, Serialize};
use std::path::Path;

const EXEMPLO: &str = include_str!("../exemplo/hinario.json");
const VERSAO_SUPORTADA: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InfoHinario {
    pub id: String,
    pub nome: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Hino {
    pub numero: u32,
    pub titulo: String,
    #[serde(default)]
    pub tonalidade: Option<String>,
    #[serde(default)]
    pub letra: Vec<String>,
    #[serde(default)]
    pub partitura: Option<String>,
    #[serde(default)]
    pub audio: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Hinario {
    pub versao: u32,
    pub hinario: InfoHinario,
    pub hinos: Vec<Hino>,
}

/// Resposta enviada à interface: o hinário e se ele é o pacote de exemplo.
#[derive(Debug, Serialize)]
pub struct Pacote {
    pub hinario: Hinario,
    pub exemplo: bool,
}

pub fn ler(json: &str) -> Result<Hinario, String> {
    let h: Hinario = serde_json::from_str(json).map_err(|e| format!("JSON inválido: {e}"))?;
    if h.versao != VERSAO_SUPORTADA {
        return Err(format!(
            "versão {} não suportada (esperado {VERSAO_SUPORTADA})",
            h.versao
        ));
    }
    Ok(h)
}

/// Carrega `<dir>/hinario.json`; se não existir, usa o pacote de exemplo.
/// Se existir mas estiver inválido, devolve o erro (não esconde com o exemplo).
pub fn carregar(dir: Option<&Path>) -> Result<Pacote, String> {
    if let Some(dir) = dir {
        let arquivo = dir.join("hinario.json");
        if arquivo.is_file() {
            let texto = std::fs::read_to_string(&arquivo)
                .map_err(|e| format!("não foi possível ler {}: {e}", arquivo.display()))?;
            return Ok(Pacote { hinario: ler(&texto)?, exemplo: false });
        }
    }
    Ok(Pacote { hinario: ler(EXEMPLO)?, exemplo: true })
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn exemplo_embutido_e_valido() {
        let h = ler(EXEMPLO).unwrap();
        assert_eq!(h.hinario.id, "exemplo");
        assert_eq!(h.hinos.len(), 3);
    }

    #[test]
    fn campos_opcionais_tem_padrao() {
        let h = ler(r#"{"versao":1,"hinario":{"id":"a","nome":"A"},"hinos":[{"numero":7,"titulo":"T"}]}"#)
            .unwrap();
        let hino = &h.hinos[0];
        assert!(hino.letra.is_empty() && hino.tonalidade.is_none() && hino.audio.is_none());
    }

    #[test]
    fn rejeita_versao_desconhecida() {
        let e = ler(r#"{"versao":2,"hinario":{"id":"a","nome":"A"},"hinos":[]}"#).unwrap_err();
        assert!(e.contains("versão 2"));
    }

    #[test]
    fn sem_pasta_usa_exemplo() {
        assert!(carregar(None).unwrap().exemplo);
        assert!(carregar(Some(Path::new("/nao/existe"))).unwrap().exemplo);
    }

    #[test]
    fn arquivo_invalido_gera_erro_em_vez_de_exemplo() {
        let dir = std::env::temp_dir().join("bmccb_teste_invalido");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("hinario.json"), "{ quebrado").unwrap();
        assert!(carregar(Some(&dir)).is_err());
        std::fs::remove_dir_all(&dir).ok();
    }
}
