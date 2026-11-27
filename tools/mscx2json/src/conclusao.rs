//! O fim da conversão: com as pautas lidas, decide o final, a sincronia, a introdução, os compassos e a tonalidade e monta o hino.

use crate::estrutura::Plano;
use crate::leitura::Leitura;
use crate::modelo::{Compassos, Hino, Marca, Sincronia, Voz, arredondar};
use crate::recortes::{compassos_da_introducao, compassos_da_passada, recortar_inicio};
use crate::sincronia::estrofes_da_passada;
use crate::tonalidade::{ler_armadura, modo_pelo_baixo, nome_da_tonalidade};
use crate::xml::{texto_completo, texto_de_estilo};
use roxmltree::Document;

/// Título: texto de moldura com estilo "Title"; senão o metadado workTitle; senão "Hino N".
fn titulo_do_hino(doc: &Document, numero_hino: u32) -> String {
    texto_de_estilo(doc, &["Title"])
        .into_iter()
        .next()
        .or_else(|| {
            doc.descendants()
                .find(|n| n.has_tag_name("metaTag") && n.attribute("name") == Some("workTitle"))
                .map(texto_completo)
                .filter(|s| !s.is_empty())
        })
        .unwrap_or_else(|| format!("Hino {numero_hino}"))
}

/// Autoria: textos de moldura com estilo "Lyricist" e "Composer", sem repetir e na ordem do arquivo.
fn autoria_do_hino(doc: &Document) -> Option<String> {
    let mut nomes: Vec<String> = vec![];
    for n in texto_de_estilo(doc, &["Lyricist", "Composer"]) {
        if !nomes.contains(&n) {
            nomes.push(n);
        }
    }
    (!nomes.is_empty()).then(|| nomes.join(" · "))
}

/// Os recortes da partitura por passada: o plano de repetição, onde cada compasso começa e as marcas da letra.
struct Recortes<'a> {
    plano: Option<&'a Plano>,
    inicios: &'a [f64],
    marcas: &'a [Marca],
    /// O final foi aceito (tem passada do final).
    tem_final: bool,
}

impl Recortes<'_> {
    /// Os compassos que a passada normal toca: os do plano, ou a partitura toda sem plano.
    fn trechos_normais(&self) -> Vec<(usize, usize)> {
        match self.plano {
            Some(p) => p.normal.clone(),
            None => vec![(0, self.inicios.len() - 1)],
        }
    }

    /// O plano, só quando o final foi aceito (a passada do final).
    fn plano_do_final(&self) -> Option<&Plano> {
        self.plano.filter(|_| self.tem_final)
    }

    /// Sincronia da letra (karaokê): o instante de cada sílaba na régua de cada passada. A passada normal toca os
    /// compassos do plano (ou a partitura toda, sem plano); a do final, só quando o final foi aceito.
    fn sincronia(&self) -> Option<Sincronia> {
        if self.marcas.is_empty() || self.inicios.len() < 2 {
            return None;
        }
        let normal = estrofes_da_passada(self.marcas, &self.trechos_normais(), self.inicios);
        let final_ = self
            .plano_do_final()
            .map(|p| estrofes_da_passada(self.marcas, &p.final_, self.inicios))
            .filter(|f| !f.is_empty());
        (!normal.is_empty()).then_some(Sincronia {
            normal,
            passada_final: final_,
        })
    }

    /// Compassos de cada fluxo (I-12, fase B): a passada normal toca os compassos do plano (ou a partitura toda, sem plano); a do final, só quando
    /// o final foi aceito; a introdução, os que começam antes do "*". Mesma régua das notas das vozes de cada fluxo.
    fn compassos(&self, fim_intro: Option<f64>) -> Option<Compassos> {
        if self.inicios.len() < 2 {
            return None;
        }
        Some(Compassos {
            normal: compassos_da_passada(self.inicios, &self.trechos_normais()),
            passada_final: self
                .plano_do_final()
                .map(|p| compassos_da_passada(self.inicios, &p.final_)),
            introducao: fim_intro.map(|fim| compassos_da_introducao(self.inicios, fim)),
        })
    }
}

