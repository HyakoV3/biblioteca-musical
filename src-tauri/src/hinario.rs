//! Leitura do pacote de conteúdo (ver docs/FORMATO.md).
//! O repositório só traz um pacote de exemplo com dados fictícios.

use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::{Mutex, MutexGuard};

const EXEMPLO: &str = include_str!("../exemplo/hinario.json");
const VERSAO_SUPORTADA: u32 = 1;
/// Conteúdo opcional levado dentro do binário por `BMCCB_PACOTE` na hora do build (ver build.rs). Vazio no
/// build comum. Não vai para o Git: o repositório só traz o pacote de exemplo fictício.
const INCLUSO: &str = include_str!(concat!(env!("OUT_DIR"), "/pacote_incluso.json"));

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InfoHinario {
    pub id: String,
    pub nome: String,
    /// Idioma do conteúdo (título e letra), como código BCP 47: "pt-BR", "es", "en".
    /// Opcional: sem ele, a interface não marca o idioma do texto dos hinos.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub idioma: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Hino {
    pub numero: u32,
    pub titulo: String,
    /// Crédito como aparece na partitura (letrista e/ou compositor), ex.: "Fulana de Tal".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub autoria: Option<String>,
    #[serde(default)]
    pub tonalidade: Option<String>,
    #[serde(default)]
    pub letra: Vec<String>,
    #[serde(default)]
    pub partitura: Option<String>,
    /// Andamento em batidas por minuto (padrão 90 na interface).
    #[serde(default)]
    pub andamento: Option<u32>,
    /// Notas de cada voz para **uma passada normal** do hino, tocadas por um sintetizador (não há gravações).
    #[serde(default)]
    pub vozes: Vec<Voz>,
    /// Última passada, quando o hino termina de forma diferente (o "final"): as mesmas vozes, na mesma ordem.
    /// A interface toca (N-1) passadas normais e esta por último.
    #[serde(rename = "final", default, skip_serializing_if = "Option::is_none")]
    pub passada_final: Option<PassadaFinal>,
    /// Introdução (do começo da partitura até o fim da nota marcada com `*`): as mesmas vozes, na mesma ordem, com o tempo
    /// começando em 0. A interface a toca sozinha ("Introdução") e antes da 1ª vez em "Tocar o hino todo".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub introducao: Option<Introducao>,
    /// Tempo de cada sílaba da letra, para o karaokê (opcional). Se estiver malformada, é descartada na leitura:
    /// o hino continua importando, só sem karaokê.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sincronia: Option<Sincronia>,
    /// Em que instante cada compasso da partitura começa, em cada fluxo de notas, para destacar o compasso que toca (I-12, fase B). Se
    /// estiver malformado, é descartado na leitura: o hino continua importando, só sem o destaque na partitura.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub compassos: Option<Compassos>,
}

/// Instante em que um compasso começa a tocar: `[inicio_em_batidas, indice_do_compasso]`. O índice conta os compassos ESCRITOS da
/// partitura, a partir de 0, que é também a ordem dos `g.measure` do SVG.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InicioDeCompasso(pub f32, pub u32);

/// Os compassos de cada fluxo de notas do hino; o tempo está na régua do próprio fluxo (a mesma das notas): `normal` vale para as vezes
/// normais, `final` para a última vez (só em hino com final) e `introducao` para a introdução.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Compassos {
    pub normal: Vec<InicioDeCompasso>,
    #[serde(rename = "final", default, skip_serializing_if = "Option::is_none")]
    pub passada_final: Option<Vec<InicioDeCompasso>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub introducao: Option<Vec<InicioDeCompasso>>,
}

/// Lista utilizável: não vazia, com tempos finitos e não negativos em ordem estritamente crescente (um compasso começa depois do anterior).
fn compassos_validos(c: &[InicioDeCompasso]) -> bool {
    !c.is_empty()
        && c.iter()
            .all(|InicioDeCompasso(t, _)| t.is_finite() && *t >= 0.0)
        && c.windows(2).all(|w| w[0].0 < w[1].0)
}

impl Compassos {
    fn valida(&self) -> bool {
        compassos_validos(&self.normal)
            && self.passada_final.as_deref().is_none_or(compassos_validos)
            && self.introducao.as_deref().is_none_or(compassos_validos)
    }
}

