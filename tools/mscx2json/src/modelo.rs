//! Os tipos do hino convertido (o que sai do `.mscx`) e o arredondamento do tempo.

#[derive(Debug, Clone, PartialEq)]
pub struct Evento {
    pub inicio: f64,
    pub dur: f64,
    pub midi: u8,
}

#[derive(Debug)]
pub struct Voz {
    pub nome: String,
    pub notas: Vec<Evento>,
}

#[derive(Debug)]
pub struct Hino {
    pub numero: u32,
    pub titulo: String,
    pub autoria: Option<String>,
    pub andamento: Option<u32>,
    /// Armadura de clave do primeiro `KeySig` (−7 a −1 bemóis, 0, +1 a +7 sustenidos); 0 quando a partitura não tem o elemento.
    pub armadura: i8,
    /// `"maior"` ou `"menor"` (do arquivo, quando ele traz o modo; senão deduzido da nota final do baixo).
    pub modo: &'static str,
    /// Passada normal (uma volta do hino).
    pub vozes: Vec<Voz>,
    /// Última passada, quando o hino tem final: as mesmas vozes, na mesma ordem.
    pub passada_final: Option<Vec<Voz>>,
    /// Introdução: do começo da partitura até o marcador `*`, nas mesmas vozes, na mesma ordem.
    pub introducao: Option<Vec<Voz>>,
    pub letra: Vec<String>,
    /// Tempo de cada sílaba da letra, para o karaokê (opcional: só quando a partitura tem letra).
    pub sincronia: Option<Sincronia>,
    /// Em que instante cada compasso começa, em cada fluxo de notas, para destacar o compasso na partitura (I-12, fase B).
    pub compassos: Option<Compassos>,
    pub avisos: Vec<String>,
}

/// Uma sílaba dentro do texto da letra, com o instante em que é cantada.
/// `(inicio_em_batidas, de, ate)`: `de..ate` são posições (em unidades UTF-16, como as do JavaScript) dentro da linha
/// da letra, sem o "N. " do começo da estrofe.
pub type Trecho = (f64, usize, usize);

/// Linhas de uma estrofe: cada linha é a lista dos trechos cantados nela, na ordem do tempo. Uma linha sem nenhum
/// trecho tocado naquela passada fica como lista vazia, para o índice continuar igual ao da linha da letra.
#[derive(Debug, Clone, PartialEq)]
pub struct EstrofeSinc {
    /// Número da estrofe como aparece na letra ("1." é 1).
    pub estrofe: u32,
    pub linhas: Vec<Vec<Trecho>>,
}

/// Sincronia da letra em cada passada: o tempo de cada trecho já está na régua daquela passada (a normal ou a do
/// final), a mesma das notas das vozes.
#[derive(Debug, Clone, PartialEq)]
pub struct Sincronia {
    pub normal: Vec<EstrofeSinc>,
    pub passada_final: Option<Vec<EstrofeSinc>>,
}

/// Em que instante (em batidas, na régua de cada passada: a mesma das notas) um compasso ESCRITO começa a tocar.
/// `(inicio_em_batidas, indice_do_compasso)`: o índice conta os compassos da partitura em ordem, a partir de 0, que é também a ordem
/// dos `g.measure` do SVG da partitura. É o que o app usa para destacar o compasso que toca (I-12, fase B). O `timemap` do Verovio não
/// serve para isso: ele EXPANDE as repetições com ids de compasso que não existem no SVG (no hino 457, 56 compassos únicos contra 38
/// desenhados).
pub type InicioDeCompasso = (f64, usize);

/// Os compassos de cada fluxo de notas do hino (a passada normal, a do final e a introdução), na régua do próprio fluxo.
#[derive(Debug, Clone, PartialEq)]
pub struct Compassos {
    pub normal: Vec<InicioDeCompasso>,
    pub passada_final: Option<Vec<InicioDeCompasso>>,
    pub introducao: Option<Vec<InicioDeCompasso>>,
}

/// Posição de uma sílaba na letra montada, com o instante dela na partitura (antes de escolher a passada).
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct Marca {
    pub(crate) verso: u32,
    pub(crate) linha: usize,
    pub(crate) de: usize,
    pub(crate) ate: usize,
    pub(crate) t: f64,
}

pub(crate) fn arredondar(x: f64) -> f64 {
    (x * 10000.0).round() / 10000.0
}