/// O que sai da leitura além das vozes da passada normal: a passada do final, a sincronia, a introdução e os compassos.
struct Fluxos {
    passada_final: Option<Vec<Voz>>,
    sincronia: Option<Sincronia>,
    introducao: Option<Vec<Voz>>,
    compassos: Option<Compassos>,
}

impl Leitura<'_> {
    pub(crate) fn concluir(mut self, doc: &Document) -> Result<Hino, String> {
        self.avisar_correcoes_sem_letra();
        let final_descartado = self.decidir_o_final();
        self.avisar_estrutura(doc, final_descartado);
        let fluxos = self.fluxos();
        if self.vozes.is_empty() {
            return Err("nenhuma nota encontrada".into());
        }
        Ok(self.montar_hino(doc, fluxos))
    }

    fn fluxos(&mut self) -> Fluxos {
        let tem_final = self.final_ok && !self.vozes_final.is_empty();
        let passada_final = tem_final.then(|| std::mem::take(&mut self.vozes_final));
        let introducao = self.introducao();
        let recortes = Recortes {
            plano: self.plano.as_ref(),
            inicios: &self.estrutura.inicios,
            marcas: &self.marcas,
            tem_final,
        };
        let fim_intro = introducao.as_ref().map(|(_, fim)| *fim);
        Fluxos {
            sincronia: recortes.sincronia(),
            compassos: recortes.compassos(fim_intro),
            introducao: introducao.map(|(vozes, _)| vozes),
            passada_final,
        }
    }

    fn montar_hino(mut self, doc: &Document, fluxos: Fluxos) -> Hino {
        let titulo = titulo_do_hino(doc, self.numero_hino);
        let autoria = autoria_do_hino(doc);
        let (armadura, modo) = self.tonalidade(doc, fluxos.passada_final.as_deref());
        Hino {
            numero: self.numero_hino,
            titulo,
            autoria,
            andamento: self.andamento,
            armadura,
            modo,
            vozes: self.vozes,
            passada_final: fluxos.passada_final,
            introducao: fluxos.introducao,
            letra: self.letra,
            sincronia: fluxos.sincronia,
            compassos: fluxos.compassos,
            avisos: self.avisos,
        }
    }

    /// Introdução: do começo até o fim da nota que leva o primeiro "*" (o autor o escreve sobre a última nota da introdução, que fecha com a
    /// respiração). Sai das vozes já montadas, então tem as mesmas vozes, na mesma ordem. Devolve também onde ela termina, em batidas.
    fn introducao(&mut self) -> Option<(Vec<Voz>, f64)> {
        let fim = self
            .asteriscos
            .iter()
            .copied()
            .fold(f64::INFINITY, f64::min);
        if !fim.is_finite() || fim <= 0.0 {
            return None;
        }
        let intro = recortar_inicio(&self.vozes, fim)?;
        self.avisos.push(format!(
            "introdução: do começo até o marcador * ({} batidas)",
            arredondar(fim)
        ));
        Some((intro, fim))
    }

    /// Armadura e modo: o escrito no arquivo, ou o deduzido do baixo (maior, com aviso, se nada bate).
    fn tonalidade(&mut self, doc: &Document, final_: Option<&[Voz]>) -> (i8, &'static str) {
        let (armadura, modo_escrito, aviso_armadura) = ler_armadura(doc);
        self.avisos.extend(aviso_armadura);
        let modo = modo_escrito
            .or_else(|| modo_pelo_baixo(armadura, &self.vozes, final_))
            .unwrap_or_else(|| {
                self.avisos.push(format!(
                    "tonalidade: o baixo não termina na tônica de {}; assumido maior",
                    nome_da_tonalidade(armadura, "maior")
                ));
                "maior"
            });
        (armadura, modo)
    }
}
