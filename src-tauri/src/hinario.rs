//! Leitura do pacote de conteúdo (ver docs/FORMATO.md).
//! O repositório só traz um pacote de exemplo, com 5 hinos de domínio público (procedência em docs/licencas-de-terceiros.md).

mod leitura;
mod tipos;

pub use leitura::ler;
pub use tipos::*;

use std::path::Path;
use std::sync::{Mutex, MutexGuard};

const EXEMPLO: &str = include_str!("../exemplo/hinario.json");
/// Conteúdo opcional levado dentro do binário por `BM_PACOTE` na hora do build (ver build.rs). Vazio no
/// build comum. Não vai para o Git: o repositório só traz o pacote de exemplo (domínio público).
const INCLUSO: &str = include_str!(concat!(env!("OUT_DIR"), "/pacote_incluso.json"));

/// Erro que a interface traduz: um JSON `["codigo", "arg", ...]` (ver `src/lib/erros.ts`). JSON, e não texto separado por
/// delimitador, porque os argumentos podem vir de dados importados (nomes de voz) e conter qualquer caractere.
pub(crate) fn erro(codigo: &str, args: &[String]) -> String {
    let mut v = vec![codigo.to_string()];
    v.extend_from_slice(args);
    serde_json::to_string(&v).unwrap_or_else(|_| codigo.to_string())
}

/// Só o nome do arquivo ou da pasta, para o detalhe de um erro: o caminho absoluto da pasta de dados do app não vai à tela.
pub(crate) fn nome_de(caminho: &Path) -> String {
    caminho
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default()
}

/// Carrega `<dir>/hinario.json`; se não existir, usa o pacote de exemplo.
/// Se existir mas estiver inválido, devolve o erro (não esconde com o exemplo).
pub fn carregar(dir: Option<&Path>) -> Result<Pacote, String> {
    if let Some(dir) = dir {
        semear(dir, INCLUSO)?;
        if dir.join("hinario.json").is_file() {
            return carregar_instalado(dir);
        }
    }
    Ok(Pacote {
        hinario: ler(EXEMPLO)?,
        exemplo: true,
        partituras: crate::exemplo::numeros(),
        partituras_erro: None,
    })
}

/// O hinário importado em `dir` (o `hinario.json` existe) e as partituras que ele tem.
fn carregar_instalado(dir: &Path) -> Result<Pacote, String> {
    let arquivo = dir.join("hinario.json");
    let texto = std::fs::read_to_string(&arquivo)
        .map_err(|e| erro("ler", &[format!("{}: {e}", nome_de(&arquivo))]))?;
    let hinario = ler(&texto)?;
    // Uma pasta `partituras/` ilegível não derruba o hinário: ele abre sem partituras e o motivo vai à parte.
    let (partituras, partituras_erro) = match crate::pacote::numeros(dir, &hinario.hinario.id) {
        Ok(v) => (v, None),
        Err(e) => (Vec::new(), Some(e)),
    };
    Ok(Pacote {
        hinario,
        exemplo: false,
        partituras,
        partituras_erro,
    })
}

/// Impressão digital simples (FNV-1a de 64 bits + tamanho) para saber se o conteúdo incluso mudou.
fn impressao(texto: &str) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in texto.bytes() {
        h ^= u64::from(b);
        h = h.wrapping_mul(0x100000001b3);
    }
    format!("{h:016x}-{}", texto.len())
}

/// Grava o conteúdo incluso no app como se a pessoa o tivesse importado, uma vez por versão do conteúdo:
///  - sem conteúdo incluso, não faz nada;
///  - se esta versão já foi aplicada (marca `.incluso`), não repete, mesmo que a pessoa tenha removido o conteúdo;
///  - se já existe um hinário e nunca houve marca, é uma importação da própria pessoa: não é sobrescrita.
fn semear(dir: &Path, incluso: &str) -> Result<(), String> {
    if incluso.trim().is_empty() {
        return Ok(());
    }
    let marca = dir.join(".incluso");
    let atual = std::fs::read_to_string(&marca).ok();
    let nova = impressao(incluso);
    if atual.as_deref().map(str::trim) == Some(nova.as_str()) {
        return Ok(());
    }
    if atual.is_none() && dir.join("hinario.json").is_file() {
        return Ok(());
    }
    importar(dir, incluso)?;
    std::fs::write(&marca, &nova)
        .map_err(|e| erro("gravar", &[format!("{}: {e}", nome_de(&marca))]))
}

pub(crate) const LIMITE_BYTES: usize = 20 * 1024 * 1024;

