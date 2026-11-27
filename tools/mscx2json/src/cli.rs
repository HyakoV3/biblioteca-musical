//! A linha de comando: argumentos, arquivos, relatório de avisos.

use crate::conversao::converter_com;
use crate::correcoes;
use crate::correcoes::Correcoes;
use crate::modelo::Hino;
use crate::partes::nomes_satb;
use crate::saida::{cabecalho, para_json};
use crate::validacao::validar;
use serde_json::json;
use std::path::{Path, PathBuf};

pub(crate) const AJUDA: &str = "Uso: mscx2json [--nomes-originais] [--idioma pt-BR] [--correcoes correcoes.json] [--avisos avisos.txt] --id ID --nome NOME arquivo.mscx|pasta ... > hinario.json\n\
--idioma declara o idioma do conteúdo (título e letra) no hinário gerado.\n\
--correcoes aplica as correções explícitas da letra (formato em docs/correcoes-da-letra.md); cada uma vira um aviso.\n\
--avisos grava o relatório dos avisos por hino num arquivo (além do stderr); guarde-o fora do Git, como o hinário gerado.\n\
--nomes-originais mantém \"Parte I..IV\" em vez de Soprano/Contralto/Tenor/Baixo.\n\
Os arquivos devem se chamar hino-<número>.mscx; os demais são ignorados com um aviso.";

pub(crate) fn numero_do_arquivo(p: &Path) -> Option<u32> {
    p.file_stem()?.to_str()?.strip_prefix("hino-")?.parse().ok()
}

/// Roda a conversão. Se `--avisos` foi pedido e a conversão falha, o erro vai para o relatório (que não fica velho nem vazio).
pub(crate) fn executar(args: Vec<String>) -> Result<(), String> {
    let relatorio = args
        .windows(2)
        .find(|w| w[0] == "--avisos")
        .map(|w| PathBuf::from(&w[1]))
        .filter(|c| {
            !c.to_string_lossy().starts_with("--") && c.extension().is_none_or(|x| x != "mscx")
        });
    let resultado = executar_conversao(args);
    if let (Err(e), Some(c)) = (&resultado, relatorio) {
        let _ = std::fs::write(c, format!("erro: {e}\n"));
    }
    resultado
}

/// O que a linha de comando pediu.
struct Opcoes {
    id: Option<String>,
    nome: Option<String>,
    entradas: Vec<PathBuf>,
    renomear: bool,
    idioma: Option<String>,
    arquivo_correcoes: Option<PathBuf>,
    arquivo_avisos: Option<PathBuf>,
}

/// O caminho que vem depois de `--avisos`. É a única opção que GRAVA: nunca sobre uma partitura de origem.
fn caminho_dos_avisos(it: &mut impl Iterator<Item = String>) -> Result<PathBuf, String> {
    let c = it
        .next()
        .filter(|c| !c.starts_with("--"))
        .ok_or("--avisos precisa do caminho do arquivo")?;
    let c = PathBuf::from(c);
    if c.extension().is_some_and(|x| x == "mscx") {
        return Err(format!(
            "--avisos não pode apontar para um .mscx: {}",
            c.display()
        ));
    }
    // Um relatório de uma execução anterior não pode ficar parecendo o desta.
    let _ = std::fs::remove_file(&c);
    Ok(c)
}

impl Opcoes {
    /// Lê os argumentos. `None` quando o pedido era só a ajuda (já impressa).
    fn ler(args: Vec<String>) -> Result<Option<Self>, String> {
        let mut o = Opcoes {
            id: None,
            nome: None,
            entradas: vec![],
            renomear: true,
            idioma: None,
            arquivo_correcoes: None,
            arquivo_avisos: None,
        };
        let mut it = args.into_iter();
        while let Some(a) = it.next() {
            match a.as_str() {
                "--id" | "--nome" | "--idioma" => o.guardar(&a, it.next()),
                "--nomes-originais" => o.renomear = false,
                "--avisos" => o.arquivo_avisos = Some(caminho_dos_avisos(&mut it)?),
                "--correcoes" => {
                    let c = it
                        .next()
                        .ok_or("--correcoes precisa do caminho do arquivo")?;
                    o.arquivo_correcoes = Some(PathBuf::from(c));
                }
                "-h" | "--ajuda" => {
                    println!("{AJUDA}");
                    return Ok(None);
                }
                _ => o.entradas.push(PathBuf::from(a)),
            }
        }
        Ok(Some(o))
    }

    /// As opções que levam um valor texto.
    fn guardar(&mut self, opcao: &str, valor: Option<String>) {
        match opcao {
            "--id" => self.id = valor,
            "--nome" => self.nome = valor,
            _ => self.idioma = valor,
        }
    }
}

fn carregar_correcoes(arquivo: &Option<PathBuf>) -> Result<Correcoes, String> {
    let Some(c) = arquivo else {
        return Ok(Correcoes::new());
    };
    let texto = std::fs::read_to_string(c).map_err(|e| format!("{}: {e}", c.display()))?;
    correcoes::ler(&texto).map_err(|e| format!("{}: {e}", c.display()))
}

/// Os arquivos a converter: as entradas, com cada pasta trocada pelos `.mscx` que há dentro (em ordem).
fn listar_arquivos(entradas: Vec<PathBuf>) -> Result<Vec<PathBuf>, String> {
    let mut arquivos = vec![];
    for e in entradas {
        if !e.is_dir() {
            arquivos.push(e);
            continue;
        }
        let mut dentro: Vec<_> = std::fs::read_dir(&e)
            .map_err(|x| format!("{}: {x}", e.display()))?
            .filter_map(|x| x.ok().map(|x| x.path()))
            .filter(|p| p.extension().is_some_and(|x| x == "mscx"))
            .collect();
        dentro.sort();
        arquivos.extend(dentro);
    }
    Ok(arquivos)
}

