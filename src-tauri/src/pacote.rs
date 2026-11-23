//! Pacote `.zip` com as partituras (I-08): importa o `hinario.json` e os `partituras/hino-N.svg`, e entrega cada partitura
//! à interface. O formato está em docs/FORMATO.md.
//!
//! O zip vem de fora, então nada dele é confiado:
//!  - **nomes exatos:** só `hinario.json`, a pasta `partituras/` e `partituras/hino-<número>.svg`; qualquer outro nome
//!    (`..`, caminho absoluto, subpasta, maiúscula, zero à esquerda) recusa o pacote. Nenhum nome do zip vira caminho no disco:
//!    o arquivo gravado é sempre `partituras/hino-<número>.svg`, montado aqui;
//!  - **limites** de tamanho do zip, de arquivos, do total descompactado e de cada arquivo, valendo também para o que o
//!    cabeçalho do zip declara errado (a leitura é cortada no limite);
//!  - **cada SVG é limpo** por `svg::limpar` (lista de permitidos, reescrito); o que não passa é **recusado** e informado, e
//!    o resto do pacote importa;
//!  - **tudo ou nada:** o que não pode ser lido de fora (nomes, JSON, limites) recusa o pacote inteiro, sem tocar no conteúdo
//!    atual. A gravação é feita numa pasta de preparo e só então troca o que havia.
//!
//! As partituras são lidas pelo **número do hino**, nunca por um caminho do JSON (o campo `partitura` do hino é só informativo).
//! A pasta `partituras/` leva a marca `.hinario` com o `id` do hinário a que pertence: se o hinário trocar, ela não vale.

use crate::hinario::{self, Pacote, erro};
use crate::svg;
use base64::{Engine, engine::general_purpose::STANDARD};
use serde::Serialize;
use std::collections::HashSet;
use std::io::{Cursor, Read};
use std::path::Path;
use zip::ZipArchive;

const MIB: u64 = 1024 * 1024;

/// Os limites da importação. O pacote de 480 hinos tem uns 90 MB descompactados e uns 15 MB no zip (ver docs/roadmap-ideas.md).
pub struct Limites {
    /// Bytes do próprio `.zip`.
    pub zip: usize,
    pub entradas: usize,
    /// Soma dos bytes descompactados (todos os SVG).
    pub descompactado: u64,
    /// Bytes de cada SVG.
    pub svg: u64,
}

impl Default for Limites {
    fn default() -> Self {
        Limites {
            zip: 150 * MIB as usize,
            entradas: 2_000,
            descompactado: 300 * MIB,
            svg: 8 * MIB,
        }
    }
}

/// Uma partitura do zip que não entrou, e por quê (o resto do pacote entra).
#[derive(Debug, Serialize, PartialEq)]
pub struct Recusada {
    pub numero: u32,
    pub motivo: String,
}

#[derive(Debug, Serialize)]
pub struct Importacao {
    pub pacote: Pacote,
    /// Quantas partituras foram importadas.
    pub partituras: u32,
    pub recusadas: Vec<Recusada>,
}

/// Cada partitura tem até duas versões, desenhadas para larguras de tela diferentes (o SVG é pré-desenhado: as quebras de linha são fixas,
/// então um celular em pé e um deitado pedem larguras de página diferentes). O retrato é obrigatório; a paisagem é opcional.
/// A ordem (retrato antes de paisagem) importa: a paisagem só entra se o retrato do mesmo hino entrou.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Variante {
    Retrato,
    Paisagem,
}

impl Variante {
    /// O nome do arquivo no disco e dentro do zip (sem a pasta): `hino-283.svg` ou `hino-283-paisagem.svg`.
    fn arquivo(self, numero: u32) -> String {
        match self {
            Variante::Retrato => format!("hino-{numero}.svg"),
            Variante::Paisagem => format!("hino-{numero}-paisagem.svg"),
        }
    }
}

#[derive(Debug, PartialEq)]
enum Entrada {
    Pasta,
    Svg(u32, Variante),
}

/// Só estes nomes valem num pacote. O número é o canônico (sem zero à esquerda, de 1 a 9 dígitos).
fn classificar(nome: &str) -> Option<Entrada> {
    match nome {
        "partituras/" => Some(Entrada::Pasta),
        _ => {
            let resto = nome.strip_prefix("partituras/hino-")?;
            // a paisagem primeiro: "5-paisagem.svg" também termina em ".svg", mas "5-paisagem" não é um número
            let (n, variante) = match resto.strip_suffix("-paisagem.svg") {
                Some(n) => (n, Variante::Paisagem),
                None => (resto.strip_suffix(".svg")?, Variante::Retrato),
            };
            let canonico = !n.is_empty()
                && n.len() <= 9
                && n.bytes().all(|b| b.is_ascii_digit())
                && !n.starts_with('0');
            if canonico {
                n.parse().ok().map(|n| Entrada::Svg(n, variante))
            } else {
                None
            }
        }
    }
}

/// Nome do zip encurtado para ir numa mensagem de erro (pode ter qualquer coisa).
fn curto(nome: &str) -> String {
    nome.chars().take(60).collect()
}

fn invalido(e: impl ToString) -> String {
    erro("zip_invalido", &[e.to_string()])
}

fn gravar(e: impl ToString) -> String {
    erro("gravar", &[e.to_string()])
}

enum Falha {
    GrandeDemais,
    Zip(String),
}

/// Lê a entrada `i` do zip, cortando no limite (o tamanho do cabeçalho não é confiável).
fn ler_entrada(
    zip: &mut ZipArchive<Cursor<&[u8]>>,
    i: usize,
    limite: u64,
) -> Result<Vec<u8>, Falha> {
    let arquivo = zip.by_index(i).map_err(|e| Falha::Zip(e.to_string()))?;
    let mut buf = Vec::new();
    arquivo
        .take(limite + 1)
        .read_to_end(&mut buf)
        .map_err(|e| Falha::Zip(e.to_string()))?;
    if buf.len() as u64 > limite {
        return Err(Falha::GrandeDemais);
    }
    Ok(buf)
}

fn sem_erro_se_nao_existe(r: std::io::Result<()>) -> std::io::Result<()> {
    match r {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        outro => outro,
    }
}

/// A marca que diz a que hinário a pasta de partituras pertence (o `id`, em JSON, para comparar exatamente).
fn marca(id: &str) -> String {
    serde_json::to_string(id).unwrap_or_default()
}

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
    if bytes.len() > lim.zip {
        return Err(erro("zip_grande_demais", &[]));
    }
    let mut zip = ZipArchive::new(Cursor::new(bytes)).map_err(invalido)?;
    // O índice do zip já junta nomes repetidos numa entrada só (cada leitor escolhe a sua): aqui o pacote é recusado.
    if zip.has_duplicate_names() {
        return Err(erro("zip_repetido", &[]));
    }
    if zip.len() > lim.entradas {
        return Err(erro("zip_muitos_arquivos", &[]));
    }

    // 1ª passada: só os nomes e os tamanhos declarados, sem descompactar nada.
    let mut svgs: Vec<(u32, Variante, usize)> = Vec::new();
    let mut declarado: u64 = 0;
    for i in 0..zip.len() {
        let f = zip.by_index_raw(i).map_err(invalido)?;
        // Um nome que não é UTF-8 válido nunca é um dos nomes exatos aceitos.
        let nome = match f.name() {
            Ok(n) => n.into_owned(),
            Err(_) => {
                return Err(erro(
                    "zip_inesperado",
                    &[curto(&String::from_utf8_lossy(f.name_raw()))],
                ));
            }
        };
        let tipo = classificar(&nome).ok_or_else(|| erro("zip_inesperado", &[curto(&nome)]))?;
        declarado = declarado.saturating_add(f.size());
        match tipo {
            Entrada::Pasta => {}
            Entrada::Svg(n, v) => svgs.push((n, v, i)),
        }
    }
    if declarado > lim.descompactado {
        return Err(erro("zip_descompactado_grande", &[]));
    }
    if svgs.is_empty() {
        return Err(erro("partituras_nenhuma", &[]));
    }

    // As partituras valem para o hinário que já está instalado: é dele que vêm os números de hino aceitos e a marca da pasta.
    let hinario = hinario::instalado(dir)?.ok_or_else(|| erro("partituras_sem_hinario", &[]))?;
    let hinos: HashSet<u32> = hinario.hinos.iter().map(|h| h.numero).collect();

    std::fs::create_dir_all(dir).map_err(gravar)?;
    let novo = dir.join("partituras.novo");
    let preparo = preparar(
        &mut zip,
        &svgs,
        &hinos,
        &novo,
        &marca(&hinario.hinario.id),
        lim,
        progresso,
    );
    let (mut aceitas, recusadas) = match preparo {
        Ok(r) => r,
        Err(e) => {
            std::fs::remove_dir_all(&novo).ok();
            return Err(e);
        }
    };

    // Troca: o que já havia só sai agora que tudo o que vai entrar está pronto. Se nenhuma partitura foi aceita (todas recusadas), as
    // que já estavam instaladas ficam como estão.
    if aceitas.is_empty() {
        sem_erro_se_nao_existe(std::fs::remove_dir_all(&novo)).map_err(gravar)?;
    } else {
        let troca = (|| -> Result<(), String> {
            sem_erro_se_nao_existe(std::fs::remove_dir_all(dir.join("partituras")))
                .map_err(gravar)?;
            std::fs::rename(&novo, dir.join("partituras")).map_err(gravar)
        })();
        if let Err(e) = troca {
            std::fs::remove_dir_all(&novo).ok();
            return Err(e);
        }
    }
    // O 100% só sai agora: a limpeza, a gravação da marca e a troca da pasta já terminaram. Nos caminhos de erro nenhum 100% é enviado.
    let tratadas = svgs.len() as u32;
    progresso(tratadas, tratadas);

    aceitas.sort_unstable();
    // Depois da troca, o que está instalado é EXATAMENTE o que foi aceito: não se relê o disco (uma falha de leitura aqui devolveria erro
    // com as partituras novas já no lugar, e a tela ficaria diferente do que está instalado). Só quando nada foi trocado (todas recusadas)
    // é preciso ler o que já havia, e aí nada mudou no disco.
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
        },
        recusadas,
    })
}

