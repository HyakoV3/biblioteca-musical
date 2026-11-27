//! Os tipos do pacote de conteúdo (ver `hinario.rs` e docs/FORMATO.md): o que o `hinario.json` tem e o que a interface recebe.

use serde::{Deserialize, Serialize};

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
    /// O nome do hino por idioma da interface (`pt`, `en`, `es`), opcional; `titulo` é o padrão e a reserva.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub titulos: Option<std::collections::BTreeMap<String, String>>,
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
    /// Tempo de cada sílaba da letra, para o karaokê (opcional). Se os VALORES estiverem malformados (tempo negativo, `de >= ate`), é descartada
    /// na leitura: o hino continua importando, só sem karaokê. Um erro de TIPO (texto onde devia haver número) recusa o hinário inteiro.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sincronia: Option<Sincronia>,
    /// Em que instante cada compasso da partitura começa, em cada fluxo de notas, para destacar o compasso que toca (I-12, fase B). Se os VALORES
    /// estiverem malformados, é descartado na leitura: o hino continua importando, só sem o destaque. Um erro de TIPO recusa o hinário inteiro.
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
    pub(super) fn valida(&self) -> bool {
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
    /// Número da estrofe como aparece na letra ("1." é 1); 0 é o coro ("Coro. ...").
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
        e.linhas
            .iter()
            .flatten()
            .all(|Trecho(t, de, ate)| t.is_finite() && *t >= 0.0 && de < ate)
    })
}

impl Sincronia {
    /// Estrutura utilizável: tempos finitos e não negativos, e cada trecho com `de < ate`.
    pub(super) fn valida(&self) -> bool {
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

impl Nota {
    /// Tempo finito e não negativo, duração finita e positiva, MIDI de 0 a 127.
    pub(super) fn valida(&self) -> bool {
        self.0.is_finite() && self.0 >= 0.0 && self.1.is_finite() && self.1 > 0.0 && self.2 <= 127
    }
}

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
    /// Por que as partituras não puderam ser listadas (pasta ilegível), como erro traduzível (ver `erro`); `None` se tudo certo. O hinário abre mesmo assim, sem partituras.
    pub partituras_erro: Option<String>,
}
