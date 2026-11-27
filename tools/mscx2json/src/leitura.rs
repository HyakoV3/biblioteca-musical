//! A leitura das pautas de um `.mscx`, uma depois da outra: o que elas acumulam (vozes, letra, estrutura, avisos).

use crate::correcoes::Correcao;
use crate::estrutura::{Estrutura, Plano, plano_passadas};
use crate::modelo::{Marca, Voz};
use crate::partes::NomeDaPauta;
use crate::percurso::{Acorde, Estado, Silaba, percorrer};
use crate::xml::{fracao, numero};
use roxmltree::Node;
use std::collections::{BTreeMap, HashMap};

/// Nome da parte de cada pauta: id da pauta -> (nome, posição na parte, total de pautas).
pub(crate) type PartesDasPautas<'a> = HashMap<&'a str, (String, usize, usize)>;

/// O que se lê de uma pauta, compasso a compasso.
struct Pauta {
    /// Fórmula de compasso em vigor (numerador, denominador).
    sig: (f64, f64),
    /// Instante, em batidas, em que o compasso atual começa.
    inicio: f64,
    /// Acordes por voz.
    camadas: BTreeMap<usize, Vec<Acorde>>,
    silabas: Vec<Silaba>,
    respiracoes: Vec<f64>,
}

impl Pauta {
    fn nova() -> Self {
        Pauta {
            sig: (4.0, 4.0),
            inicio: 0.0,
            camadas: BTreeMap::new(),
            silabas: vec![],
            respiracoes: vec![],
        }
    }

    /// O tamanho do compasso, em batidas, depois de atualizar a fórmula de compasso se ele traz uma.
    fn tamanho_do_compasso(&mut self, compasso: Node) -> f64 {
        if let Some(ts) = compasso.descendants().find(|n| n.has_tag_name("TimeSig"))
            && let (Some(n), Some(d)) = (numero::<f64>(ts, "sigN"), numero::<f64>(ts, "sigD"))
        {
            self.sig = (n, d);
        }
        compasso
            .attribute("len")
            .and_then(fracao)
            .unwrap_or(self.sig.0 / self.sig.1 * 4.0)
    }
}

/// Onde o texto de um compasso se lê: (voz, solta no compasso, nó).
type Fonte<'a, 'i> = (usize, bool, Node<'a, 'i>);

/// MuseScore 2: as vozes ficam soltas no compasso (<tick>/<track>) e <voice>
/// traz só as demais. MuseScore 3: todas as vozes ficam em <voice>.
fn fontes_do_compasso<'a, 'i>(compasso: Node<'a, 'i>) -> Vec<Fonte<'a, 'i>> {
    let solta = compasso
        .children()
        .any(|c| matches!(c.tag_name().name(), "Chord" | "Rest" | "Tuplet"));
    let mut fontes: Vec<Fonte> = vec![];
    if solta {
        fontes.push((0, true, compasso));
    }
    let desloc = usize::from(solta);
    for (k, v) in compasso
        .children()
        .filter(|c| c.has_tag_name("voice"))
        .enumerate()
    {
        fontes.push((k + desloc, false, v));
    }
    fontes
}

/// Dentro de uma pauta com vozes guardadas: o nome dela e os acordes inteiros de cada camada.
pub(crate) type PautaGuardada = (NomeDaPauta, Vec<Vec<Acorde>>);

/// O que se acumula ao ler as pautas, uma depois da outra.
pub(crate) struct Leitura<'a> {
    info: PartesDasPautas<'a>,
    pub(crate) ajustes: &'a [Correcao],
    pub(crate) numero_hino: u32,
    /// Ticks por semínima (<Division>).
    divisao: f64,
    pub(crate) vozes: Vec<Voz>,
    pub(crate) vozes_final: Vec<Voz>,
    pub(crate) final_ok: bool,
    /// A letra (sílabas e respirações) depois das correções e antes da separação do final.
    pub(crate) letra_base: Option<(Vec<Silaba>, Vec<f64>)>,
    /// Avisos da leitura recortada pelo plano (notas omitidas): só valem se o final for aceito.
    pub(crate) avisos_do_recorte: Vec<String>,
    /// Por pauta, as notas antes do recorte do plano.
    pub(crate) pautas_guardadas: Vec<PautaGuardada>,
    pub(crate) avisos: Vec<String>,
    pub(crate) letra: Vec<String>,
    pub(crate) marcas: Vec<Marca>,
    pub(crate) andamento: Option<u32>,
    pub(crate) estrutura: Estrutura,
    pub(crate) plano: Option<Plano>,
    pub(crate) asteriscos: Vec<f64>,
    pub(crate) correcoes_tentadas: bool,
}