static TRANCA: Mutex<()> = Mutex::new(());

/// Uma importação ou remoção de cada vez. Os comandos `async` do Tauri rodam em paralelo, e todas essas operações usam os mesmos
/// nomes de arquivo de preparo (`hinario.json.tmp`, `partituras.novo`): duas ao mesmo tempo se atropelariam e quebrariam o "tudo
/// ou nada". Quem chama segura a guarda até acabar de trocar os arquivos. Não pode ser pega de novo na mesma thread (não é
/// reentrante): por isso `carregar`, que pode chamar `importar` pelo `semear`, não a segura.
pub(crate) fn trancar() -> MutexGuard<'static, ()> {
    // Se uma thread caiu (panic) com a tranca, não há estado a recuperar: só os arquivos, que cada operação refaz.
    TRANCA.lock().unwrap_or_else(|e| e.into_inner())
}

/// Confere um `hinario.json`: tamanho, estrutura, ao menos um hino e números sem repetição.
pub(crate) fn validar(json: &str) -> Result<Hinario, String> {
    if json.len() > LIMITE_BYTES {
        return Err(erro("grande_demais", &[]));
    }
    let h = ler(json)?;
    if h.hinos.is_empty() {
        return Err(erro("vazio", &[]));
    }
    let mut numeros: Vec<u32> = h.hinos.iter().map(|x| x.numero).collect();
    numeros.sort_unstable();
    if let Some(par) = numeros.windows(2).find(|p| p[0] == p[1]) {
        return Err(erro("repetido", &[par[0].to_string()]));
    }
    Ok(h)
}

/// Valida e grava o JSON como `<dir>/hinario.json`. A gravação é atômica
/// (arquivo temporário + rename): um arquivo inválido nunca substitui o atual.
/// As partituras já importadas só ficam se forem do mesmo hinário (mesmo `id`): senão os números de hino não combinariam.
pub fn importar(dir: &Path, json: &str) -> Result<Pacote, String> {
    let _tranca = trancar();
    let h = validar(json)?;
    std::fs::create_dir_all(dir)
        .map_err(|e| erro("gravar", &[format!("{}: {e}", nome_de(dir))]))?;
    let tmp = dir.join("hinario.json.tmp");
    std::fs::write(&tmp, json).map_err(|e| erro("gravar", &[e.to_string()]))?;
    std::fs::rename(&tmp, dir.join("hinario.json"))
        .map_err(|e| erro("gravar", &[e.to_string()]))?;
    crate::pacote::alinhar(dir, &h.hinario.id)?;
    let partituras = crate::pacote::numeros(dir, &h.hinario.id)?;
    Ok(Pacote {
        hinario: h,
        exemplo: false,
        partituras,
        partituras_erro: None,
    })
}

/// O hinário instalado (o `hinario.json` de `dir`), sem semear nem carregar o exemplo: `None` se não há arquivo. Não pega a tranca
/// (quem importa partituras já a tem e não pode pedi-la de novo).
pub(crate) fn instalado(dir: &Path) -> Result<Option<Hinario>, String> {
    let arquivo = dir.join("hinario.json");
    match std::fs::read_to_string(&arquivo) {
        Ok(texto) => ler(&texto).map(Some),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(erro("ler", &[format!("{}: {e}", nome_de(&arquivo))])),
    }
}

/// Remove só as partituras importadas; o hinário fica.
pub fn remover_partituras(dir: &Path) -> Result<Pacote, String> {
    {
        let _tranca = trancar(); // solta antes do `carregar`, que pode importar (semear) e pegá-la
        crate::pacote::remover_partituras(dir)?;
    }
    carregar(Some(dir))
}

/// Remove o conteúdo importado (o hinário e as partituras); o app volta a mostrar o pacote de exemplo.
pub fn remover(dir: &Path) -> Result<Pacote, String> {
    {
        let _tranca = trancar(); // solta antes do `carregar`, que pode importar (semear) e pegá-la
        let arquivo = dir.join("hinario.json");
        if arquivo.is_file() {
            std::fs::remove_file(&arquivo).map_err(|e| erro("remover", &[e.to_string()]))?;
        }
        crate::pacote::remover_partituras(dir)?;
    }
    carregar(Some(dir))
}

#[cfg(test)]
mod testes_apoio;
#[cfg(test)]
mod testes_disco;
#[cfg(test)]
mod testes_extras;
#[cfg(test)]
mod testes_leitura;
#[cfg(test)]
mod testes_vozes;