/// Trecho da letra: `[inicio_em_batidas, de, ate]`. `de..ate` são posições, em unidades UTF-16 (as do JavaScript),
/// dentro da linha da letra sem o "N. " do começo da estrofe.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Trecho(pub f32, pub u32, pub u32);

/// Os trechos de cada linha de uma estrofe. A linha `i` é a `i`-ésima linha da estrofe na `letra`; uma linha sem
/// trecho naquela passada fica vazia.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EstrofeSinc {
    /// Número da estrofe como aparece na letra ("1." é 1).
    pub estrofe: u32,
    pub linhas: Vec<Vec<Trecho>>,
}

/// Sincronia da letra em cada passada; o tempo de cada trecho está na régua daquela passada (a mesma das notas).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Sincronia {
    pub normal: Vec<EstrofeSinc>,
    #[serde(rename = "final", default, skip_serializing_if = "Option::is_none")]
    pub passada_final: Option<Vec<EstrofeSinc>>,
}

fn estrofes_validas(estrofes: &[EstrofeSinc]) -> bool {
    estrofes.iter().all(|e| {
        e.estrofe >= 1
            && e.linhas
                .iter()
                .flatten()
                .all(|Trecho(t, de, ate)| t.is_finite() && *t >= 0.0 && de < ate)
    })
}

