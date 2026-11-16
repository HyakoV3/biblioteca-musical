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
    /// Soma dos bytes descompactados (o `hinario.json` e todos os SVG).
    pub descompactado: u64,
    /// Bytes de cada SVG.
    pub svg: u64,
    /// Bytes do `hinario.json`.
    pub json: u64,
}

impl Default for Limites {
    fn default() -> Self {
        Limites {
            zip: 150 * MIB as usize,
            entradas: 2_000,
            descompactado: 300 * MIB,
            svg: 8 * MIB,
            json: hinario::LIMITE_BYTES as u64,
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

#[derive(Debug, PartialEq)]
enum Entrada {
    Json,
    Pasta,
    Svg(u32),
}

/// Só estes nomes valem num pacote. O número é o canônico (sem zero à esquerda, de 1 a 9 dígitos).
fn classificar(nome: &str) -> Option<Entrada> {
    match nome {
        "hinario.json" => Some(Entrada::Json),
        "partituras/" => Some(Entrada::Pasta),
        _ => {
            let n = nome
                .strip_prefix("partituras/hino-")?
                .strip_suffix(".svg")?;
            let canonico = !n.is_empty()
                && n.len() <= 9
                && n.bytes().all(|b| b.is_ascii_digit())
                && !n.starts_with('0');
            if canonico {
                n.parse().ok().map(Entrada::Svg)
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
pub fn importar_base64(dir: &Path, texto: &str) -> Result<Importacao, String> {
    importar_base64_com(dir, texto, &Limites::default())
}

pub fn importar_base64_com(dir: &Path, texto: &str, lim: &Limites) -> Result<Importacao, String> {
    // A cada 3 bytes, 4 caracteres: o tamanho do texto já diz se o zip passaria do limite, antes de alocar os bytes.
    if texto.len() > lim.zip.div_ceil(3) * 4 + 4 {
        return Err(erro("zip_grande_demais", &[]));
    }
    let bytes = STANDARD
        .decode(texto.trim())
        .map_err(|e| invalido(format!("base64: {e}")))?;
    importar_zip_com(dir, &bytes, lim)
}

/// Só os testes entram por aqui (com os bytes já prontos); o app entra por `importar_base64`.
#[cfg(test)]
pub fn importar_zip(dir: &Path, bytes: &[u8]) -> Result<Importacao, String> {
    importar_zip_com(dir, bytes, &Limites::default())
}

pub fn importar_zip_com(dir: &Path, bytes: &[u8], lim: &Limites) -> Result<Importacao, String> {
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
    let mut json_idx = None;
    let mut svgs: Vec<(u32, usize)> = Vec::new();
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
            Entrada::Json => json_idx = Some(i),
            Entrada::Pasta => {}
            Entrada::Svg(n) => svgs.push((n, i)),
        }
    }
    if declarado > lim.descompactado {
        return Err(erro("zip_descompactado_grande", &[]));
    }

    let json_idx = json_idx.ok_or_else(|| erro("zip_sem_json", &[]))?;
    let json = match ler_entrada(&mut zip, json_idx, lim.json) {
        Ok(b) => String::from_utf8(b)
            .map_err(|_| erro("json_invalido", &["UTF-8 inválido".to_string()]))?,
        Err(Falha::GrandeDemais) => return Err(erro("grande_demais", &[])),
        Err(Falha::Zip(e)) => return Err(invalido(e)),
    };
    let hinario = hinario::validar(&json)?;
    let hinos: HashSet<u32> = hinario.hinos.iter().map(|h| h.numero).collect();

    std::fs::create_dir_all(dir).map_err(gravar)?;
    let novo = dir.join("partituras.novo");
    let tmp = dir.join("hinario.json.tmp");
    let preparo = preparar(
        &mut zip,
        &svgs,
        &hinos,
        &novo,
        &marca(&hinario.hinario.id),
        json.len() as u64,
        lim,
    );
    let (mut aceitas, recusadas) = match preparo {
        Ok(r) => r,
        Err(e) => {
            std::fs::remove_dir_all(&novo).ok();
            return Err(e);
        }
    };

    // Troca: o que já havia só sai agora que tudo o que vai entrar está pronto.
    let troca = (|| -> Result<(), String> {
        std::fs::write(&tmp, &json).map_err(gravar)?;
        sem_erro_se_nao_existe(std::fs::remove_dir_all(dir.join("partituras"))).map_err(gravar)?;
        if aceitas.is_empty() {
            sem_erro_se_nao_existe(std::fs::remove_dir_all(&novo)).map_err(gravar)?;
        } else {
            std::fs::rename(&novo, dir.join("partituras")).map_err(gravar)?;
        }
        std::fs::rename(&tmp, dir.join("hinario.json")).map_err(gravar)
    })();
    if let Err(e) = troca {
        std::fs::remove_dir_all(&novo).ok();
        std::fs::remove_file(&tmp).ok();
        return Err(e);
    }

    aceitas.sort_unstable();
    Ok(Importacao {
        partituras: aceitas.len() as u32,
        pacote: Pacote {
            hinario,
            exemplo: false,
            partituras: aceitas,
        },
        recusadas,
    })
}

/// Limpa cada SVG e grava os aceitos na pasta de preparo (um por vez, para não segurar tudo na memória).
fn preparar(
    zip: &mut ZipArchive<Cursor<&[u8]>>,
    svgs: &[(u32, usize)],
    hinos: &HashSet<u32>,
    novo: &Path,
    marca: &str,
    ja_lido: u64,
    lim: &Limites,
) -> Result<(Vec<u32>, Vec<Recusada>), String> {
    sem_erro_se_nao_existe(std::fs::remove_dir_all(novo)).map_err(gravar)?; // sobra de uma importação interrompida
    std::fs::create_dir(novo).map_err(gravar)?;
    let mut aceitas = Vec::new();
    let mut recusadas = Vec::new();
    let mut lido = ja_lido;
    let mut ordem: Vec<(u32, usize)> = svgs.to_vec();
    ordem.sort_unstable();
    for (n, i) in ordem {
        let recusa = |motivo: String| Recusada { numero: n, motivo };
        if !hinos.contains(&n) {
            recusadas.push(recusa("o hinário não tem esse hino".into()));
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
                std::fs::write(novo.join(format!("hino-{n}.svg")), limpo).map_err(gravar)?;
                aceitas.push(n);
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
        if let Some(Entrada::Svg(n)) =
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

/// O SVG (já limpo na importação, e limpo de novo aqui: o arquivo fica numa pasta que o app não é o único a poder tocar)
/// do hino `numero`. O arquivo é aberto uma vez e lido só até o limite (nada de olhar o tamanho e ler depois: ele pode mudar
/// entre as duas coisas).
pub fn ler_partitura(dir: &Path, numero: u32) -> Result<String, String> {
    let arquivo = dir.join("partituras").join(format!("hino-{numero}.svg"));
    let limite = Limites::default().svg;
    let falha = |e: std::io::Error| erro("ler", &[format!("{}: {e}", arquivo.display())]);
    let aberto = match std::fs::File::open(&arquivo) {
        Ok(f) => f,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return Err(erro("sem_partitura", &[numero.to_string()]));
        }
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
    svg::limpar(&texto).map_err(invalida)
}

#[cfg(test)]
mod testes {
    use super::*;
    use std::io::Write;
    use zip::write::SimpleFileOptions;

    const SVG: &str = r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><g class="a"><path d="M0 0L1 1"/></g></svg>"##;
    const JSON: &str = r#"{"versao":1,"hinario":{"id":"x","nome":"X"},"hinos":[{"numero":1,"titulo":"A"},{"numero":2,"titulo":"B"},{"numero":283,"titulo":"C"}]}"#;

    fn dir_teste(nome: &str) -> std::path::PathBuf {
        let d = std::env::temp_dir().join(format!("bmccb_pacote_{nome}_{}", std::process::id()));
        std::fs::remove_dir_all(&d).ok();
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

    fn pacote_ok() -> Vec<u8> {
        zip_de(&[
            ("hinario.json", JSON),
            ("partituras/", ""),
            ("partituras/hino-1.svg", SVG),
            ("partituras/hino-283.svg", SVG),
        ])
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
        assert_eq!(classificar("hinario.json"), Some(Entrada::Json));
        assert_eq!(classificar("partituras/"), Some(Entrada::Pasta));
        assert_eq!(classificar("partituras/hino-1.svg"), Some(Entrada::Svg(1)));
        assert_eq!(
            classificar("partituras/hino-283.svg"),
            Some(Entrada::Svg(283))
        );
        assert_eq!(
            classificar("partituras/hino-999999999.svg"),
            Some(Entrada::Svg(999_999_999))
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
        let d = dir_teste("ok");
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
    fn o_que_fica_no_disco_e_o_svg_reescrito_e_nao_o_original() {
        let d = dir_teste("reescrito");
        let original = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <g>\n    <path d=\"M0 0\"/>\n  </g>\n</svg>\n".to_string();
        let z = zip_de(&[("hinario.json", JSON), ("partituras/hino-1.svg", &original)]);
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
        let d = dir_teste("base64_ok");
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
        let d = dir_teste("base64_forma");
        let texto = STANDARD.encode(pacote_ok());
        assert!(importar_base64(&d, &format!("  {texto}\n")).is_ok());
        for ruim in [
            "@@@@",
            "abc",
            "YWJj ZGVm",
            "Zm9v!",
            "\u{e9}\u{e9}\u{e9}\u{e9}",
        ] {
            let e = importar_base64(&dir_teste("base64_ruim"), ruim).unwrap_err();
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
        let d = dir_teste("base64_tamanho");
        let lim = Limites {
            zip: 10,
            ..Limites::default()
        };
        // 200 caracteres que NÃO são base64: se decodificasse primeiro, o erro seria zip_invalido
        let e = importar_base64_com(&d, &"@".repeat(200), &lim).unwrap_err();
        assert_eq!(codigo(&e), "zip_grande_demais");
        assert!(!d.exists(), "nada é tocado");
    }

    #[test]
    fn o_gate_do_texto_base64_fica_exatamente_em_4_para_cada_3_bytes_mais_o_preenchimento() {
        // zip de 30 bytes = 10 grupos de 3 = 40 caracteres, mais 4 de folga para o preenchimento "=": o gate é 44. Texto que NÃO é
        // base64: passar do gate dá "zip_grande_demais" (recusado antes de decodificar); ficar nele dá "zip_invalido" (decodificou e falhou).
        let lim = Limites {
            zip: 30,
            ..Limites::default()
        };
        let d = dir_teste("gate_borda");
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
        let d = dir_teste("base64_limite");
        let z = pacote_ok();
        let lim = Limites {
            zip: z.len(),
            ..Limites::default()
        };
        assert!(importar_base64_com(&d, &STANDARD.encode(&z), &lim).is_ok());
        let mais = [z.clone(), vec![0]].concat();
        let e = importar_base64_com(&dir_teste("base64_limite2"), &STANDARD.encode(&mais), &lim)
            .unwrap_err();
        assert_eq!(codigo(&e), "zip_grande_demais");
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn zip_so_com_o_json_importa_sem_partituras() {
        let d = dir_teste("so_json");
        let r = importar_zip(&d, &zip_de(&[("hinario.json", JSON)])).unwrap();
        assert_eq!(r.partituras, 0);
        assert_eq!(arquivos(&d), ["hinario.json"]);
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn svg_que_nao_passa_na_limpeza_e_recusado_e_o_resto_entra() {
        let d = dir_teste("recusa");
        let z = zip_de(&[
            ("hinario.json", JSON),
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
        let d = dir_teste("sem_hino");
        let z = zip_de(&[
            ("hinario.json", JSON),
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
        let d = dir_teste("nenhuma");
        let z = zip_de(&[("hinario.json", JSON), ("partituras/hino-1.svg", "x")]);
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
        ] {
            let d = dir_teste("inesperado");
            let z = zip_de(&[
                ("hinario.json", JSON),
                ("partituras/hino-1.svg", SVG),
                (ruim, "x"),
            ]);
            let e = importar_zip(&d, &z).unwrap_err();
            assert_eq!(
                args(&e),
                vec!["zip_inesperado".to_string(), ruim.to_string()],
                "{ruim}"
            );
            assert!(
                !d.exists() || arquivos(&d).is_empty(),
                "{ruim}: {:?}",
                arquivos(&d)
            );
            std::fs::remove_dir_all(&d).ok();
        }
    }

    #[test]
    fn nome_repetido_recusa_o_pacote() {
        let d = dir_teste("repetido");
        // "hino-2" e "hino-1" têm o mesmo tamanho: trocar os bytes do nome (na entrada e no diretório central) duplica a entrada.
        let z = zip_de(&[
            ("hinario.json", JSON),
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
        assert!(!d.exists() || arquivos(&d).is_empty());
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn sem_json_ou_zip_ruim_nao_grava_nada() {
        let d = dir_teste("sem_json");
        assert_eq!(
            codigo(&importar_zip(&d, &zip_de(&[("partituras/hino-1.svg", SVG)])).unwrap_err()),
            "zip_sem_json"
        );
        assert_eq!(
            codigo(&importar_zip(&d, &zip_de(&[])).unwrap_err()),
            "zip_sem_json"
        );
        for lixo in [&b""[..], b"nao e zip", b"PK\x03\x04quebrado", &[0u8; 64]] {
            assert_eq!(codigo(&importar_zip(&d, lixo).unwrap_err()), "zip_invalido");
        }
        assert!(!d.exists() || arquivos(&d).is_empty());
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn json_invalido_no_zip_nao_substitui_o_que_ja_havia() {
        let d = dir_teste("json_ruim");
        importar_zip(&d, &pacote_ok()).unwrap();
        let antes = arquivos(&d);
        for ruim in [
            "{ quebrado",
            r#"{"versao":1,"hinario":{"id":"x","nome":"X"},"hinos":[]}"#,
        ] {
            let z = zip_de(&[("hinario.json", ruim), ("partituras/hino-2.svg", SVG)]);
            assert!(importar_zip(&d, &z).is_err());
        }
        assert_eq!(arquivos(&d), antes);
        assert_eq!(
            hinario::carregar(Some(&d)).unwrap().partituras,
            vec![1, 283]
        );
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn importar_de_novo_troca_as_partituras_antigas() {
        let d = dir_teste("troca");
        importar_zip(&d, &pacote_ok()).unwrap();
        let z = zip_de(&[("hinario.json", JSON), ("partituras/hino-2.svg", SVG)]);
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
        // um zip sem nenhuma partitura limpa as antigas
        importar_zip(&d, &zip_de(&[("hinario.json", JSON)])).unwrap();
        assert_eq!(arquivos(&d), ["hinario.json"]);
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn sobra_de_importacao_interrompida_e_limpa() {
        let d = dir_teste("sobra");
        std::fs::create_dir_all(d.join("partituras.novo")).unwrap();
        std::fs::write(d.join("partituras.novo/hino-9.svg"), "lixo").unwrap();
        importar_zip(&d, &pacote_ok()).unwrap();
        assert!(!d.join("partituras.novo").exists());
        assert!(!d.join("partituras/hino-9.svg").exists());
        assert!(!d.join("hinario.json.tmp").exists());
        std::fs::remove_dir_all(&d).ok();
    }

    // ---- limites ----

    fn pequenos() -> Limites {
        Limites {
            zip: 10_000,
            entradas: 4,
            descompactado: 5_000,
            svg: 1_000,
            json: 2_000,
        }
    }

    #[test]
    fn zip_grande_demais() {
        let d = dir_teste("lim_zip");
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
        let d = dir_teste("lim_entradas");
        let z = zip_de(&[
            ("hinario.json", JSON),
            ("partituras/hino-1.svg", SVG),
            ("partituras/hino-2.svg", SVG),
            ("partituras/hino-3.svg", SVG),
        ]);
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
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn total_descompactado_alto_demais_recusa_antes_de_descompactar() {
        let d = dir_teste("lim_total");
        let z = pacote_ok();
        let total = (JSON.len() + SVG.len() * 2) as u64;
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
        let d = dir_teste("lim_svg");
        let grande = format!(
            r#"<svg xmlns="http://www.w3.org/2000/svg"><desc>{}</desc></svg>"#,
            "x".repeat(2_000)
        );
        let z = zip_de(&[
            ("hinario.json", JSON),
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
        let d = dir_teste("lim_exato");
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
        let passa = zip_de(&[("hinario.json", JSON), ("partituras/hino-1.svg", &exato)]);
        assert_eq!(
            importar_zip_com(&d, &passa, &lim)
                .unwrap()
                .pacote
                .partituras,
            vec![1]
        );
        let passou = com_tamanho(lim.svg as usize + 1);
        let nao = zip_de(&[("hinario.json", JSON), ("partituras/hino-1.svg", &passou)]);
        let r = importar_zip_com(&d, &nao, &lim).unwrap();
        assert_eq!(r.partituras, 0);
        assert_eq!(r.recusadas.len(), 1);
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn json_acima_do_limite_recusa_o_pacote() {
        let d = dir_teste("lim_json");
        let z = zip_de(&[("hinario.json", JSON)]);
        let e = importar_zip_com(
            &d,
            &z,
            &Limites {
                json: JSON.len() as u64 - 1,
                ..pequenos()
            },
        )
        .unwrap_err();
        assert_eq!(codigo(&e), "grande_demais");
        assert!(
            importar_zip_com(
                &d,
                &z,
                &Limites {
                    json: JSON.len() as u64,
                    ..pequenos()
                }
            )
            .is_ok()
        );
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn cabecalho_que_mente_sobre_o_tamanho_nao_fura_o_limite() {
        // O tamanho declarado do SVG é trocado por 1 (no cabeçalho local e no diretório central), mas o conteúdo continua grande.
        // A biblioteca do zip recusa a entrada ("maior que o tamanho declarado"); se um dia deixasse passar, `ler_entrada` ainda
        // corta a leitura no limite (coberto por `svg_acima_do_limite_e_recusado_so_ele`). Em nenhum caso o SVG entra inteiro.
        let d = dir_teste("mentira");
        let grande = format!(
            r#"<svg xmlns="http://www.w3.org/2000/svg"><desc>{}</desc></svg>"#,
            "x".repeat(3_000)
        );
        let mut z = zip_de(&[("hinario.json", JSON), ("partituras/hino-1.svg", &grande)]);
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
        assert!(!d.join("hinario.json").exists(), "nada é gravado");
        std::fs::remove_dir_all(&d).ok();
    }

    // ---- JSON sozinho, remoção e leitura ----

    #[test]
    fn importar_json_do_mesmo_hinario_mantem_as_partituras() {
        let d = dir_teste("json_mesmo");
        importar_zip(&d, &pacote_ok()).unwrap();
        let p = hinario::importar(&d, JSON).unwrap();
        assert_eq!(p.partituras, vec![1, 283]);
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn importar_json_de_outro_hinario_apaga_as_partituras() {
        let d = dir_teste("json_outro");
        importar_zip(&d, &pacote_ok()).unwrap();
        let outro = JSON.replace(r#""id":"x""#, r#""id":"y""#);
        let p = hinario::importar(&d, &outro).unwrap();
        assert!(p.partituras.is_empty());
        assert!(!d.join("partituras").exists());
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn remover_apaga_as_partituras_e_volta_ao_exemplo() {
        let d = dir_teste("remover");
        importar_zip(&d, &pacote_ok()).unwrap();
        let p = hinario::remover(&d).unwrap();
        assert!(p.exemplo && p.partituras.is_empty());
        assert!(arquivos(&d).is_empty(), "{:?}", arquivos(&d));
        assert!(hinario::remover(&d).unwrap().exemplo); // idempotente
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn numeros_ignora_marca_de_outro_hinario_e_arquivos_estranhos() {
        let d = dir_teste("numeros");
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
        let z = zip_de(&[("hinario.json", &json), ("partituras/hino-1.svg", SVG)]);
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
        let d = dir_teste("marca_ilegivel");
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
        let d = dir_teste("sem_marca");
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
        let d = dir_teste("sem_listar");
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
        let guarda = hinario::trancar();
        let t = std::thread::spawn(f);
        std::thread::sleep(std::time::Duration::from_millis(300));
        assert!(!t.is_finished(), "tem de esperar a tranca");
        assert!(!d.exists(), "e não pode ter tocado em nada enquanto espera");
        drop(guarda);
        t.join().unwrap()
    }

    #[test]
    fn importar_zip_espera_a_tranca() {
        let d = dir_teste("tranca_zip");
        let (d2, z) = (d.clone(), pacote_ok());
        let r = espera_a_tranca(&d, move || importar_zip(&d2, &z));
        assert_eq!(r.unwrap().partituras, 2);
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn importar_json_espera_a_tranca() {
        let d = dir_teste("tranca_json");
        let d2 = d.clone();
        let r = espera_a_tranca(&d, move || hinario::importar(&d2, JSON));
        assert!(r.is_ok());
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn remover_espera_a_tranca() {
        let d = dir_teste("tranca_remover");
        let d2 = d.clone();
        let r = espera_a_tranca(&d, move || hinario::remover(&d2));
        assert!(r.unwrap().exemplo);
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn importacoes_em_paralelo_deixam_o_disco_consistente() {
        let d = dir_teste("paralelo");
        let a = zip_de(&[("hinario.json", JSON), ("partituras/hino-1.svg", SVG)]);
        let b = zip_de(&[("hinario.json", JSON), ("partituras/hino-2.svg", SVG)]);
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
        let d = dir_teste("ler");
        importar_zip(&d, &pacote_ok()).unwrap();
        let svg = ler_partitura(&d, 283).unwrap();
        assert!(
            svg.starts_with("<svg xmlns=") && svg.contains("<path d=\"M0 0L1 1\"></path>"),
            "{svg}"
        );
        assert_eq!(
            args(&ler_partitura(&d, 2).unwrap_err()),
            vec!["sem_partitura".to_string(), "2".to_string()]
        );
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn leitura_limpa_de_novo_e_recusa_arquivo_adulterado() {
        let d = dir_teste("adulterado");
        importar_zip(&d, &pacote_ok()).unwrap();
        std::fs::write(
            d.join("partituras/hino-1.svg"),
            r#"<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>"#,
        )
        .unwrap();
        let e = ler_partitura(&d, 1).unwrap_err();
        let a = args(&e);
        assert_eq!((a[0].as_str(), a[1].as_str()), ("partitura_invalida", "1"));
        assert!(a[2].contains("<script>"), "{e}");
        // arquivo grande demais
        std::fs::write(
            d.join("partituras/hino-283.svg"),
            vec![b'x'; (Limites::default().svg + 1) as usize],
        )
        .unwrap();
        let e = ler_partitura(&d, 283).unwrap_err();
        assert_eq!(codigo(&e), "partitura_invalida");
        assert!(args(&e)[2].contains("passa de"), "{e}"); // pelo tamanho, antes de tentar ler
        std::fs::remove_dir_all(&d).ok();
    }

    /// Importa um pacote de verdade (não versionado): `BMCCB_PACOTE_ZIP=caminho/pacote.zip cargo test pacote_real -- --ignored --nocapture`.
    /// Confere que nada foi recusado e que cada partitura importada pode ser lida de volta.
    #[test]
    #[ignore = "defina BMCCB_PACOTE_ZIP=caminho/para/pacote.zip"]
    fn pacote_real_e_importado_e_lido_de_volta() {
        let caminho = std::env::var("BMCCB_PACOTE_ZIP").expect("defina BMCCB_PACOTE_ZIP");
        let bytes = std::fs::read(&caminho).unwrap();
        let d = dir_teste("real");
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
        for n in &carregado.partituras {
            let svg = ler_partitura(&d, *n).unwrap();
            assert!(svg.starts_with("<svg xmlns="), "hino {n}");
        }
        std::fs::remove_dir_all(&d).ok();
    }
}
