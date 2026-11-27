//! Pacote `.zip` com as partituras (I-08): importa o `hinario.json` e os `partituras/hino-N.svg`, e entrega cada partitura
//! à interface. O formato está em docs/FORMATO.md.
//!
//! O zip vem de fora, então nada dele é confiado:
//!  - **nomes exatos:** só `hinario.json`, a pasta `partituras/`, `partituras/hino-<número>.svg` (retrato, obrigatório) e
//!    `partituras/hino-<número>-paisagem.svg` (opcional); qualquer outro nome (`..`, caminho absoluto, subpasta, maiúscula, zero à
//!    esquerda) recusa o pacote. Nenhum nome do zip vira caminho no disco: o arquivo gravado é sempre `partituras/hino-<número>.svg`
//!    ou `-paisagem.svg`, montado aqui;
//!  - **limites** de tamanho do zip, de arquivos, do total descompactado e de cada arquivo, valendo também para o que o
//!    cabeçalho do zip declara errado (a leitura é cortada no limite);
//!  - **cada SVG é limpo** por `svg::limpar` (lista de permitidos, reescrito); o que não passa é **recusado** e informado, e
//!    o resto do pacote importa;
//!  - **tudo ou nada:** o que não pode ser lido de fora (nomes, JSON, limites) recusa o pacote inteiro, sem tocar no conteúdo
//!    atual. A gravação é feita numa pasta de preparo e só então troca o que havia.
//!
//! As partituras são lidas pelo **número do hino**, nunca por um caminho do JSON (o campo `partitura` do hino é só informativo).
//! A pasta `partituras/` leva a marca `.hinario` com o `id` do hinário a que pertence: se o hinário trocar, ela não vale.

mod disco;
mod entradas;
mod preparo;
mod tipos;

use crate::hinario::{self, Pacote, erro};
use base64::{Engine, engine::general_purpose::STANDARD};
use disco::{marca, sem_erro_se_nao_existe};
use entradas::{abrir_zip, listar_svgs};
use preparo::{Preparo, preparar};
use std::collections::HashSet;
use std::io::Cursor;
use std::path::Path;
use tipos::{gravar, invalido};
use zip::ZipArchive;

pub use disco::{alinhar, ler_partitura, numeros, remover_partituras};
pub use tipos::{Importacao, Limites};

/// Importa o pacote que a interface manda como **texto base64**. Os bytes não podem ir como corpo binário da chamada: no Android o
/// `InvokeBody::Raw` **não existe** (o WebView não entrega o corpo de uma requisição ao protocolo customizado, e o Tauri usa só o
/// `postMessage`, que é texto), e o comando recebia sempre "a chamada não trouxe os bytes do arquivo". Texto base64 vale em todas as
/// plataformas, e é a forma que a própria documentação do Tauri indica para bytes no Android.
#[cfg(test)]
pub fn importar_base64(dir: &Path, texto: &str) -> Result<Importacao, String> {
    importar_base64_com(dir, texto, &Limites::default())
}

#[cfg(test)]
pub fn importar_base64_com(dir: &Path, texto: &str, lim: &Limites) -> Result<Importacao, String> {
    importar_base64_com_progresso(dir, texto, lim, &mut |_, _| {})
}

/// Como `importar_base64`, avisando o andamento: `progresso(feito, total)` conta as partituras já tratadas (a limpeza de cada SVG é a parte lenta).
pub fn importar_base64_progresso(
    dir: &Path,
    texto: &str,
    progresso: &mut dyn FnMut(u32, u32),
) -> Result<Importacao, String> {
    importar_base64_com_progresso(dir, texto, &Limites::default(), progresso)
}

fn importar_base64_com_progresso(
    dir: &Path,
    texto: &str,
    lim: &Limites,
    progresso: &mut dyn FnMut(u32, u32),
) -> Result<Importacao, String> {
    // A cada 3 bytes, 4 caracteres: o tamanho do texto já diz se o zip passaria do limite, antes de alocar os bytes.
    if texto.len() > lim.zip.div_ceil(3) * 4 + 4 {
        return Err(erro("zip_grande_demais", &[]));
    }
    let bytes = STANDARD
        .decode(texto.trim())
        .map_err(|e| invalido(format!("base64: {e}")))?;
    importar_zip_com_progresso(dir, &bytes, lim, progresso)
}

