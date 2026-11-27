//! O que já está no disco (ver `pacote.rs`): a marca do hinário, os números instalados, o alinhamento, a remoção e a leitura de cada partitura.

use super::entradas::classificar;
use super::tipos::{Entrada, Limites, MIB, Variante};
use crate::hinario::{self, erro};
use crate::svg;
use std::io::Read;
use std::path::Path;

pub(super) fn sem_erro_se_nao_existe(r: std::io::Result<()>) -> std::io::Result<()> {
    match r {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        outro => outro,
    }
}

/// A marca que diz a que hinário a pasta de partituras pertence (o `id`, em JSON, para comparar exatamente).
pub(super) fn marca(id: &str) -> String {
    serde_json::to_string(id).unwrap_or_default()
}

/// A marca de `partituras/` (o `id` do hinário a que pertencem), ou `None` se não há marca. **Só** a falta do arquivo é "sem
/// marca": qualquer outra falha de leitura (permissão, erro de E/S) é um erro, e quem decide apagar algo não pode confundi-la
/// com "é de outro hinário".
pub(super) fn ler_marca(pasta: &Path) -> Result<Option<String>, String> {
    let arquivo = pasta.join(".hinario");
    match std::fs::read_to_string(&arquivo) {
        Ok(t) => Ok(Some(t)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(erro(
            "partituras_ler",
            &[format!("{}: {e}", hinario::nome_de(&arquivo))],
        )),
    }
}

/// Números dos hinos com partitura instalada, em ordem; vazio se a pasta não pertence ao hinário `id`. Uma pasta que não
/// pode ser lida é um erro, e não uma lista vazia (a tela mostraria "sem partitura" sem dizer por quê).
pub fn numeros(dir: &Path, id: &str) -> Result<Vec<u32>, String> {
    let pasta = dir.join("partituras");
    if ler_marca(&pasta)?.as_deref() != Some(marca(id).as_str()) {
        return Ok(Vec::new());
    }
    let falha = |e: std::io::Error| {
        erro(
            "partituras_ler",
            &[format!("{}: {e}", hinario::nome_de(&pasta))],
        )
    };
    let mut v = Vec::new();
    for entrada in std::fs::read_dir(&pasta).map_err(falha)? {
        let nome = entrada.map_err(falha)?.file_name();
        if let Some(Entrada::Svg(n, Variante::Retrato)) =
            classificar(&format!("partituras/{}", nome.to_string_lossy()))
        {
            v.push(n);
        }
    }
    v.sort_unstable();
    v.dedup();
    Ok(v)
}

/// Depois de importar um `hinario.json` sozinho: as partituras só ficam se forem do mesmo hinário (`id`). Se a marca não puder
/// ser lida, nada é apagado e o erro sobe.
pub fn alinhar(dir: &Path, id: &str) -> Result<(), String> {
    let pasta = dir.join("partituras");
    if pasta.exists() && ler_marca(&pasta)?.as_deref() != Some(marca(id).as_str()) {
        remover_partituras(dir)?;
    }
    Ok(())
}

/// Apaga as partituras importadas (e a pasta de preparo de uma importação interrompida).
pub fn remover_partituras(dir: &Path) -> Result<(), String> {
    for pasta in ["partituras", "partituras.novo"] {
        sem_erro_se_nao_existe(std::fs::remove_dir_all(dir.join(pasta)))
            .map_err(|e| erro("partituras_remover", &[e.to_string()]))?;
    }
    Ok(())
}

/// O SVG (já limpo na importação, e limpo de novo aqui: o arquivo fica numa pasta que o app não é o único a poder tocar) do hino
/// `numero`, na versão da tela: `paisagem` pede a versão larga, e se o pacote não a trouxe, ou se ela não passa na conferência (grande demais, não
/// é UTF-8, SVG recusado), vale a de retrato (o motivo vai ao log: a tela larga é um extra, e sem ela o hino ainda abre). O retrato recusado é erro.
/// O arquivo é aberto uma vez e lido só até o limite (nada de olhar o tamanho e ler depois: ele pode mudar entre as duas coisas).
pub fn ler_partitura(dir: &Path, numero: u32, paisagem: bool) -> Result<String, String> {
    let ordem: &[Variante] = if paisagem {
        &[Variante::Paisagem, Variante::Retrato]
    } else {
        &[Variante::Retrato]
    };
    let mut recusada: Option<String> = None;
    for variante in ordem {
        match ler_variante(dir, numero, *variante)? {
            None => continue,
            Some(Ok(svg)) => return Ok(svg),
            Some(Err(motivo)) if *variante == Variante::Paisagem => {
                eprintln!(
                    "partitura {numero}: a versão de paisagem foi recusada ({motivo}); usando o retrato"
                );
                recusada = Some(motivo);
            }
            Some(Err(motivo)) => {
                return Err(erro("partitura_invalida", &[numero.to_string(), motivo]));
            }
        }
    }
    // Só a paisagem existia e foi recusada: sem retrato para cair, o motivo é o erro.
    match recusada {
        Some(motivo) => Err(erro("partitura_invalida", &[numero.to_string(), motivo])),
        None => Err(erro("sem_partitura", &[numero.to_string()])),
    }
}

/// Lê uma versão da partitura: `Ok(None)` se o arquivo não existe, `Ok(Some(Ok(svg)))` se passou na conferência, `Ok(Some(Err(motivo)))` se foi
/// recusada, e `Err` se o disco falhou (esse erro não é "recusada": não cai em outra versão).
fn ler_variante(
    dir: &Path,
    numero: u32,
    variante: Variante,
) -> Result<Option<Result<String, String>>, String> {
    let arquivo = dir.join("partituras").join(variante.arquivo(numero));
    let falha = |e: std::io::Error| {
        erro(
            "partituras_ler",
            &[format!("{}: {e}", hinario::nome_de(&arquivo))],
        )
    };
    let aberto = match std::fs::File::open(&arquivo) {
        Ok(f) => f,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(falha(e)),
    };
    let bytes = ler_ate_o_limite(aberto, Limites::default().svg).map_err(falha)?;
    Ok(Some(conferir_svg(bytes)))
}

/// Lê no máximo `limite + 1` bytes: um a mais que o limite é o sinal de que o arquivo passou dele.
fn ler_ate_o_limite(arquivo: std::fs::File, limite: u64) -> std::io::Result<Vec<u8>> {
    let mut bytes = Vec::new();
    arquivo.take(limite + 1).read_to_end(&mut bytes)?;
    Ok(bytes)
}

/// A conferência de uma partitura lida do disco: dentro do limite, UTF-8 e aceita pela limpeza.
fn conferir_svg(bytes: Vec<u8>) -> Result<String, String> {
    let limite = Limites::default().svg;
    if bytes.len() as u64 > limite {
        return Err(erro("pacote_svg_grande", &[(limite / MIB).to_string()]));
    }
    match String::from_utf8(bytes) {
        Ok(texto) => svg::limpar(&texto),
        Err(_) => Err(erro("pacote_utf8", &[])),
    }
}