impl Sincronia {
    /// Estrutura utilizável: tempos finitos e não negativos, e cada trecho com `de < ate`.
    fn valida(&self) -> bool {
        estrofes_validas(&self.normal) && self.passada_final.as_deref().is_none_or(estrofes_validas)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PassadaFinal {
    pub vozes: Vec<Voz>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Introducao {
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

/// Resposta enviada à interface: o hinário, se ele é o pacote de exemplo e de quais hinos há partitura instalada.
#[derive(Debug, Serialize)]
pub struct Pacote {
    pub hinario: Hinario,
    pub exemplo: bool,
    /// Números dos hinos com partitura (SVG) importada, em ordem. Vazio sem pacote `.zip` importado (ver `pacote.rs`).
    pub partituras: Vec<u32>,
}

/// Erro que a interface traduz: um JSON `["codigo", "arg", ...]` (ver `src/lib/erros.ts`). JSON, e não texto separado por
/// delimitador, porque os argumentos podem vir de dados importados (nomes de voz) e conter qualquer caractere.
pub(crate) fn erro(codigo: &str, args: &[String]) -> String {
    let mut v = vec![codigo.to_string()];
    v.extend_from_slice(args);
    serde_json::to_string(&v).unwrap_or_else(|_| codigo.to_string())
}

pub fn ler(json: &str) -> Result<Hinario, String> {
    let mut h: Hinario =
        serde_json::from_str(json).map_err(|e| erro("json_invalido", &[e.to_string()]))?;
    if h.versao != VERSAO_SUPORTADA {
        return Err(erro(
            "versao",
            &[h.versao.to_string(), VERSAO_SUPORTADA.to_string()],
        ));
    }
    // O karaokê é um extra: sincronia malformada é descartada, sem recusar o hino.
    for hino in &mut h.hinos {
        if hino.sincronia.as_ref().is_some_and(|s| !s.valida()) {
            hino.sincronia = None;
        }
        // O destaque do compasso na partitura também é um extra: compassos malformados são descartados, sem recusar o hino.
        if hino.compassos.as_ref().is_some_and(|c| !c.valida()) {
            hino.compassos = None;
        }
    }
    // O final precisa ter as mesmas vozes da passada normal, na mesma ordem (a interface as junta por posição).
    for hino in &h.hinos {
        if let Some(f) = &hino.passada_final {
            let normal: Vec<&str> = hino.vozes.iter().map(|v| v.nome.as_str()).collect();
            let final_: Vec<&str> = f.vozes.iter().map(|v| v.nome.as_str()).collect();
            if normal != final_ {
                return Err(erro(
                    "vozes_final",
                    &[
                        hino.numero.to_string(),
                        final_.join(", "),
                        normal.join(", "),
                    ],
                ));
            }
        }
        if let Some(i) = &hino.introducao {
            let normal: Vec<&str> = hino.vozes.iter().map(|v| v.nome.as_str()).collect();
            let intro: Vec<&str> = i.vozes.iter().map(|v| v.nome.as_str()).collect();
            if normal != intro {
                return Err(erro(
                    "vozes_intro",
                    &[hino.numero.to_string(), intro.join(", "), normal.join(", ")],
                ));
            }
        }
    }
    Ok(h)
}

/// Carrega `<dir>/hinario.json`; se não existir, usa o pacote de exemplo.
/// Se existir mas estiver inválido, devolve o erro (não esconde com o exemplo).
pub fn carregar(dir: Option<&Path>) -> Result<Pacote, String> {
    if let Some(dir) = dir {
        semear(dir, INCLUSO)?;
        let arquivo = dir.join("hinario.json");
        if arquivo.is_file() {
            let texto = std::fs::read_to_string(&arquivo)
                .map_err(|e| erro("ler", &[format!("{}: {e}", arquivo.display())]))?;
            let hinario = ler(&texto)?;
            let partituras = crate::pacote::numeros(dir, &hinario.hinario.id)?;
            return Ok(Pacote {
                hinario,
                exemplo: false,
                partituras,
            });
        }
    }
    Ok(Pacote {
        hinario: ler(EXEMPLO)?,
        exemplo: true,
        partituras: Vec::new(),
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
        .map_err(|e| erro("gravar", &[format!("{}: {e}", marca.display())]))
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
        .map_err(|e| erro("gravar", &[format!("{}: {e}", dir.display())]))?;
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
    })
}

/// O hinário instalado (o `hinario.json` de `dir`), sem semear nem carregar o exemplo: `None` se não há arquivo. Não pega a tranca
/// (quem importa partituras já a tem e não pode pedi-la de novo).
pub(crate) fn instalado(dir: &Path) -> Result<Option<Hinario>, String> {
    let arquivo = dir.join("hinario.json");
    match std::fs::read_to_string(&arquivo) {
        Ok(texto) => ler(&texto).map(Some),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(erro("ler", &[format!("{}: {e}", arquivo.display())])),
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
        let h = ler(
            r#"{"versao":1,"hinario":{"id":"a","nome":"A"},"hinos":[{"numero":7,"titulo":"T"}]}"#,
        )
        .unwrap();
        let hino = &h.hinos[0];
        assert!(hino.letra.is_empty() && hino.tonalidade.is_none());
        assert!(hino.vozes.is_empty() && hino.andamento.is_none());
        assert!(h.hinario.idioma.is_none() && hino.autoria.is_none());
    }

    /// O erro decodificado: `[codigo, arg, ...]`.
    fn args(e: &str) -> Vec<String> {
        serde_json::from_str(e).unwrap_or_else(|_| panic!("erro não é um JSON de códigos: {e}"))
    }

    fn json_com_final(vozes_final: &str) -> String {
        format!(
            r#"{{"versao":1,"hinario":{{"id":"a","nome":"A"}},"hinos":[{{"numero":457,"titulo":"T",
            "vozes":[{{"nome":"Soprano","notas":[[0,1,60]]}},{{"nome":"Baixo","notas":[[0,1,48]]}}],
            "final":{{"vozes":{vozes_final}}}}}]}}"#
        )
    }

    #[test]
    fn passada_final_e_lida_e_volta_com_o_nome_final() {
        let h = ler(&json_com_final(
            r#"[{"nome":"Soprano","notas":[[0,1,60],[1,2,62]]},{"nome":"Baixo","notas":[[0,3,48]]}]"#,
        ))
        .unwrap();
        let f = h.hinos[0]
            .passada_final
            .as_ref()
            .expect("deveria ter final");
        assert_eq!(f.vozes[0].notas.len(), 2);
        // ao serializar, a chave continua "final" (e some quando não há final)
        let saida = serde_json::to_string(&h.hinos[0]).unwrap();
        assert!(saida.contains(r#""final":{"vozes""#), "{saida}");
        let sem = ler(
            r#"{"versao":1,"hinario":{"id":"a","nome":"A"},"hinos":[{"numero":1,"titulo":"T"}]}"#,
        )
        .unwrap();
        assert!(sem.hinos[0].passada_final.is_none());
        assert!(
            !serde_json::to_string(&sem.hinos[0])
                .unwrap()
                .contains("final")
        );
    }

    #[test]
    fn final_com_vozes_diferentes_das_da_passada_normal_e_recusado() {
        // número de vozes diferente
        let e = ler(&json_com_final(
            r#"[{"nome":"Soprano","notas":[[0,1,60]]}]"#,
        ))
        .unwrap_err();
        assert_eq!(args(&e)[..2], ["vozes_final", "457"], "{e}");
        // mesmo número, mas nomes ou ordem diferentes
        let e = ler(&json_com_final(
            r#"[{"nome":"Baixo","notas":[[0,1,48]]},{"nome":"Soprano","notas":[[0,1,60]]}]"#,
        ))
        .unwrap_err();
        assert!(e.contains("Baixo, Soprano"), "{e}");
    }

    fn json_com_introducao(vozes_intro: &str) -> String {
        format!(
            r#"{{"versao":1,"hinario":{{"id":"a","nome":"A"}},"hinos":[{{"numero":1,"titulo":"T",
            "vozes":[{{"nome":"Soprano","notas":[[0,1,60]]}},{{"nome":"Baixo","notas":[[0,1,48]]}}],
            "introducao":{{"vozes":{vozes_intro}}}}}]}}"#
        )
    }

    #[test]
    fn introducao_e_lida_volta_na_saida_e_some_quando_nao_ha() {
        let h = ler(&json_com_introducao(
            r#"[{"nome":"Soprano","notas":[[0,1,60]]},{"nome":"Baixo","notas":[[0,1,48]]}]"#,
        ))
        .unwrap();
        assert_eq!(
            h.hinos[0]
                .introducao
                .as_ref()
                .expect("deveria ter introdução")
                .vozes
                .len(),
            2
        );
        assert!(
            serde_json::to_string(&h.hinos[0])
                .unwrap()
                .contains(r#""introducao":{"vozes""#)
        );
        let sem = ler(
            r#"{"versao":1,"hinario":{"id":"a","nome":"A"},"hinos":[{"numero":1,"titulo":"T"}]}"#,
        )
        .unwrap();
        assert!(sem.hinos[0].introducao.is_none());
        assert!(
            !serde_json::to_string(&sem.hinos[0])
                .unwrap()
                .contains("introducao")
        );
    }

    #[test]
    fn nome_de_voz_com_barra_vertical_nao_embaralha_os_argumentos_do_erro() {
        // O nome vem do arquivo importado: pode ter qualquer caractere, inclusive o separador de antes.
        let e = ler(&json_com_final(
            r#"[{"nome":"A|B","notas":[[0,1,60]]},{"nome":"C\"D","notas":[[0,1,48]]}]"#,
        ))
        .unwrap_err();
        assert_eq!(
            args(&e),
            ["vozes_final", "457", "A|B, C\"D", "Soprano, Baixo"],
            "{e}"
        );
    }

    #[test]
    fn introducao_com_vozes_diferentes_das_da_passada_normal_e_recusada() {
        let e = ler(&json_com_introducao(
            r#"[{"nome":"Soprano","notas":[[0,1,60]]}]"#,
        ))
        .unwrap_err();
        assert_eq!(args(&e)[..2], ["vozes_intro", "1"], "{e}");
    }

    fn json_com_sincronia(sincronia: &str) -> String {
        format!(
            r#"{{"versao":1,"hinario":{{"id":"a","nome":"A"}},"hinos":[{{"numero":1,"titulo":"T","letra":["1. la lá"],
            "vozes":[{{"nome":"Soprano","notas":[[0,1,60],[1,1,62]]}}],"sincronia":{sincronia}}}]}}"#
        )
    }

    #[test]
    fn sincronia_e_lida_volta_na_saida_e_some_quando_nao_ha() {
        let h = ler(&json_com_sincronia(
            r#"{"normal":[{"estrofe":1,"linhas":[[[0,0,2],[1.5,3,5]]]}],"final":[{"estrofe":1,"linhas":[[[0,0,2]]]}]}"#,
        ))
        .unwrap();
        let s = h.hinos[0]
            .sincronia
            .as_ref()
            .expect("deveria ter sincronia");
        assert_eq!(s.normal[0].estrofe, 1);
        assert_eq!(
            s.normal[0].linhas[0],
            vec![Trecho(0.0, 0, 2), Trecho(1.5, 3, 5)]
        );
        assert_eq!(
            s.passada_final.as_ref().unwrap()[0].linhas[0],
            vec![Trecho(0.0, 0, 2)]
        );
        // ao serializar, a chave do final continua "final"
        let saida = serde_json::to_string(&h.hinos[0]).unwrap();
        assert!(
            saida.contains(r#""sincronia":{"normal":[{"estrofe":1"#)
                && saida.contains(r#""final":[{"estrofe":1"#),
            "{saida}"
        );

        let sem = ler(
            r#"{"versao":1,"hinario":{"id":"a","nome":"A"},"hinos":[{"numero":1,"titulo":"T"}]}"#,
        )
        .unwrap();
        assert!(sem.hinos[0].sincronia.is_none());
        assert!(
            !serde_json::to_string(&sem.hinos[0])
                .unwrap()
                .contains("sincronia")
        );
    }

    #[test]
    fn sincronia_malformada_e_descartada_sem_recusar_o_hino() {
        // trecho com de >= ate, tempo negativo, estrofe 0 e (no final) trecho invertido: cada um derruba só a sincronia
        for ruim in [
            r#"{"normal":[{"estrofe":1,"linhas":[[[0,3,3]]]}]}"#,
            r#"{"normal":[{"estrofe":1,"linhas":[[[-1,0,2]]]}]}"#,
            r#"{"normal":[{"estrofe":0,"linhas":[[[0,0,2]]]}]}"#,
            r#"{"normal":[{"estrofe":1,"linhas":[[[0,0,2]]]}],"final":[{"estrofe":1,"linhas":[[[0,5,2]]]}]}"#,
        ] {
            let h =
                ler(&json_com_sincronia(ruim)).unwrap_or_else(|e| panic!("não devia recusar: {e}"));
            assert_eq!(h.hinos[0].titulo, "T");
            assert!(h.hinos[0].sincronia.is_none(), "devia descartar: {ruim}");
        }
    }

    fn json_com_compassos(compassos: &str) -> String {
        format!(
            r#"{{"versao":1,"hinario":{{"id":"a","nome":"A"}},"hinos":[{{"numero":1,"titulo":"T",
            "vozes":[{{"nome":"Soprano","notas":[[0,1,60],[1,1,62]]}}],"compassos":{compassos}}}]}}"#
        )
    }

    #[test]
    fn compassos_sao_lidos_voltam_na_saida_com_a_chave_final_e_somem_quando_nao_ha() {
        let h = ler(&json_com_compassos(
            r#"{"normal":[[0,0],[4,1],[8,2]],"final":[[0,0],[4,1],[8,3]],"introducao":[[0,0],[4,1]]}"#,
        ))
        .unwrap();
        let c = h.hinos[0]
            .compassos
            .as_ref()
            .expect("deveria ter compassos");
        assert_eq!(
            c.normal,
            vec![
                InicioDeCompasso(0.0, 0),
                InicioDeCompasso(4.0, 1),
                InicioDeCompasso(8.0, 2)
            ]
        );
        assert_eq!(c.passada_final.as_ref().unwrap().len(), 3);
        assert_eq!(
            c.introducao.as_ref().unwrap(),
            &vec![InicioDeCompasso(0.0, 0), InicioDeCompasso(4.0, 1)]
        );
        // ao serializar para a interface, a chave do final continua "final"; sem o final nem a introdução, elas não aparecem
        let saida = serde_json::to_string(&h.hinos[0]).unwrap();
        assert!(
            saida.contains(r#""compassos":{"normal":[[0.0,0],[4.0,1],[8.0,2]],"final":[[0.0,0],[4.0,1],[8.0,3]],"introducao":[[0.0,0],[4.0,1]]}"#),
            "{saida}"
        );
        let so_normal = ler(&json_com_compassos(r#"{"normal":[[0,0]]}"#)).unwrap();
        let saida = serde_json::to_string(&so_normal.hinos[0]).unwrap();
        assert!(
            saida.contains(r#""compassos":{"normal":[[0.0,0]]}"#),
            "{saida}"
        );

        let sem = ler(
            r#"{"versao":1,"hinario":{"id":"a","nome":"A"},"hinos":[{"numero":1,"titulo":"T"}]}"#,
        )
        .unwrap();
        assert!(sem.hinos[0].compassos.is_none());
        assert!(
            !serde_json::to_string(&sem.hinos[0])
                .unwrap()
                .contains("compassos")
        );
    }

    #[test]
    fn compassos_malformados_sao_descartados_sem_recusar_o_hino() {
        // lista vazia, tempo negativo, instante repetido, fora de ordem e (no final ou na introdução) o mesmo: cada um derruba só os compassos
        for ruim in [
            r#"{"normal":[]}"#,
            r#"{"normal":[[-1,0]]}"#,
            r#"{"normal":[[0,0],[0,1]]}"#,
            r#"{"normal":[[4,0],[2,1]]}"#,
            r#"{"normal":[[0,0],[4,1]],"final":[[3,0],[1,1]]}"#,
            r#"{"normal":[[0,0],[4,1]],"final":[]}"#,
            r#"{"normal":[[0,0],[4,1]],"introducao":[[0,0],[0,1]]}"#,
            r#"{"normal":[[0,0],[4,1]],"introducao":[]}"#,
        ] {
            let h =
                ler(&json_com_compassos(ruim)).unwrap_or_else(|e| panic!("não devia recusar: {e}"));
            assert_eq!(h.hinos[0].titulo, "T");
            assert_eq!(h.hinos[0].vozes.len(), 1, "as notas continuam");
            assert!(h.hinos[0].compassos.is_none(), "devia descartar: {ruim}");
        }
    }

    #[test]
    fn compassos_com_numero_que_estoura_o_f32_nao_viram_infinito_na_lista() {
        // 1e39 não cabe num f32: o que o serde faz com ele decide se o teste de `is_finite` é alcançável pelo JSON
        match ler(&json_com_compassos(r#"{"normal":[[1e39,0]]}"#)) {
            Ok(h) => assert!(
                h.hinos[0].compassos.is_none(),
                "um tempo infinito não pode ficar"
            ),
            Err(e) => assert_eq!(args(&e)[0], "json_invalido", "{e}"),
        }
    }

    #[test]
    fn compassos_com_formato_errado_recusam_so_pelo_json_invalido_como_qualquer_campo() {
        // um item que não é [numero, indice] não é JSON de um compasso: o erro é o de JSON inválido de sempre, não um comportamento novo
        let e = ler(&json_com_compassos(r#"{"normal":[["a",0]]}"#)).unwrap_err();
        assert_eq!(args(&e)[0], "json_invalido", "{e}");
    }

    #[test]
    fn autoria_do_hino_e_lida() {
        let h = ler(
            r#"{"versao":1,"hinario":{"id":"a","nome":"A"},"hinos":[{"numero":1,"titulo":"T","autoria":"Fulana de Tal"}]}"#,
        )
        .unwrap();
        assert_eq!(h.hinos[0].autoria.as_deref(), Some("Fulana de Tal"));
    }

    #[test]
    fn idioma_do_conteudo_e_lido_e_nao_aparece_quando_ausente() {
        let com = ler(r#"{"versao":1,"hinario":{"id":"a","nome":"A","idioma":"es"},"hinos":[]}"#)
            .unwrap();
        assert_eq!(com.hinario.idioma.as_deref(), Some("es"));
        assert!(
            serde_json::to_string(&com.hinario)
                .unwrap()
                .contains(r#""idioma":"es""#)
        );

        let sem = ler(r#"{"versao":1,"hinario":{"id":"a","nome":"A"},"hinos":[]}"#).unwrap();
        assert!(
            !serde_json::to_string(&sem.hinario)
                .unwrap()
                .contains("idioma")
        );
    }

    #[test]
    fn rejeita_versao_desconhecida() {
        let e = ler(r#"{"versao":2,"hinario":{"id":"a","nome":"A"},"hinos":[]}"#).unwrap_err();
        assert_eq!(args(&e), ["versao", "2", "1"]);
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
        assert_eq!(
            args(&importar(&d, "{ quebrado").unwrap_err())[0],
            "json_invalido"
        );
        assert!(
            importar(
                &d,
                r#"{"versao":2,"hinario":{"id":"a","nome":"A"},"hinos":[]}"#
            )
            .is_err()
        );
        assert_eq!(carregar(Some(&d)).unwrap().hinario.hinario.id, "x");
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn importar_rejeita_vazio_e_numero_repetido() {
        let d = dir_teste("val");
        let vazio = r#"{"versao":1,"hinario":{"id":"a","nome":"A"},"hinos":[]}"#;
        assert_eq!(args(&importar(&d, vazio).unwrap_err()), ["vazio"]);
        let rep = r#"{"versao":1,"hinario":{"id":"a","nome":"A"},"hinos":[{"numero":5,"titulo":"A"},{"numero":5,"titulo":"B"}]}"#;
        assert_eq!(args(&importar(&d, rep).unwrap_err()), ["repetido", "5"]);
        std::fs::remove_dir_all(&d).ok();
    }

    const OUTRO: &str =
        r#"{"versao":1,"hinario":{"id":"y","nome":"Y"},"hinos":[{"numero":9,"titulo":"Z"}]}"#;

    #[test]
    fn semear_sem_conteudo_incluso_nao_faz_nada() {
        let d = dir_teste("sem0");
        semear(&d, "").unwrap();
        assert!(!d.exists());
        assert!(carregar(Some(&d)).unwrap().exemplo);
    }

    #[test]
    fn semear_grava_como_importado_e_so_uma_vez() {
        let d = dir_teste("sem1");
        semear(&d, VALIDO).unwrap();
        let p = carregar(Some(&d)).unwrap();
        assert!(!p.exemplo && p.hinario.hinario.id == "x");
        // a pessoa remove o conteúdo: continua removido (a mesma versão não é reaplicada)
        remover(&d).unwrap();
        semear(&d, VALIDO).unwrap();
        assert!(!d.join("hinario.json").exists());
        assert!(carregar(Some(&d)).unwrap().exemplo);
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn semear_versao_nova_do_conteudo_substitui() {
        let d = dir_teste("sem2");
        semear(&d, VALIDO).unwrap();
        semear(&d, OUTRO).unwrap();
        assert_eq!(carregar(Some(&d)).unwrap().hinario.hinario.id, "y");
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn semear_nao_sobrescreve_importacao_da_propria_pessoa() {
        let d = dir_teste("sem3");
        importar(&d, OUTRO).unwrap(); // importou antes de existir marca
        semear(&d, VALIDO).unwrap();
        assert_eq!(carregar(Some(&d)).unwrap().hinario.hinario.id, "y");
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn semear_com_conteudo_incluso_invalido_da_erro() {
        let d = dir_teste("sem4");
        assert!(semear(&d, "{ quebrado").is_err());
        assert!(!d.join(".incluso").exists());
    }

    #[test]
    fn remover_volta_ao_exemplo() {
        let d = dir_teste("rem");
        importar(&d, VALIDO).unwrap();
        assert!(remover(&d).unwrap().exemplo);
        assert!(remover(&d).unwrap().exemplo); // idempotente
        std::fs::remove_dir_all(&d).ok();
    }

    #[test]
    fn saida_do_conversor_mscx2json_e_aceita() {
        // Gerada por tools/mscx2json a partir de partituras fictícias.
        let h = ler(include_str!(
            "../../tools/mscx2json/tests/fixtures/hinario.json"
        ))
        .unwrap();
        assert_eq!(h.hinos.len(), 2);
        assert_eq!(h.hinos[0].andamento, Some(80));
        assert_eq!(h.hinos[0].vozes[0].notas[0], Nota(0.0, 1.0, 72));
    }

    /// Valida um arquivo real (não versionado): BMCCB_AMOSTRA=caminho cargo test -- --ignored
    #[test]
    #[ignore = "defina BMCCB_AMOSTRA=caminho/para/hinario.json"]
    fn arquivo_real_de_amostra_e_aceito() {
        let caminho = std::env::var("BMCCB_AMOSTRA").expect("defina BMCCB_AMOSTRA");
        let texto = std::fs::read_to_string(caminho).unwrap();
        let d = dir_teste("amostra");
        let p = importar(&d, &texto).unwrap();
        println!("{} hinos aceitos", p.hinario.hinos.len());
        assert!(p.hinario.hinos.iter().all(|h| !h.vozes.is_empty()));
        std::fs::remove_dir_all(&d).ok();
    }
}
