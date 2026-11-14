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
    /// Andamento em batidas por minuto (padrão 90 na interface).
    #[serde(default)]
    pub andamento: Option<u32>,
    /// Notas de cada voz, tocadas por um sintetizador (não há gravações).
    #[serde(default)]
    pub vozes: Vec<Voz>,
}

/// Evento de nota: `[inicio_em_batidas, duracao_em_batidas, nota_midi]`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Nota(pub f32, pub f32, pub u8);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Voz {
    pub nome: String,
    pub notas: Vec<Nota>,
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

const LIMITE_BYTES: usize = 20 * 1024 * 1024;

/// Valida e grava o JSON como `<dir>/hinario.json`. A gravação é atômica
/// (arquivo temporário + rename): um arquivo inválido nunca substitui o atual.
pub fn importar(dir: &Path, json: &str) -> Result<Pacote, String> {
    if json.len() > LIMITE_BYTES {
        return Err("arquivo grande demais (limite de 20 MB)".into());
    }
    let h = ler(json)?;
    if h.hinos.is_empty() {
        return Err("o hinário não tem nenhum hino".into());
    }
    let mut numeros: Vec<u32> = h.hinos.iter().map(|x| x.numero).collect();
    numeros.sort_unstable();
    if let Some(par) = numeros.windows(2).find(|p| p[0] == p[1]) {
        return Err(format!("número de hino repetido: {}", par[0]));
    }
    std::fs::create_dir_all(dir)
        .map_err(|e| format!("não foi possível criar {}: {e}", dir.display()))?;
    let tmp = dir.join("hinario.json.tmp");
    std::fs::write(&tmp, json).map_err(|e| format!("erro ao gravar: {e}"))?;
    std::fs::rename(&tmp, dir.join("hinario.json")).map_err(|e| format!("erro ao gravar: {e}"))?;
    Ok(Pacote { hinario: h, exemplo: false })
}

/// Remove o conteúdo importado; o app volta a mostrar o pacote de exemplo.
pub fn remover(dir: &Path) -> Result<Pacote, String> {
    let arquivo = dir.join("hinario.json");
    if arquivo.is_file() {
        std::fs::remove_file(&arquivo).map_err(|e| format!("erro ao remover: {e}"))?;
    }
    carregar(Some(dir))
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn exemplo_embutido_e_valido() {
        let h = ler(EXEMPLO).unwrap();
        assert_eq!(h.hinario.id, "exemplo");
        assert_eq!(h.hinos.len(), 3);
        assert_eq!(h.hinos[0].vozes.len(), 2);
        assert_eq!(h.hinos[0].vozes[0].notas[0], Nota(0.0, 1.0, 72));
    }

    #[test]
    fn notas_sao_arrays_no_json() {
        let v: Voz = serde_json::from_str(r#"{"nome":"S","notas":[[0,1.5,60]]}"#).unwrap();
        assert_eq!(v.notas[0], Nota(0.0, 1.5, 60));
        assert_eq!(serde_json::to_string(&v.notas[0]).unwrap(), "[0.0,1.5,60]");
    }

    #[test]
    fn campos_opcionais_tem_padrao() {
        let h = ler(r#"{"versao":1,"hinario":{"id":"a","nome":"A"},"hinos":[{"numero":7,"titulo":"T"}]}"#)
            .unwrap();
        let hino = &h.hinos[0];
        assert!(hino.letra.is_empty() && hino.tonalidade.is_none());
        assert!(hino.vozes.is_empty() && hino.andamento.is_none());
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

    fn dir_teste(nome: &str) -> std::path::PathBuf {
        let d = std::env::temp_dir().join(format!("bmccb_{nome}_{}", std::process::id()));
        std::fs::remove_dir_all(&d).ok();
        d
    }

    const VALIDO: &str = r#"{"versao":1,"hinario":{"id":"x","nome":"X"},"hinos":[{"numero":1,"titulo":"A"},{"numero":2,"titulo":"B"}]}"#;

    #[test]
    fn importar_grava_e_carregar_le() {
        let d = dir_teste("ok");
        let p = importar(&d, VALIDO).unwrap();
        assert!(!p.exemplo && p.hinario.hinos.len() == 2);
        let lido = carregar(Some(&d)).unwrap();
        assert!(!lido.exemplo && lido.hinario.hinario.id == "x");
        assert!(!d.join("hinario.json.tmp").exists());
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn importar_invalido_nao_substitui_o_atual() {
        let d = dir_teste("inv");
        importar(&d, VALIDO).unwrap();
        assert!(importar(&d, "{ quebrado").is_err());
        assert!(importar(&d, r#"{"versao":2,"hinario":{"id":"a","nome":"A"},"hinos":[]}"#).is_err());
        assert_eq!(carregar(Some(&d)).unwrap().hinario.hinario.id, "x");
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn importar_rejeita_vazio_e_numero_repetido() {
        let d = dir_teste("val");
        let vazio = r#"{"versao":1,"hinario":{"id":"a","nome":"A"},"hinos":[]}"#;
        assert!(importar(&d, vazio).unwrap_err().contains("nenhum hino"));
        let rep = r#"{"versao":1,"hinario":{"id":"a","nome":"A"},"hinos":[{"numero":5,"titulo":"A"},{"numero":5,"titulo":"B"}]}"#;
        assert!(importar(&d, rep).unwrap_err().contains("repetido: 5"));
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn remover_volta_ao_exemplo() {
        let d = dir_teste("rem");
        importar(&d, VALIDO).unwrap();
        assert!(remover(&d).unwrap().exemplo);
        assert!(remover(&d).unwrap().exemplo); // idempotente
        std::fs::remove_dir_all(&d).ok();
    }
}