/// Só os testes entram por aqui (com os bytes já prontos); o app entra por `importar_base64_progresso`.
#[cfg(test)]
pub fn importar_zip(dir: &Path, bytes: &[u8]) -> Result<Importacao, String> {
    importar_zip_com(dir, bytes, &Limites::default())
}

#[cfg(test)]
pub fn importar_zip_com(dir: &Path, bytes: &[u8], lim: &Limites) -> Result<Importacao, String> {
    importar_zip_com_progresso(dir, bytes, lim, &mut |_, _| {})
}

fn importar_zip_com_progresso(
    dir: &Path,
    bytes: &[u8],
    lim: &Limites,
    progresso: &mut dyn FnMut(u32, u32),
) -> Result<Importacao, String> {
    let _tranca = hinario::trancar();
    let mut zip = abrir_zip(bytes, lim)?;
    let svgs = listar_svgs(&mut zip, lim)?;

    // As partituras valem para o hinário que já está instalado: é dele que vêm os números de hino aceitos e a marca da pasta.
    let hinario = hinario::instalado(dir)?.ok_or_else(|| erro("partituras_sem_hinario", &[]))?;
    let hinos: HashSet<u32> = hinario.hinos.iter().map(|h| h.numero).collect();

    std::fs::create_dir_all(dir).map_err(gravar)?;
    let novo = dir.join("partituras.novo");
    let marca = marca(&hinario.hinario.id);
    let preparo = Preparo {
        svgs: &svgs,
        hinos: &hinos,
        novo: &novo,
        marca: &marca,
        lim,
    };
    let (aceitas, recusadas) = preparar_ou_limpar(&mut zip, &preparo, progresso)?;

    trocar_pastas(dir, &novo, !aceitas.is_empty())?;
    // O 100% só sai agora: a limpeza, a gravação da marca e a troca da pasta já terminaram. Nos caminhos de erro nenhum 100% é enviado.
    let tratadas = svgs.len() as u32;
    progresso(tratadas, tratadas);
    resultado(dir, hinario, aceitas, recusadas)
}

/// Prepara as partituras; se falhar, a pasta de preparo não fica para trás.
fn preparar_ou_limpar(
    zip: &mut ZipArchive<Cursor<&[u8]>>,
    preparo: &Preparo,
    progresso: &mut dyn FnMut(u32, u32),
) -> Result<(Vec<u32>, Vec<tipos::Recusada>), String> {
    preparar(zip, preparo, progresso).inspect_err(|_| {
        std::fs::remove_dir_all(preparo.novo).ok();
    })
}

/// Monta o resultado. Depois da troca, o que está instalado é EXATAMENTE o que foi aceito: não se relê o disco (uma falha de leitura aqui
/// devolveria erro com as partituras novas já no lugar, e a tela ficaria diferente do que está instalado). Só quando nada foi trocado
/// (todas recusadas) é preciso ler o que já havia, e aí nada mudou no disco.
fn resultado(
    dir: &Path,
    hinario: hinario::Hinario,
    mut aceitas: Vec<u32>,
    recusadas: Vec<tipos::Recusada>,
) -> Result<Importacao, String> {
    aceitas.sort_unstable();
    let instaladas = if aceitas.is_empty() {
        numeros(dir, &hinario.hinario.id)?
    } else {
        aceitas.clone()
    };
    Ok(Importacao {
        partituras: aceitas.len() as u32,
        pacote: Pacote {
            hinario,
            exemplo: false,
            partituras: instaladas,
            partituras_erro: None,
        },
        recusadas,
    })
}

/// Troca: o que já havia só sai agora que tudo o que vai entrar está pronto. Se nenhuma partitura foi aceita (todas recusadas), as
/// que já estavam instaladas ficam como estão.
fn trocar_pastas(dir: &Path, novo: &Path, ha_aceitas: bool) -> Result<(), String> {
    if !ha_aceitas {
        return sem_erro_se_nao_existe(std::fs::remove_dir_all(novo)).map_err(gravar);
    }
    let troca = sem_erro_se_nao_existe(std::fs::remove_dir_all(dir.join("partituras")))
        .and_then(|()| std::fs::rename(novo, dir.join("partituras")))
        .map_err(gravar);
    if troca.is_err() {
        std::fs::remove_dir_all(novo).ok();
    }
    troca
}

#[cfg(test)]
mod testes;