/// Limpa cada SVG e grava os aceitos na pasta de preparo (um por vez, para não segurar tudo na memória).
fn preparar(
    zip: &mut ZipArchive<Cursor<&[u8]>>,
    svgs: &[(u32, Variante, usize)],
    hinos: &HashSet<u32>,
    novo: &Path,
    marca: &str,
    lim: &Limites,
    progresso: &mut dyn FnMut(u32, u32),
) -> Result<(Vec<u32>, Vec<Recusada>), String> {
    sem_erro_se_nao_existe(std::fs::remove_dir_all(novo)).map_err(gravar)?; // sobra de uma importação interrompida
    std::fs::create_dir(novo).map_err(gravar)?;
    let mut aceitas = Vec::new(); // os hinos cujo RETRATO entrou (é o que conta como "partitura instalada")
    let mut recusadas = Vec::new();
    let mut lido: u64 = 0;
    let mut ordem: Vec<(u32, Variante, usize)> = svgs.to_vec();
    ordem.sort_unstable(); // por hino e, dentro dele, o retrato antes da paisagem
    let total = ordem.len() as u32;
    for (pos, (n, variante, i)) in ordem.into_iter().enumerate() {
        // Avisa a cada 10 partituras (são ~960: perto de cem avisos, sem encher o canal).
        if pos % 10 == 0 {
            progresso(pos as u32, total);
        }
        // A recusa da paisagem diz que é a paisagem (o mesmo número de hino pode aparecer duas vezes na lista).
        let recusa = |motivo: String| Recusada {
            numero: n,
            motivo: match variante {
                Variante::Retrato => motivo,
                Variante::Paisagem => format!("(paisagem) {motivo}"),
            },
        };
        // A paisagem de um hino cujo retrato veio no zip e NÃO entrou (o hinário não tem o hino, ou o retrato foi recusado por outro motivo)
        // é pulada em silêncio: o retrato já deixou o hino nas recusadas, com o motivo verdadeiro. Contá-lo duas vezes aparece na tela como
        // "hinos 77, 77".
        if variante == Variante::Paisagem
            && !aceitas.contains(&n)
            && svgs
                .iter()
                .any(|&(m, v, _)| m == n && v == Variante::Retrato)
        {
            continue;
        }
        if !hinos.contains(&n) {
            recusadas.push(recusa("o hinário não tem esse hino".into()));
            continue;
        }
        // Chegou aqui uma paisagem SEM retrato no zip: recusada, e uma vez só.
        if variante == Variante::Paisagem && !aceitas.contains(&n) {
            recusadas.push(recusa("falta a versão de retrato deste hino".into()));
            continue;
        }
        let bytes = match ler_entrada(zip, i, lim.svg) {
            Ok(b) => b,
            Err(Falha::GrandeDemais) => {
                recusadas.push(recusa(format!("passa de {} MiB", lim.svg / MIB)));
                continue;
            }
            Err(Falha::Zip(e)) => return Err(invalido(e)),
        };
        lido += bytes.len() as u64;
        if lido > lim.descompactado {
            return Err(erro("zip_descompactado_grande", &[]));
        }
        let Ok(texto) = String::from_utf8(bytes) else {
            recusadas.push(recusa("o texto não é UTF-8".into()));
            continue;
        };
        match svg::limpar(&texto) {
            Ok(limpo) => {
                std::fs::write(novo.join(variante.arquivo(n)), limpo).map_err(gravar)?;
                if variante == Variante::Retrato {
                    aceitas.push(n);
                }
            }
            Err(motivo) => recusadas.push(recusa(motivo)),
        }
    }
    if !aceitas.is_empty() {
        std::fs::write(novo.join(".hinario"), marca).map_err(gravar)?;
    }
    Ok((aceitas, recusadas))
}

/// A marca de `partituras/` (o `id` do hinário a que pertencem), ou `None` se não há marca. **Só** a falta do arquivo é "sem
/// marca": qualquer outra falha de leitura (permissão, erro de E/S) é um erro, e quem decide apagar algo não pode confundi-la
/// com "é de outro hinário".
fn ler_marca(pasta: &Path) -> Result<Option<String>, String> {
    let arquivo = pasta.join(".hinario");
    match std::fs::read_to_string(&arquivo) {
        Ok(t) => Ok(Some(t)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(erro("ler", &[format!("{}: {e}", arquivo.display())])),
    }
}

/// Números dos hinos com partitura instalada, em ordem; vazio se a pasta não pertence ao hinário `id`. Uma pasta que não
/// pode ser lida é um erro, e não uma lista vazia (a tela mostraria "sem partitura" sem dizer por quê).
pub fn numeros(dir: &Path, id: &str) -> Result<Vec<u32>, String> {
    let pasta = dir.join("partituras");
    if ler_marca(&pasta)?.as_deref() != Some(marca(id).as_str()) {
        return Ok(Vec::new());
    }
    let falha = |e: std::io::Error| erro("ler", &[format!("{}: {e}", pasta.display())]);
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
            .map_err(|e| erro("remover", &[e.to_string()]))?;
    }
    Ok(())
}

/// O SVG (já limpo na importação, e limpo de novo aqui: o arquivo fica numa pasta que o app não é o único a poder tocar) do hino
/// `numero`, na versão da tela: `paisagem` pede a versão larga, e se o pacote não a trouxe vale a de retrato. O arquivo é aberto uma
/// vez e lido só até o limite (nada de olhar o tamanho e ler depois: ele pode mudar entre as duas coisas).
pub fn ler_partitura(dir: &Path, numero: u32, paisagem: bool) -> Result<String, String> {
    let limite = Limites::default().svg;
    let ordem: &[Variante] = if paisagem {
        &[Variante::Paisagem, Variante::Retrato]
    } else {
        &[Variante::Retrato]
    };
    for variante in ordem {
        let arquivo = dir.join("partituras").join(variante.arquivo(numero));
        let falha = |e: std::io::Error| erro("ler", &[format!("{}: {e}", arquivo.display())]);
        let aberto = match std::fs::File::open(&arquivo) {
            Ok(f) => f,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => continue,
            Err(e) => return Err(falha(e)),
        };
        let invalida = |motivo: String| erro("partitura_invalida", &[numero.to_string(), motivo]);
        let mut bytes = Vec::new();
        aberto
            .take(limite + 1)
            .read_to_end(&mut bytes)
            .map_err(falha)?;
        if bytes.len() as u64 > limite {
            return Err(invalida(format!("passa de {} MiB", limite / MIB)));
        }
        let texto = String::from_utf8(bytes).map_err(|_| invalida("o texto não é UTF-8".into()))?;
        return svg::limpar(&texto).map_err(invalida);
    }
    Err(erro("sem_partitura", &[numero.to_string()]))
}

#[cfg(test)]
mod testes {
    use super::*;
    use std::io::Write;
    use zip::write::SimpleFileOptions;