impl<'a> Leitura<'a> {
    pub(crate) fn nova(
        info: PartesDasPautas<'a>,
        ajustes: &'a [Correcao],
        numero_hino: u32,
        divisao: f64,
    ) -> Self {
        Leitura {
            info,
            ajustes,
            numero_hino,
            divisao,
            vozes: vec![],
            vozes_final: vec![],
            final_ok: true,
            letra_base: None,
            avisos_do_recorte: vec![],
            pautas_guardadas: vec![],
            avisos: vec![],
            letra: vec![],
            marcas: vec![],
            andamento: None,
            estrutura: Estrutura::default(),
            plano: None,
            asteriscos: vec![],
            correcoes_tentadas: false,
        }
    }

    pub(crate) fn ler_pauta(&mut self, idx_pauta: usize, xml: Node) -> Result<(), String> {
        let id = xml.attribute("id").unwrap_or("?");
        let info = self.info.get(id).cloned().unwrap_or((String::new(), 1, 1));
        let pauta = self.ler_compassos(xml, idx_pauta)?;
        if idx_pauta == 0 {
            self.estrutura.inicios.push(pauta.inicio); // fim da partitura
            self.plano = plano_passadas(&self.estrutura);
        }
        self.montar_a_letra(pauta.silabas, pauta.respiracoes);
        self.montar_as_vozes(nome_da_pauta(id, info), pauta.camadas);
        Ok(())
    }

    fn ler_compassos(&mut self, xml: Node, idx_pauta: usize) -> Result<Pauta, String> {
        let mut pauta = Pauta::nova();
        for (ci, compasso) in xml
            .children()
            .filter(|c| c.has_tag_name("Measure"))
            .enumerate()
        {
            // A estrutura de repetição é lida só da primeira pauta (as outras repetem as mesmas marcas).
            if idx_pauta == 0 {
                self.estrutura.inicios.push(pauta.inicio);
                self.estrutura.registrar_marcas(compasso, ci);
            }
            let tamanho = pauta.tamanho_do_compasso(compasso);
            for fonte in fontes_do_compasso(compasso) {
                self.percorrer_fonte(&mut pauta, tamanho, fonte)?;
            }
            pauta.inicio += tamanho;
        }
        Ok(pauta)
    }

    fn percorrer_fonte(
        &mut self,
        pauta: &mut Pauta,
        tamanho: f64,
        fonte: Fonte,
    ) -> Result<(), String> {
        let (voz, plano, no) = fonte;
        let mut asteriscos_pendentes: Vec<usize> = vec![]; // por compasso e voz: um "*" sem nota depois dele vale o fim da nota anterior
        let mut est = Estado {
            andamento: self.andamento,
            tuplos: vec![],
            compasso: tamanho,
            plano,
            voz_base: voz,
            divisao: self.divisao,
            saida: &mut pauta.camadas,
            silabas: &mut pauta.silabas,
            respiracoes: &mut pauta.respiracoes,
            asteriscos: &mut self.asteriscos,
            asteriscos_pendentes: &mut asteriscos_pendentes,
        };
        let mut t = pauta.inicio;
        percorrer(no, &mut t, &mut est)?;
        self.andamento = est.andamento;
        Ok(())
    }
}

/// O nome da pauta: o da parte (ou "Voz id" se a parte não tem nome) e o sufixo `(pauta N)` se a parte tem várias pautas.
fn nome_da_pauta(id: &str, info: (String, usize, usize)) -> NomeDaPauta {
    let (nome_parte, pos_pauta, total) = info;
    let base = if nome_parte.is_empty() {
        format!("Voz {id}")
    } else {
        nome_parte
    };
    let sufixo = if total > 1 {
        format!(" (pauta {pos_pauta})")
    } else {
        String::new()
    };
    NomeDaPauta::nova(base, sufixo)
}

/// O aviso das notas do meio omitidas, quando houve trechos com mais notas simultâneas que vozes.
pub(crate) fn avisar_omitidos(quem: &str, omitidos: usize) -> Option<String> {
    (omitidos > 0).then(|| {
        format!(
            "{quem}: {omitidos} trecho(s) com mais notas simultâneas que vozes; notas do meio omitidas"
        )
    })
}