/// Os hinos convertidos e os avisos de cada arquivo (inclusive os dos ignorados).
#[derive(Default)]
struct Resultado {
    hinos: Vec<Hino>,
    avisos_por_arquivo: Vec<(PathBuf, Vec<String>)>,
}

impl Resultado {
    fn avisar(&mut self, arquivo: PathBuf, avisos: Vec<String>) {
        self.avisos_por_arquivo.push((arquivo, avisos));
    }
}

fn converter_arquivo(
    arq: &Path,
    n: u32,
    correcoes: &Correcoes,
    renomear: bool,
) -> Result<Hino, String> {
    let xml = std::fs::read_to_string(arq).map_err(|e| format!("{}: {e}", arq.display()))?;
    let ajustes = correcoes.get(&n).map(Vec::as_slice).unwrap_or(&[]);
    let mut h = converter_com(&xml, n, ajustes).map_err(|e| format!("{}: {e}", arq.display()))?;
    validar(&h).map_err(|e| format!("{}: {e}", arq.display()))?;
    if renomear {
        nomes_satb(&mut h);
    }
    for a in &h.avisos {
        eprintln!("aviso: {}: {a}", arq.display());
    }
    Ok(h)
}

fn converter_arquivos(
    arquivos: Vec<PathBuf>,
    correcoes: &Correcoes,
    renomear: bool,
) -> Result<Resultado, String> {
    let mut resultado = Resultado::default();
    for arq in arquivos {
        let Some(n) = numero_do_arquivo(&arq) else {
            eprintln!(
                "aviso: {} ignorado (nome fora do padrão hino-<número>.mscx)",
                arq.display()
            );
            let aviso = "ignorado (nome fora do padrão hino-<número>.mscx)".to_string();
            resultado.avisar(arq, vec![aviso]);
            continue;
        };
        let h = converter_arquivo(&arq, n, correcoes, renomear)?;
        resultado.avisar(arq, h.avisos.clone());
        resultado.hinos.push(h);
    }
    resultado.hinos.sort_by_key(|h| h.numero);
    Ok(resultado)
}

/// Avisa das correções que são de um hino que não está nesta conversão.
fn avisar_correcoes_sem_hino(correcoes: &Correcoes, resultado: &mut Resultado) {
    let sem_hino: Vec<u32> = correcoes
        .keys()
        .filter(|n| !resultado.hinos.iter().any(|h| h.numero == **n))
        .copied()
        .collect();
    for n in sem_hino {
        eprintln!(
            "aviso: há correções para o hino {n}, mas não há arquivo hino-{n}.mscx nesta conversão"
        );
        resultado.avisar(
            PathBuf::from(format!("hino-{n}.mscx")),
            vec!["há correções para este hino, mas não há arquivo nesta conversão".to_string()],
        );
    }
}

/// O hinário em JSON (texto) a partir dos hinos convertidos.
fn montar_json(opcoes: &Opcoes, id: &str, nome: &str, hinos: &[Hino]) -> Result<String, String> {
    let saida = json!({
        "versao": 1,
        "hinario": cabecalho(id, nome, opcoes.idioma.as_deref()),
        "hinos": hinos.iter().map(para_json).collect::<Vec<_>>(),
    });
    serde_json::to_string(&saida).map_err(|e| e.to_string())
}

pub(crate) fn executar_conversao(args: Vec<String>) -> Result<(), String> {
    let Some(opcoes) = Opcoes::ler(args)? else {
        return Ok(());
    };
    let id = opcoes.id.clone().ok_or(AJUDA)?;
    let nome = opcoes.nome.clone().ok_or(AJUDA)?;
    let correcoes = carregar_correcoes(&opcoes.arquivo_correcoes)?;
    let arquivos = listar_arquivos(opcoes.entradas.clone())?;
    if arquivos.is_empty() {
        return Err(AJUDA.into());
    }

    let mut resultado = converter_arquivos(arquivos, &correcoes, opcoes.renomear)?;
    avisar_correcoes_sem_hino(&correcoes, &mut resultado);
    let hinos = &resultado.hinos;
    if let Some(p) = hinos.windows(2).find(|p| p[0].numero == p[1].numero) {
        return Err(format!("número de hino repetido: {}", p[0].numero));
    }
    let json = montar_json(&opcoes, &id, &nome, hinos)?;
    // O relatório sai ANTES do JSON: se não der para gravá-lo, o erro vem sem que o stdout já tenha recebido uma saída "boa".
    if let Some(c) = &opcoes.arquivo_avisos {
        std::fs::write(c, relatorio_de_avisos(&resultado.avisos_por_arquivo))
            .map_err(|e| format!("{}: {e}", c.display()))?;
    }
    println!("{json}");
    Ok(())
}

/// O relatório dos avisos da conversão, um bloco por hino (só os que têm avisos), para guardar ao lado da saída: no `stderr` eles se perdem
/// quando a conversão roda de um script.
pub(crate) fn relatorio_de_avisos(por_arquivo: &[(PathBuf, Vec<String>)]) -> String {
    let mut saida = String::new();
    for (arq, avisos) in por_arquivo.iter().filter(|(_, a)| !a.is_empty()) {
        saida.push_str(&format!("{}\n", arq.display()));
        for a in avisos {
            saida.push_str(&format!("  - {a}\n"));
        }
    }
    if saida.is_empty() {
        saida.push_str("sem avisos\n");
    }
    saida
}