    const SVG: &str = r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><g class="a"><path d="M0 0L1 1"/></g></svg>"##;
    /// Outro desenho (a versão larga), para saber qual das duas foi lida.
    const SVG_LARGO: &str = r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 10"><g class="larga"><path d="M0 0L9 9"/></g></svg>"##;
    const JSON: &str = r#"{"versao":1,"hinario":{"id":"x","nome":"X"},"hinos":[{"numero":1,"titulo":"A"},{"numero":2,"titulo":"B"},{"numero":283,"titulo":"C"}]}"#;

    fn dir_teste(nome: &str) -> std::path::PathBuf {
        let d = std::env::temp_dir().join(format!("bm_pacote_{nome}_{}", std::process::id()));
        std::fs::remove_dir_all(&d).ok();
        d
    }

    /// Um diretório com o hinário (`JSON`, id "x", hinos 1, 2 e 283) já instalado: as partituras só entram para um hinário instalado.
    fn dir_com_hinario(nome: &str) -> std::path::PathBuf {
        let d = dir_teste(nome);
        hinario::importar(&d, JSON).unwrap();
        d
    }

    fn args(e: &str) -> Vec<String> {
        serde_json::from_str(e).unwrap_or_else(|_| panic!("erro não é um JSON de códigos: {e}"))
    }

    fn codigo(e: &str) -> String {
        args(e)[0].clone()
    }

    /// Monta um zip com os arquivos dados (nome, conteúdo), na ordem dada.
    fn zip_de(arquivos: &[(&str, &str)]) -> Vec<u8> {
        let mut w = zip::ZipWriter::new(Cursor::new(Vec::new()));
        for (nome, conteudo) in arquivos {
            if nome.ends_with('/') {
                w.add_directory(*nome, SimpleFileOptions::default())
                    .unwrap();
            } else {
                w.start_file(*nome, SimpleFileOptions::default()).unwrap();
                w.write_all(conteudo.as_bytes()).unwrap();
            }
        }
        w.finish().unwrap().into_inner()
    }

    /// O mesmo pacote, com a versão de paisagem de cada partitura.
    fn pacote_com_paisagem() -> Vec<u8> {
        zip_de(&[
            ("partituras/hino-1.svg", SVG),
            ("partituras/hino-1-paisagem.svg", SVG_LARGO),
            ("partituras/hino-283.svg", SVG),
            ("partituras/hino-283-paisagem.svg", SVG_LARGO),
        ])
    }

    fn pacote_ok() -> Vec<u8> {
        zip_de(&[
            ("partituras/", ""),
            ("partituras/hino-1.svg", SVG),
            ("partituras/hino-283.svg", SVG),
        ])
    }

    /// Confere um hinário e um pacote REAIS (os do responsável, que não vão para o Git): `BM_HINARIO` (o `.json`) e `BM_ZIP`
    /// (o pacote de partituras). Passa o hinário pelo leitor e cada SVG pela limpeza do app, e falha se alguma partitura for recusada ou
    /// não puder ser lida de volta. Fora do `cargo test` normal:
    /// `BM_HINARIO=... BM_ZIP=... cargo test --lib conteudo_real -- --ignored --nocapture`.
    #[test]
    #[ignore = "precisa dos arquivos reais (BM_HINARIO e BM_ZIP)"]
    fn conteudo_real() {
        let json =
            std::fs::read_to_string(std::env::var("BM_HINARIO").expect("BM_HINARIO")).unwrap();
        let zip = std::fs::read(std::env::var("BM_ZIP").expect("BM_ZIP")).unwrap();
        let d = dir_teste("real");
        let p = hinario::importar(&d, &json).unwrap();
        println!("hinário lido: {} hinos", p.hinario.hinos.len());
        let r = importar_zip(&d, &zip).unwrap();
        println!(
            "partituras importadas: {}; recusadas: {}",
            r.partituras,
            r.recusadas.len()
        );
        for x in r.recusadas.iter().take(40) {
            println!("  recusada {}: {}", x.numero, x.motivo);
        }
        let numeros = numeros(&d, &p.hinario.hinario.id).unwrap();
        let mut falhas = 0;
        for n in &numeros {
            for paisagem in [false, true] {
                if let Err(e) = ler_partitura(&d, *n, paisagem) {
                    println!("  leitura falhou: hino {n}, paisagem={paisagem}: {e}");
                    falhas += 1;
                }
            }
        }
        println!(
            "hinos com partitura: {}; leituras com falha: {falhas}",
            numeros.len()
        );
        // a pasta de teste guarda o hinário e as partituras limpas (dezenas de MB): sai antes do assert, para valer também na falha
        std::fs::remove_dir_all(&d).ok();
        assert!(
            r.partituras > 0 && !numeros.is_empty(),
            "nenhuma partitura importada"
        );
        assert!(r.recusadas.is_empty() && falhas == 0);
    }

    fn arquivos(dir: &Path) -> Vec<String> {
        let mut v = Vec::new();
        fn anda(base: &Path, p: &Path, v: &mut Vec<String>) {
            for e in std::fs::read_dir(p).into_iter().flatten().flatten() {
                let caminho = e.path();
                v.push(
                    caminho
                        .strip_prefix(base)
                        .unwrap()
                        .to_string_lossy()
                        .into_owned(),
                );
                if caminho.is_dir() {
                    anda(base, &caminho, v);
                }
            }
        }
        anda(dir, dir, &mut v);
        v.sort();
        v
    }

    // ---- nomes ----

    #[test]
    fn classifica_so_os_nomes_exatos() {
        // a versão de paisagem (opcional), do mesmo jeito: número canônico
        assert_eq!(
            classificar("partituras/hino-1-paisagem.svg"),
            Some(Entrada::Svg(1, Variante::Paisagem))
        );
        assert_eq!(
            classificar("partituras/hino-283-paisagem.svg"),
            Some(Entrada::Svg(283, Variante::Paisagem))
        );
        for ruim in [
            "partituras/hino-0-paisagem.svg",
            "partituras/hino-01-paisagem.svg",
            "partituras/hino--paisagem.svg",
            "partituras/hino-1-Paisagem.svg",
            "partituras/hino-1-paisagem.SVG",
            "partituras/hino-1-paisagem.svg.bak",
            "partituras/hino-1-retrato.svg",
            "partituras/hino-1-paisagem-paisagem.svg",
            "partituras/hino-1paisagem.svg",
            "partituras/hino-1_paisagem.svg",
            "partituras/hino-1-paisagem",
            "partituras/sub/hino-1-paisagem.svg",
            "partituras/hino-1000000000-paisagem.svg",
        ] {
            assert_eq!(classificar(ruim), None, "{ruim:?}");
        }
        // o zip é só de partituras: o hinario.json NÃO é um nome aceito
        assert_eq!(classificar("hinario.json"), None);
        assert_eq!(classificar("partituras/"), Some(Entrada::Pasta));
        assert_eq!(
            classificar("partituras/hino-1.svg"),
            Some(Entrada::Svg(1, Variante::Retrato))
        );
        assert_eq!(
            classificar("partituras/hino-283.svg"),
            Some(Entrada::Svg(283, Variante::Retrato))
        );
        assert_eq!(
            classificar("partituras/hino-999999999.svg"),
            Some(Entrada::Svg(999_999_999, Variante::Retrato))
        );
        for ruim in [
            "",
            "/",
            "hinario.json/",
            "Hinario.json",
            "hinario.json.bak",
            "./hinario.json",
            "/hinario.json",
            "../hinario.json",
            "x/hinario.json",
            "partituras",
            "partituras//",
            "partituras/hino-0.svg",
            "partituras/hino-01.svg",
            "partituras/hino-1.SVG",
            "partituras/hino-1.svg ",
            "partituras/hino-.svg",
            "partituras/hino--1.svg",
            "partituras/hino-+1.svg",
            "partituras/hino-1e3.svg",
            "partituras/hino-1000000000.svg",
            "partituras/hino-١.svg",
            "partituras/../hino-1.svg",
            "partituras/x/hino-1.svg",
            "partituras/hino-1.svg/",
            "partituras\\hino-1.svg",
            "partituras/hino-1.svg\0",
            "partituras/hino-1.timemap.json",
            "partituras/.hinario",
            "partituras/Leipzig.woff2",
        ] {
            assert_eq!(classificar(ruim), None, "{ruim:?}");
        }
    }

    // ---- importação ----

    #[test]
    fn importa_json_e_partituras() {
        let d = dir_com_hinario("ok");
        let r = importar_zip(&d, &pacote_ok()).unwrap();
        assert_eq!(r.partituras, 2);
        assert!(r.recusadas.is_empty());
        assert_eq!(r.pacote.partituras, vec![1, 283]);
        assert!(!r.pacote.exemplo && r.pacote.hinario.hinos.len() == 3);
        assert_eq!(
            arquivos(&d),
            [
                "hinario.json",
                "partituras",
                "partituras/.hinario",
                "partituras/hino-1.svg",
                "partituras/hino-283.svg"
            ]
        );
        // o app relê tudo do disco
        let lido = hinario::carregar(Some(&d)).unwrap();
        assert_eq!(lido.partituras, vec![1, 283]);
        // e o SVG gravado é o reescrito
        assert!(
            std::fs::read_to_string(d.join("partituras/hino-1.svg"))
                .unwrap()
                .starts_with("<svg xmlns=")
        );
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn importar_avisa_o_andamento_da_primeira_a_ultima_partitura() {
        let d = dir_com_hinario("andamento");
        // 25 arquivos: o aviso sai a cada 10 (posições 0, 10 e 20) e fecha com (total, total).
        let nomes: Vec<String> = (1..=25)
            .map(|n| format!("partituras/hino-{n}.svg"))
            .collect();
        let arquivos: Vec<(&str, &str)> = nomes.iter().map(|n| (n.as_str(), SVG)).collect();
        let z = zip_de(&arquivos);
        let texto = STANDARD.encode(&z);
        let mut avisos: Vec<(u32, u32)> = Vec::new();
        importar_base64_progresso(&d, &texto, &mut |feito, total| avisos.push((feito, total)))
            .unwrap();
        assert_eq!(avisos, vec![(0, 25), (10, 25), (20, 25), (25, 25)]);
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn o_que_fica_no_disco_e_o_svg_reescrito_e_nao_o_original() {
        let d = dir_com_hinario("reescrito");
        let original = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <g>\n    <path d=\"M0 0\"/>\n  </g>\n</svg>\n".to_string();
        let z = zip_de(&[("partituras/hino-1.svg", &original)]);
        importar_zip(&d, &z).unwrap();
        let gravado = std::fs::read_to_string(d.join("partituras/hino-1.svg")).unwrap();
        assert_eq!(gravado, svg::limpar(&original).unwrap());
        assert!(
            !gravado.contains("<?xml") && !gravado.contains("xlink") && !gravado.contains('\n'),
            "{gravado}"
        );
        std::fs::remove_dir_all(&d).ok();
    }

    // ---- base64 (a forma como a interface manda o zip) ----

    #[test]
    fn importa_o_zip_em_base64() {
        let d = dir_com_hinario("base64_ok");
        let texto = STANDARD.encode(pacote_ok());
        let r = importar_base64(&d, &texto).unwrap();
        assert_eq!(r.partituras, 2);
        assert_eq!(r.pacote.partituras, vec![1, 283]);
        assert_eq!(
            hinario::carregar(Some(&d)).unwrap().partituras,
            vec![1, 283]
        );
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn base64_aceita_espaco_nas_pontas_e_recusa_o_que_nao_e_base64() {
        let d = dir_com_hinario("base64_forma");
        let texto = STANDARD.encode(pacote_ok());
        assert!(importar_base64(&d, &format!("  {texto}\n")).is_ok());
        for ruim in [
            "@@@@",
            "abc",
            "YWJj ZGVm",
            "Zm9v!",
            "\u{e9}\u{e9}\u{e9}\u{e9}",
        ] {
            let e = importar_base64(&dir_com_hinario("base64_ruim"), ruim).unwrap_err();
            assert_eq!(codigo(&e), "zip_invalido", "{ruim:?} -> {e}");
        }
        // vazio decodifica para zero bytes, que não são um zip
        assert_eq!(
            codigo(&importar_base64(&d, "").unwrap_err()),
            "zip_invalido"
        );
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn base64_confere_o_tamanho_do_texto_antes_de_decodificar() {
        let d = dir_com_hinario("base64_tamanho");
        let lim = Limites {
            zip: 10,
            ..Limites::default()
        };
        // 200 caracteres que NÃO são base64: se decodificasse primeiro, o erro seria zip_invalido
        let e = importar_base64_com(&d, &"@".repeat(200), &lim).unwrap_err();
        assert_eq!(codigo(&e), "zip_grande_demais");
        assert_eq!(arquivos(&d), ["hinario.json"], "nada é tocado");
    }

    #[test]
    fn o_gate_do_texto_base64_fica_exatamente_em_4_para_cada_3_bytes_mais_o_preenchimento() {
        // zip de 30 bytes = 10 grupos de 3 = 40 caracteres, mais 4 de folga para o preenchimento "=": o gate é 44. Texto que NÃO é
        // base64: passar do gate dá "zip_grande_demais" (recusado antes de decodificar); ficar nele dá "zip_invalido" (decodificou e falhou).
        let lim = Limites {
            zip: 30,
            ..Limites::default()
        };
        let d = dir_com_hinario("gate_borda");
        let ate = |n: usize| importar_base64_com(&d, &"@".repeat(n), &lim).unwrap_err();
        assert_eq!(
            codigo(&ate(44)),
            "zip_invalido",
            "44 caracteres passam o gate"
        );
        assert_eq!(
            codigo(&ate(45)),
            "zip_grande_demais",
            "45 já passam do gate"
        );
        assert_eq!(codigo(&ate(60)), "zip_grande_demais");
        assert_eq!(codigo(&ate(1)), "zip_invalido");
    }

    #[test]
    fn base64_no_limite_do_zip_passa_e_um_byte_a_mais_nao() {
        let d = dir_com_hinario("base64_limite");
        let z = pacote_ok();
        let lim = Limites {
            zip: z.len(),
            ..Limites::default()
        };
        assert!(importar_base64_com(&d, &STANDARD.encode(&z), &lim).is_ok());
        let mais = [z.clone(), vec![0]].concat();
        let e = importar_base64_com(
            &dir_com_hinario("base64_limite2"),
            &STANDARD.encode(&mais),
            &lim,
        )
        .unwrap_err();
        assert_eq!(codigo(&e), "zip_grande_demais");
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn zip_sem_nenhuma_partitura_e_recusado() {
        let d = dir_com_hinario("sem_svg");
        for z in [zip_de(&[]), zip_de(&[("partituras/", "")])] {
            let e = importar_zip(&d, &z).unwrap_err();
            assert_eq!(codigo(&e), "partituras_nenhuma", "{e}");
        }
        assert_eq!(arquivos(&d), ["hinario.json"]);
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn svg_que_nao_passa_na_limpeza_e_recusado_e_o_resto_entra() {
        let d = dir_com_hinario("recusa");
        let z = zip_de(&[
            ("partituras/hino-1.svg", SVG),
            (
                "partituras/hino-2.svg",
                r#"<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>"#,
            ),
            ("partituras/hino-283.svg", "não é xml"),
        ]);
        let r = importar_zip(&d, &z).unwrap();
        assert_eq!(r.partituras, 1);
        assert_eq!(r.pacote.partituras, vec![1]);
        assert_eq!(r.recusadas.len(), 2);
        assert_eq!(r.recusadas[0].numero, 2);
        assert!(
            r.recusadas[0].motivo.contains("<script>"),
            "{:?}",
            r.recusadas
        );
        assert_eq!(r.recusadas[1].numero, 283);
        assert!(r.recusadas[1].motivo.contains("XML inválido"));
        assert!(
            !d.join("partituras/hino-2.svg").exists()
                && !d.join("partituras/hino-283.svg").exists()
        );
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn svg_de_hino_que_o_hinario_nao_tem_e_recusado() {
        let d = dir_com_hinario("sem_hino");
        let z = zip_de(&[
            ("partituras/hino-1.svg", SVG),
            ("partituras/hino-77.svg", SVG),
        ]);
        let r = importar_zip(&d, &z).unwrap();
        assert_eq!(r.pacote.partituras, vec![1]);
        assert_eq!(
            r.recusadas,
            vec![Recusada {
                numero: 77,
                motivo: "o hinário não tem esse hino".into()
            }]
        );
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn nenhuma_partitura_aceita_nao_deixa_pasta_nem_marca() {
        let d = dir_com_hinario("nenhuma");
        let z = zip_de(&[("partituras/hino-1.svg", "x")]);
        let r = importar_zip(&d, &z).unwrap();
        assert_eq!(r.partituras, 0);
        assert_eq!(r.recusadas.len(), 1);
        assert_eq!(arquivos(&d), ["hinario.json"]);
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn nome_inesperado_recusa_o_pacote_inteiro_sem_gravar_nada() {
        for ruim in [
            "../evil.svg",
            "partituras/../x.svg",
            "/abs.svg",
            "hinario.json.bak",
            "partituras/sub/hino-1.svg",
            "partituras/hino-01.svg",
            "partituras/hino-1.SVG",
            "partituras\\hino-1.svg",
            "leia-me.txt",
            "partituras/hino-1.timemap.json",
            "hinario.json",
        ] {
            let d = dir_com_hinario("inesperado");
            let z = zip_de(&[("partituras/hino-1.svg", SVG), (ruim, "x")]);
            let e = importar_zip(&d, &z).unwrap_err();
            assert_eq!(
                args(&e),
                vec!["zip_inesperado".to_string(), ruim.to_string()],
                "{ruim}"
            );
            assert_eq!(arquivos(&d), ["hinario.json"], "{ruim}");
            std::fs::remove_dir_all(&d).ok();
        }
    }

    #[test]
    fn nome_repetido_recusa_o_pacote() {
        let d = dir_com_hinario("repetido");
        // "hino-2" e "hino-1" têm o mesmo tamanho: trocar os bytes do nome (na entrada e no diretório central) duplica a entrada.
        let z = zip_de(&[
            ("partituras/hino-1.svg", SVG),
            ("partituras/hino-2.svg", SVG),
        ]);
        let mut z = z;
        let alvo = b"hino-2";
        let mut achou = 0;
        for i in 0..z.len() - alvo.len() {
            if &z[i..i + alvo.len()] == alvo {
                z[i..i + alvo.len()].copy_from_slice(b"hino-1");
                achou += 1;
            }
        }
        assert_eq!(achou, 2, "o nome aparece na entrada e no diretório central");
        let e = importar_zip(&d, &z).unwrap_err();
        assert_eq!(codigo(&e), "zip_repetido", "{e}");
        assert_eq!(arquivos(&d), ["hinario.json"]);
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn zip_ruim_nao_grava_nada() {
        let d = dir_com_hinario("zip_ruim");
        for lixo in [&b""[..], b"nao e zip", b"PK\x03\x04quebrado", &[0u8; 64]] {
            assert_eq!(codigo(&importar_zip(&d, lixo).unwrap_err()), "zip_invalido");
        }
        assert_eq!(arquivos(&d), ["hinario.json"]);
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn sem_hinario_instalado_nao_importa_e_nao_grava_nada() {
        // as partituras valem para um hinário: sem ele não há como saber a que hinos pertencem
        let d = dir_teste("sem_hinario");
        let e = importar_zip(&d, &pacote_ok()).unwrap_err();
        assert_eq!(codigo(&e), "partituras_sem_hinario", "{e}");
        assert!(!d.exists() || arquivos(&d).is_empty(), "{:?}", arquivos(&d));
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn importar_partituras_nao_mexe_no_hinario_instalado() {
        let d = dir_com_hinario("hinario_intacto");
        let antes = std::fs::read(d.join("hinario.json")).unwrap();
        importar_zip(&d, &pacote_ok()).unwrap();
        assert_eq!(std::fs::read(d.join("hinario.json")).unwrap(), antes);
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn importar_de_novo_troca_as_partituras_antigas() {
        let d = dir_com_hinario("troca");
        importar_zip(&d, &pacote_ok()).unwrap();
        let z = zip_de(&[("partituras/hino-2.svg", SVG)]);
        let r = importar_zip(&d, &z).unwrap();
        assert_eq!(r.pacote.partituras, vec![2]);
        assert_eq!(
            arquivos(&d),
            [
                "hinario.json",
                "partituras",
                "partituras/.hinario",
                "partituras/hino-2.svg"
            ]
        );
        // um zip sem nenhuma partitura é recusado e as que já estavam ficam
        assert_eq!(
            codigo(&importar_zip(&d, &zip_de(&[])).unwrap_err()),
            "partituras_nenhuma"
        );
        assert_eq!(numeros(&d, "x").unwrap(), vec![2]);
        // todas as partituras do zip recusadas: também ficam as que já estavam
        let ruim = zip_de(&[
            ("partituras/hino-77.svg", SVG),
            ("partituras/hino-1.svg", "nao e svg"),
        ]);
        let r = importar_zip(&d, &ruim).unwrap();
        assert_eq!((r.partituras, r.recusadas.len()), (0, 2));
        assert_eq!(r.pacote.partituras, vec![2]);
        assert_eq!(numeros(&d, "x").unwrap(), vec![2]);
        assert!(!d.join("partituras.novo").exists());
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn sobra_de_importacao_interrompida_e_limpa() {
        let d = dir_com_hinario("sobra");
        std::fs::create_dir_all(d.join("partituras.novo")).unwrap();
        std::fs::write(d.join("partituras.novo/hino-9.svg"), "lixo").unwrap();
        importar_zip(&d, &pacote_ok()).unwrap();
        assert!(!d.join("partituras.novo").exists());
        assert!(!d.join("partituras/hino-9.svg").exists());
        assert!(!d.join("hinario.json.tmp").exists());
        std::fs::remove_dir_all(&d).ok();
    }

    // ---- versões de retrato e de paisagem ----

    #[test]
    fn importa_as_duas_versoes_e_a_contagem_e_de_hinos() {
        let d = dir_com_hinario("variantes");
        let r = importar_zip(&d, &pacote_com_paisagem()).unwrap();
        assert_eq!(
            r.partituras, 2,
            "duas partituras (hinos), e não quatro arquivos"
        );
        assert_eq!(r.pacote.partituras, vec![1, 283]);
        assert!(r.recusadas.is_empty());
        assert_eq!(
            arquivos(&d),
            [
                "hinario.json",
                "partituras",
                "partituras/.hinario",
                "partituras/hino-1-paisagem.svg",
                "partituras/hino-1.svg",
                "partituras/hino-283-paisagem.svg",
                "partituras/hino-283.svg"
            ]
        );
        // o app relê do disco: a lista de hinos não duplica
        assert_eq!(
            hinario::carregar(Some(&d)).unwrap().partituras,
            vec![1, 283]
        );
        assert_eq!(numeros(&d, "x").unwrap(), vec![1, 283]);
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn le_a_versao_pedida_e_a_paisagem_ausente_volta_para_o_retrato() {
        let d = dir_com_hinario("le_variante");
        importar_zip(&d, &pacote_com_paisagem()).unwrap();
        let retrato = ler_partitura(&d, 1, false).unwrap();
        let paisagem = ler_partitura(&d, 1, true).unwrap();
        assert!(
            retrato.contains("viewBox=\"0 0 10 10\"") && !retrato.contains("larga"),
            "{retrato}"
        );
        assert!(
            paisagem.contains("viewBox=\"0 0 30 10\"") && paisagem.contains("larga"),
            "{paisagem}"
        );
        // sem a paisagem no pacote: a de retrato serve nas duas telas
        importar_zip(&d, &zip_de(&[("partituras/hino-2.svg", SVG)])).unwrap();
        assert_eq!(
            ler_partitura(&d, 2, true).unwrap(),
            ler_partitura(&d, 2, false).unwrap()
        );
        // e sem o hino, nenhuma das duas
        for paisagem in [false, true] {
            assert_eq!(
                codigo(&ler_partitura(&d, 1, paisagem).unwrap_err()),
                "sem_partitura"
            );
        }
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn so_com_a_paisagem_a_partitura_e_recusada_e_o_retrato_nao_e_inventado() {
        let d = dir_com_hinario("so_paisagem");
        let z = zip_de(&[
            ("partituras/hino-1-paisagem.svg", SVG_LARGO),
            ("partituras/hino-2.svg", SVG),
        ]);
        let r = importar_zip(&d, &z).unwrap();
        assert_eq!(r.pacote.partituras, vec![2]);
        assert_eq!(r.recusadas.len(), 1);
        assert_eq!(r.recusadas[0].numero, 1);
        assert!(
            r.recusadas[0].motivo.starts_with("(paisagem)"),
            "{:?}",
            r.recusadas
        );
        assert!(
            r.recusadas[0].motivo.contains("retrato"),
            "{:?}",
            r.recusadas
        );
        assert!(!d.join("partituras/hino-1-paisagem.svg").exists());
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn paisagem_que_nao_passa_na_limpeza_e_recusada_mas_o_retrato_entra() {
        let d = dir_com_hinario("paisagem_ruim");
        let z = zip_de(&[
            ("partituras/hino-1.svg", SVG),
            (
                "partituras/hino-1-paisagem.svg",
                r#"<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>"#,
            ),
        ]);
        let r = importar_zip(&d, &z).unwrap();
        assert_eq!(r.pacote.partituras, vec![1]);
        assert_eq!(r.recusadas.len(), 1);
        assert!(
            r.recusadas[0].motivo.starts_with("(paisagem)")
                && r.recusadas[0].motivo.contains("<script>"),
            "{:?}",
            r.recusadas
        );
        assert!(
            d.join("partituras/hino-1.svg").exists()
                && !d.join("partituras/hino-1-paisagem.svg").exists()
        );
        // sem a paisagem, a leitura em tela larga cai no retrato
        assert_eq!(
            ler_partitura(&d, 1, true).unwrap(),
            ler_partitura(&d, 1, false).unwrap()
        );
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn paisagem_de_hino_que_o_hinario_nao_tem_e_recusada() {
        let d = dir_com_hinario("paisagem_sem_hino");
        let z = zip_de(&[
            ("partituras/hino-1.svg", SVG),
            ("partituras/hino-77.svg", SVG),
            ("partituras/hino-77-paisagem.svg", SVG),
        ]);
        let r = importar_zip(&d, &z).unwrap();
        assert_eq!(r.pacote.partituras, vec![1]);
        // o hino 77 aparece UMA vez (pelo retrato); a paisagem dele é pulada, não contada de novo
        assert_eq!(r.recusadas.len(), 1);
        assert_eq!(r.recusadas[0].numero, 77);
        assert_eq!(r.recusadas[0].motivo, "o hinário não tem esse hino");
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn so_a_paisagem_de_hino_que_o_hinario_nao_tem_e_recusada_uma_vez() {
        let d = dir_com_hinario("so_paisagem_sem_hino");
        let z = zip_de(&[
            ("partituras/hino-1.svg", SVG),
            ("partituras/hino-77-paisagem.svg", SVG),
        ]);
        let r = importar_zip(&d, &z).unwrap();
        assert_eq!(r.pacote.partituras, vec![1]);
        assert_eq!(r.recusadas.len(), 1, "{:?}", r.recusadas);
        assert_eq!(r.recusadas[0].numero, 77);
        assert_eq!(
            r.recusadas[0].motivo,
            "(paisagem) o hinário não tem esse hino"
        );
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn retrato_recusado_nao_gera_uma_segunda_recusa_pela_paisagem() {
        // o retrato do hino 1 não passa na limpeza: uma recusa, com o motivo verdadeiro (e não "falta a versão de retrato")
        let d = dir_com_hinario("retrato_ruim");
        let z = zip_de(&[
            (
                "partituras/hino-1.svg",
                r#"<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>"#,
            ),
            ("partituras/hino-1-paisagem.svg", SVG_LARGO),
            ("partituras/hino-283.svg", SVG),
        ]);
        let r = importar_zip(&d, &z).unwrap();
        assert_eq!(r.pacote.partituras, vec![283]);
        assert_eq!(r.recusadas.len(), 1, "{:?}", r.recusadas);
        assert_eq!(r.recusadas[0].numero, 1);
        assert!(
            r.recusadas[0].motivo.contains("<script>")
                && !r.recusadas[0].motivo.contains("paisagem"),
            "{:?}",
            r.recusadas
        );
        assert!(!d.join("partituras/hino-1-paisagem.svg").exists());
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn a_paisagem_tambem_e_limpa_na_leitura_e_tem_o_limite_de_tamanho() {
        let d = dir_com_hinario("paisagem_adulterada");
        importar_zip(&d, &pacote_com_paisagem()).unwrap();
        std::fs::write(
            d.join("partituras/hino-1-paisagem.svg"),
            r#"<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>"#,
        )
        .unwrap();
        let e = ler_partitura(&d, 1, true).unwrap_err();
        assert_eq!(codigo(&e), "partitura_invalida");
        std::fs::write(
            d.join("partituras/hino-283-paisagem.svg"),
            vec![b'x'; (Limites::default().svg + 1) as usize],
        )
        .unwrap();
        let e = ler_partitura(&d, 283, true).unwrap_err();
        assert!(args(&e)[2].contains("passa de"), "{e}");
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn paisagem_solta_no_disco_sem_o_retrato_nao_conta_como_partitura() {
        // um arquivo de paisagem sem o retrato do mesmo hino (adulterado ou sobra) não faz o hino "ter partitura": a aba apareceria e a
        // leitura em retrato falharia
        let d = dir_com_hinario("paisagem_solta");
        importar_zip(&d, &pacote_com_paisagem()).unwrap();
        std::fs::write(d.join("partituras/hino-2-paisagem.svg"), SVG_LARGO).unwrap();
        assert_eq!(numeros(&d, "x").unwrap(), vec![1, 283]);
        std::fs::remove_file(d.join("partituras/hino-1.svg")).unwrap();
        assert_eq!(
            numeros(&d, "x").unwrap(),
            vec![283],
            "a paisagem do hino 1 continua lá, mas sozinha não conta"
        );
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn importar_de_novo_troca_as_duas_versoes_e_remover_apaga_tudo() {
        let d = dir_com_hinario("troca_variantes");
        importar_zip(&d, &pacote_com_paisagem()).unwrap();
        // um pacote só com retratos tira as paisagens antigas
        importar_zip(&d, &zip_de(&[("partituras/hino-1.svg", SVG)])).unwrap();
        assert_eq!(
            arquivos(&d),
            [
                "hinario.json",
                "partituras",
                "partituras/.hinario",
                "partituras/hino-1.svg"
            ]
        );
        importar_zip(&d, &pacote_com_paisagem()).unwrap();
        assert!(
            hinario::remover_partituras(&d)
                .unwrap()
                .partituras
                .is_empty()
        );
        assert_eq!(arquivos(&d), ["hinario.json"]);
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn os_limites_contam_os_dois_arquivos_de_cada_hino() {
        let d = dir_com_hinario("lim_variantes");
        let z = pacote_com_paisagem(); // 4 arquivos
        assert!(
            importar_zip_com(
                &d,
                &z,
                &Limites {
                    entradas: 4,
                    ..pequenos()
                }
            )
            .is_ok()
        );
        let e = importar_zip_com(
            &d,
            &z,
            &Limites {
                entradas: 3,
                ..pequenos()
            },
        )
        .unwrap_err();
        assert_eq!(codigo(&e), "zip_muitos_arquivos");
        let total = (SVG.len() * 2 + SVG_LARGO.len() * 2) as u64;
        assert!(
            importar_zip_com(
                &d,
                &z,
                &Limites {
                    descompactado: total,
                    ..pequenos()
                }
            )
            .is_ok()
        );
        let e = importar_zip_com(
            &d,
            &z,
            &Limites {
                descompactado: total - 1,
                ..pequenos()
            },
        )
        .unwrap_err();
        assert_eq!(codigo(&e), "zip_descompactado_grande");
        std::fs::remove_dir_all(&d).ok();
    }

    // ---- limites ----

    fn pequenos() -> Limites {
        Limites {
            zip: 10_000,
            entradas: 4,
            descompactado: 5_000,
            svg: 1_000,
        }
    }

    #[test]
    fn zip_grande_demais() {
        let d = dir_com_hinario("lim_zip");
        let z = pacote_ok();
        let lim = Limites {
            zip: z.len() - 1,
            ..pequenos()
        };
        assert_eq!(
            codigo(&importar_zip_com(&d, &z, &lim).unwrap_err()),
            "zip_grande_demais"
        );
        let lim = Limites {
            zip: z.len(),
            ..pequenos()
        };
        assert!(importar_zip_com(&d, &z, &lim).is_ok());
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn arquivos_demais() {
        let d = dir_com_hinario("lim_entradas");
        let z = zip_de(&[
            ("partituras/hino-1.svg", SVG),
            ("partituras/hino-2.svg", SVG),
            ("partituras/hino-3.svg", SVG),
        ]);
        assert!(
            importar_zip_com(
                &d,
                &z,
                &Limites {
                    entradas: 3,
                    ..pequenos()
                }
            )
            .is_ok()
        );
        let e = importar_zip_com(
            &d,
            &z,
            &Limites {
                entradas: 2,
                ..pequenos()
            },
        )
        .unwrap_err();
        assert_eq!(codigo(&e), "zip_muitos_arquivos");
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn total_descompactado_alto_demais_recusa_antes_de_descompactar() {
        let d = dir_com_hinario("lim_total");
        let z = pacote_ok();
        let total = (SVG.len() * 2) as u64;
        assert!(
            importar_zip_com(
                &d,
                &z,
                &Limites {
                    descompactado: total,
                    ..pequenos()
                }
            )
            .is_ok()
        );
        let e = importar_zip_com(
            &d,
            &z,
            &Limites {
                descompactado: total - 1,
                ..pequenos()
            },
        )
        .unwrap_err();
        assert_eq!(codigo(&e), "zip_descompactado_grande");
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn svg_acima_do_limite_e_recusado_so_ele() {
        let d = dir_com_hinario("lim_svg");
        let grande = format!(
            r#"<svg xmlns="http://www.w3.org/2000/svg"><desc>{}</desc></svg>"#,
            "x".repeat(2_000)
        );
        let z = zip_de(&[
            ("partituras/hino-1.svg", SVG),
            ("partituras/hino-2.svg", &grande),
        ]);
        let lim = Limites {
            descompactado: 10_000,
            ..pequenos()
        };
        let r = importar_zip_com(&d, &z, &lim).unwrap();
        assert_eq!(r.pacote.partituras, vec![1]);
        assert_eq!(r.recusadas.len(), 1);
        assert_eq!(r.recusadas[0].numero, 2);
        assert!(
            r.recusadas[0].motivo.contains("passa de"),
            "{:?}",
            r.recusadas
        );
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn svg_no_limite_exato_entra_e_um_byte_a_mais_nao() {
        let d = dir_com_hinario("lim_exato");
        let lim = Limites {
            descompactado: 10_000,
            ..pequenos()
        };
        let com_tamanho = |bytes: usize| {
            let base = r#"<svg xmlns="http://www.w3.org/2000/svg"><desc></desc></svg>"#;
            format!(
                r#"<svg xmlns="http://www.w3.org/2000/svg"><desc>{}</desc></svg>"#,
                "x".repeat(bytes - base.len())
            )
        };
        let exato = com_tamanho(lim.svg as usize);
        assert_eq!(exato.len() as u64, lim.svg);
        let passa = zip_de(&[("partituras/hino-1.svg", &exato)]);
        assert_eq!(
            importar_zip_com(&d, &passa, &lim)
                .unwrap()
                .pacote
                .partituras,
            vec![1]
        );
        let passou = com_tamanho(lim.svg as usize + 1);
        let nao = zip_de(&[("partituras/hino-1.svg", &passou)]);
        let r = importar_zip_com(&d, &nao, &lim).unwrap();
        assert_eq!(r.partituras, 0);
        assert_eq!(r.recusadas.len(), 1);
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn cabecalho_que_mente_sobre_o_tamanho_nao_fura_o_limite() {
        // O tamanho declarado do SVG é trocado por 1 (no cabeçalho local e no diretório central), mas o conteúdo continua grande.
        // A biblioteca do zip recusa a entrada ("maior que o tamanho declarado"); se um dia deixasse passar, `ler_entrada` ainda
        // corta a leitura no limite (coberto por `svg_acima_do_limite_e_recusado_so_ele`). Em nenhum caso o SVG entra inteiro.
        let d = dir_com_hinario("mentira");
        let grande = format!(
            r#"<svg xmlns="http://www.w3.org/2000/svg"><desc>{}</desc></svg>"#,
            "x".repeat(3_000)
        );
        let mut z = zip_de(&[("partituras/hino-1.svg", &grande)]);
        let real = (grande.len() as u32).to_le_bytes();
        let falso = 1u32.to_le_bytes();
        let mut trocas = 0;
        for i in 0..z.len() - 4 {
            if z[i..i + 4] == real {
                z[i..i + 4].copy_from_slice(&falso);
                trocas += 1;
            }
        }
        assert!(
            trocas >= 2,
            "o tamanho aparece no cabeçalho local e no diretório central ({trocas})"
        );
        let lim = Limites {
            descompactado: 20_000,
            ..pequenos()
        };
        let e = importar_zip_com(&d, &z, &lim).unwrap_err();
        assert_eq!(codigo(&e), "zip_invalido", "{e}");
        assert!(!d.join("partituras/hino-1.svg").exists());
        assert_eq!(arquivos(&d), ["hinario.json"], "nada é gravado");
        std::fs::remove_dir_all(&d).ok();
    }

    // ---- JSON sozinho, remoção e leitura ----

    #[test]
    fn remover_so_as_partituras_mantem_o_hinario() {
        let d = dir_com_hinario("remover_so_partituras");
        importar_zip(&d, &pacote_ok()).unwrap();
        let p = hinario::remover_partituras(&d).unwrap();
        assert!(p.partituras.is_empty());
        assert!(!p.exemplo, "o hinário importado continua");
        assert_eq!(p.hinario.hinario.id, "x");
        assert_eq!(arquivos(&d), ["hinario.json"]);
        // sem partituras (ou chamado de novo) também dá certo
        assert!(
            hinario::remover_partituras(&d)
                .unwrap()
                .partituras
                .is_empty()
        );
        // e dá para importar de novo
        assert_eq!(importar_zip(&d, &pacote_ok()).unwrap().partituras, 2);
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn importar_json_do_mesmo_hinario_mantem_as_partituras() {
        let d = dir_com_hinario("json_mesmo");
        importar_zip(&d, &pacote_ok()).unwrap();
        let p = hinario::importar(&d, JSON).unwrap();
        assert_eq!(p.partituras, vec![1, 283]);
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn importar_json_de_outro_hinario_apaga_as_partituras() {
        let d = dir_com_hinario("json_outro");
        importar_zip(&d, &pacote_ok()).unwrap();
        let outro = JSON.replace(r#""id":"x""#, r#""id":"y""#);
        let p = hinario::importar(&d, &outro).unwrap();
        assert!(p.partituras.is_empty());
        assert!(!d.join("partituras").exists());
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn remover_apaga_as_partituras_e_volta_ao_exemplo() {
        let d = dir_com_hinario("remover");
        importar_zip(&d, &pacote_ok()).unwrap();
        let p = hinario::remover(&d).unwrap();
        assert!(p.exemplo && p.partituras.is_empty());
        assert!(arquivos(&d).is_empty(), "{:?}", arquivos(&d));
        assert!(hinario::remover(&d).unwrap().exemplo); // idempotente
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn numeros_ignora_marca_de_outro_hinario_e_arquivos_estranhos() {
        let d = dir_com_hinario("numeros");
        importar_zip(&d, &pacote_ok()).unwrap();
        std::fs::write(d.join("partituras/hino-5.svg.bak"), "x").unwrap();
        std::fs::write(d.join("partituras/leia-me.txt"), "x").unwrap();
        std::fs::write(d.join("partituras/hino-007.svg"), "x").unwrap();
        assert_eq!(numeros(&d, "x").unwrap(), vec![1, 283]);
        assert!(numeros(&d, "outro").unwrap().is_empty());
        assert!(numeros(&d, "").unwrap().is_empty());
        assert!(numeros(&dir_teste("nao_existe"), "x").unwrap().is_empty());
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn id_com_caracteres_estranhos_funciona_como_marca() {
        let d = dir_teste("id_estranho");
        let json = JSON.replace(r#""id":"x""#, r#""id":" a\nb\"c ""#);
        hinario::importar(&d, &json).unwrap();
        let z = zip_de(&[("partituras/hino-1.svg", SVG)]);
        let r = importar_zip(&d, &z).unwrap();
        assert_eq!(r.pacote.partituras, vec![1]);
        assert_eq!(hinario::carregar(Some(&d)).unwrap().partituras, vec![1]);
        assert!(
            numeros(&d, "a\nb\"c").unwrap().is_empty(),
            "a marca é exata"
        );
        std::fs::remove_dir_all(&d).ok();
    }

    // ---- falhas de leitura não viram "sem partitura" nem apagam nada ----

    /// Deixa `partituras/.hinario` ilegível (um diretório no lugar do arquivo: o erro não é "não existe").
    fn estraga_a_marca(d: &Path) {
        std::fs::remove_file(d.join("partituras/.hinario")).unwrap();
        std::fs::create_dir(d.join("partituras/.hinario")).unwrap();
    }

    #[test]
    fn marca_ilegivel_nao_apaga_as_partituras_e_o_erro_sobe() {
        let d = dir_com_hinario("marca_ilegivel");
        importar_zip(&d, &pacote_ok()).unwrap();
        estraga_a_marca(&d);
        // alinhar (importar um JSON de outro hinário) NÃO pode tratar "não consegui ler" como "é de outro hinário"
        assert_eq!(codigo(&alinhar(&d, "outro").unwrap_err()), "ler");
        assert!(
            d.join("partituras/hino-1.svg").exists() && d.join("partituras/hino-283.svg").exists()
        );
        assert_eq!(codigo(&numeros(&d, "x").unwrap_err()), "ler");
        let outro = JSON.replace(r#""id":"x""#, r#""id":"y""#);
        assert_eq!(codigo(&hinario::importar(&d, &outro).unwrap_err()), "ler");
        assert!(
            d.join("partituras/hino-1.svg").exists(),
            "as partituras continuam lá"
        );
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn sem_marca_e_sem_pasta_e_so_ausencia_e_nao_erro() {
        let d = dir_com_hinario("sem_marca");
        assert!(numeros(&d, "x").unwrap().is_empty()); // nem a pasta existe
        std::fs::create_dir_all(d.join("partituras")).unwrap();
        std::fs::write(d.join("partituras/hino-1.svg"), SVG).unwrap();
        assert!(numeros(&d, "x").unwrap().is_empty()); // pasta sem marca: não é deste hinário
        alinhar(&d, "x").unwrap(); // e aí sim é apagada
        assert!(!d.join("partituras").exists());
        std::fs::remove_dir_all(&d).ok();
    }

    #[cfg(unix)]
    #[test]
    fn pasta_de_partituras_que_nao_da_para_listar_e_erro_e_nao_lista_vazia() {
        use std::os::unix::fs::PermissionsExt;
        let d = dir_com_hinario("sem_listar");
        importar_zip(&d, &pacote_ok()).unwrap();
        let pasta = d.join("partituras");
        // só "x": dá para abrir o .hinario pelo caminho, mas não listar a pasta
        std::fs::set_permissions(&pasta, std::fs::Permissions::from_mode(0o100)).unwrap();
        let resultado = if std::fs::read_dir(&pasta).is_ok() {
            None // rodando como root: as permissões não valem, e não há o que provar aqui
        } else {
            Some(numeros(&d, "x"))
        };
        std::fs::set_permissions(&pasta, std::fs::Permissions::from_mode(0o755)).unwrap();
        if let Some(r) = resultado {
            assert_eq!(codigo(&r.unwrap_err()), "ler");
        }
        std::fs::remove_dir_all(&d).ok();
    }

    // ---- uma importação ou remoção de cada vez ----

    /// Roda `f` numa thread enquanto a tranca está presa aqui: ela tem de esperar (não acabar e não tocar em `d`), e só depois de
    /// a tranca ser solta é que termina.
    fn espera_a_tranca<T: Send + 'static>(d: &Path, f: impl FnOnce() -> T + Send + 'static) -> T {
        let antes = arquivos(d);
        let guarda = hinario::trancar();
        let t = std::thread::spawn(f);
        std::thread::sleep(std::time::Duration::from_millis(300));
        assert!(!t.is_finished(), "tem de esperar a tranca");
        assert_eq!(
            arquivos(d),
            antes,
            "e não pode ter tocado em nada enquanto espera"
        );
        drop(guarda);
        t.join().unwrap()
    }

    #[test]
    fn importar_zip_espera_a_tranca() {
        let d = dir_com_hinario("tranca_zip");
        let (d2, z) = (d.clone(), pacote_ok());
        let r = espera_a_tranca(&d, move || importar_zip(&d2, &z));
        assert_eq!(r.unwrap().partituras, 2);
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn importar_json_espera_a_tranca() {
        let d = dir_com_hinario("tranca_json");
        let d2 = d.clone();
        let r = espera_a_tranca(&d, move || hinario::importar(&d2, JSON));
        assert!(r.is_ok());
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn remover_espera_a_tranca() {
        let d = dir_com_hinario("tranca_remover");
        let d2 = d.clone();
        let r = espera_a_tranca(&d, move || hinario::remover(&d2));
        assert!(r.unwrap().exemplo);
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn importacoes_em_paralelo_deixam_o_disco_consistente() {
        let d = dir_com_hinario("paralelo");
        let a = zip_de(&[("partituras/hino-1.svg", SVG)]);
        let b = zip_de(&[("partituras/hino-2.svg", SVG)]);
        let mut threads = Vec::new();
        for i in 0..8 {
            let (d2, z) = (d.clone(), if i % 2 == 0 { a.clone() } else { b.clone() });
            threads.push(std::thread::spawn(move || {
                importar_zip(&d2, &z).unwrap().partituras
            }));
            let d3 = d.clone();
            threads.push(std::thread::spawn(move || {
                hinario::importar(&d3, JSON).unwrap();
                0
            }));
        }
        for t in threads {
            t.join().unwrap();
        }
        let n = numeros(&d, "x").unwrap();
        assert!(n == vec![1] || n == vec![2], "{n:?}");
        assert!(!d.join("partituras.novo").exists() && !d.join("hinario.json.tmp").exists());
        assert_eq!(hinario::carregar(Some(&d)).unwrap().partituras, n);
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn le_a_partitura_pelo_numero() {
        let d = dir_com_hinario("ler");
        importar_zip(&d, &pacote_ok()).unwrap();
        let svg = ler_partitura(&d, 283, false).unwrap();
        assert!(
            svg.starts_with("<svg xmlns=") && svg.contains("<path d=\"M0 0L1 1\"></path>"),
            "{svg}"
        );
        assert_eq!(
            args(&ler_partitura(&d, 2, false).unwrap_err()),
            vec!["sem_partitura".to_string(), "2".to_string()]
        );
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn leitura_limpa_de_novo_e_recusa_arquivo_adulterado() {
        let d = dir_com_hinario("adulterado");
        importar_zip(&d, &pacote_ok()).unwrap();
        std::fs::write(
            d.join("partituras/hino-1.svg"),
            r#"<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>"#,
        )
        .unwrap();
        let e = ler_partitura(&d, 1, false).unwrap_err();
        let a = args(&e);
        assert_eq!((a[0].as_str(), a[1].as_str()), ("partitura_invalida", "1"));
        assert!(a[2].contains("<script>"), "{e}");
        // arquivo grande demais
        std::fs::write(
            d.join("partituras/hino-283.svg"),
            vec![b'x'; (Limites::default().svg + 1) as usize],
        )
        .unwrap();
        let e = ler_partitura(&d, 283, false).unwrap_err();
        assert_eq!(codigo(&e), "partitura_invalida");
        assert!(args(&e)[2].contains("passa de"), "{e}"); // pelo tamanho, antes de tentar ler
        std::fs::remove_dir_all(&d).ok();
    }

    /// Importa um pacote de partituras de verdade (não versionado), para o hinário real:
    /// `BM_HINARIO=hinario.json BM_PACOTE_ZIP=partituras.zip cargo test pacote_real -- --ignored --nocapture`.
    /// Confere que nada foi recusado e que cada partitura importada pode ser lida de volta.
    #[test]
    #[ignore = "defina BM_HINARIO=hinario.json e BM_PACOTE_ZIP=caminho/para/partituras.zip"]
    fn pacote_real_e_importado_e_lido_de_volta() {
        let caminho = std::env::var("BM_PACOTE_ZIP").expect("defina BM_PACOTE_ZIP");
        let bytes = std::fs::read(&caminho).unwrap();
        let json = std::fs::read_to_string(std::env::var("BM_HINARIO").expect("defina BM_HINARIO"))
            .unwrap();
        let d = dir_teste("real");
        hinario::importar(&d, &json).unwrap();
        let inicio = std::time::Instant::now();
        let r = importar_zip(&d, &bytes).unwrap();
        println!(
            "{} hinos, {} partituras importadas, {} recusadas, em {:?} (zip de {} bytes)",
            r.pacote.hinario.hinos.len(),
            r.partituras,
            r.recusadas.len(),
            inicio.elapsed(),
            bytes.len()
        );
        assert!(r.recusadas.is_empty(), "recusadas: {:?}", r.recusadas);
        assert!(r.partituras > 0, "o pacote não tem nenhuma partitura");
        let carregado = hinario::carregar(Some(&d)).unwrap();
        assert_eq!(carregado.partituras, r.pacote.partituras);
        let mut com_paisagem = 0;
        for n in &carregado.partituras {
            let retrato = ler_partitura(&d, *n, false).unwrap();
            assert!(retrato.starts_with("<svg xmlns="), "hino {n}");
            let paisagem = ler_partitura(&d, *n, true).unwrap();
            assert!(paisagem.starts_with("<svg xmlns="), "hino {n} (paisagem)");
            // se o pacote trouxe a paisagem, ela é outro desenho (outra largura de página); se não, vale o retrato
            if d.join("partituras")
                .join(Variante::Paisagem.arquivo(*n))
                .exists()
            {
                com_paisagem += 1;
                assert_ne!(paisagem, retrato, "hino {n}: a paisagem é igual ao retrato");
            } else {
                assert_eq!(paisagem, retrato, "hino {n}");
            }
        }
        println!(
            "{com_paisagem} de {} com versão de paisagem",
            carregado.partituras.len()
        );
        std::fs::remove_dir_all(&d).ok();
    }
}
