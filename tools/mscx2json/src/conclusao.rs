//! O fim da conversão: com as pautas lidas, decide o final, a sincronia, a introdução, os compassos e a tonalidade e monta o hino.

use crate::coro::separar_sem_plano;
use crate::estrutura::{compassos_da_introducao, compassos_da_passada, recortar_inicio};
use crate::leitura::{Leitura, avisar_omitidos};
use crate::modelo::{Compassos, Hino, Sincronia, Voz, arredondar};
use crate::montagem::montar_letra;
use crate::sincronia::estrofes_da_passada;
use crate::tonalidade::{ler_armadura, modo_pelo_baixo, nome_da_tonalidade};
use crate::vozes::dividir_em_vozes;
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

impl Leitura<'_> {
    pub(crate) fn concluir(mut self, doc: &Document) -> Result<Hino, String> {
        self.avisar_correcoes_sem_letra();
        let final_descartado =
            self.plano.is_some() && !(self.final_ok && !self.vozes_final.is_empty());
        if final_descartado {
            self.refazer_sem_plano();
        } else {
            self.avisos.append(&mut self.avisos_do_recorte);
        }
        self.avisar_estrutura(doc, final_descartado);
        let tem_final = self.final_ok && !self.vozes_final.is_empty();
        let passada_final = tem_final.then(|| std::mem::take(&mut self.vozes_final));
        let sincronia = self.sincronia(tem_final);
        let introducao = self.introducao();
        let fim_intro = introducao.as_ref().map(|(_, fim)| *fim);
        let compassos = self.compassos(tem_final, fim_intro);
        if self.vozes.is_empty() {
            return Err("nenhuma nota encontrada".into());
        }
        let titulo = titulo_do_hino(doc, self.numero_hino);
        let autoria = autoria_do_hino(doc);
        let (armadura, modo) = self.tonalidade(doc, passada_final.as_deref());
        Ok(Hino {
            numero: self.numero_hino,
            titulo,
            autoria,
            andamento: self.andamento,
            armadura,
            modo,
            vozes: self.vozes,
            passada_final,
            introducao: introducao.map(|(vozes, _)| vozes),
            letra: self.letra,
            sincronia,
            compassos,
            avisos: self.avisos,
        })
    }

    fn avisar_correcoes_sem_letra(&mut self) {
        if !self.ajustes.is_empty() && !self.correcoes_tentadas {
            self.avisos.push(format!(
                "hino {}: {} correção(ões) da letra NÃO aplicada(s), porque a partitura não tem letra",
                self.numero_hino,
                self.ajustes.len()
            ));
        }
    }

    /// MSCX-002: com o final descartado (as vozes do final não casam com as da passada normal), a passada normal NÃO pode ficar cortada na 1ª casa:
    /// perderia a 2ª casa e o trecho final, que a partitura manda tocar. Refaz as vozes com a leitura única, em ordem, como numa partitura sem plano.
    fn refazer_sem_plano(&mut self) {
        self.plano = None;
        self.vozes.clear();
        for (nome, camadas) in std::mem::take(&mut self.pautas_guardadas) {
            let (linhas, omitidos) = dividir_em_vozes(camadas, nome.limite());
            self.vozes.extend(nome.nomear(linhas));
            self.avisos
                .extend(avisar_omitidos(&nome.rotulo(), omitidos));
        }
        // A letra também volta ao caminho sem plano (coro e refrão trocado, sem o bloco "Final").
        if let Some((mut sil, resp)) = self.letra_base.take() {
            self.avisos.retain(|a| !a.starts_with("final separado:"));
            separar_sem_plano(&mut sil, &mut self.avisos);
            (self.letra, self.marcas) = montar_letra(sil, resp);
        }
        self.avisos.push(
            "final descartado: a partitura é lida uma vez, em ordem (com a 2ª casa e o trecho final), e não só até a 1ª casa".to_string(),
        );
    }

    fn avisar_estrutura(&mut self, doc: &Document, final_descartado: bool) {
        if let Some(p) = &self.plano {
            self.avisos.push(format!(
                "estrutura de repetição reconhecida: {}",
                p.descricao
            ));
            return;
        }
        let tem_repeticao = doc.descendants().any(|n| {
            matches!(
                n.tag_name().name(),
                "startRepeat" | "endRepeat" | "Jump" | "Volta"
            )
        });
        if !final_descartado && tem_repeticao {
            self.avisos.push(
                "há repetições/saltos numa estrutura não reconhecida: a partitura é lida uma vez, em ordem".to_string(),
            );
        }
    }

    /// Os compassos que a passada normal toca: os do plano, ou a partitura toda sem plano.
    fn trechos_normais(&self) -> Vec<(usize, usize)> {
        match &self.plano {
            Some(p) => p.normal.clone(),
            None => vec![(0, self.estrutura.inicios.len() - 1)],
        }
    }

    /// Sincronia da letra (karaokê): o instante de cada sílaba na régua de cada passada. A passada normal toca os
    /// compassos do plano (ou a partitura toda, sem plano); a do final, só quando o final foi aceito.
    fn sincronia(&self, tem_final: bool) -> Option<Sincronia> {
        let inicios = &self.estrutura.inicios;
        if self.marcas.is_empty() || inicios.len() < 2 {
            return None;
        }
        let normal = estrofes_da_passada(&self.marcas, &self.trechos_normais(), inicios);
        let final_ = self
            .plano
            .as_ref()
            .filter(|_| tem_final)
            .map(|p| estrofes_da_passada(&self.marcas, &p.final_, inicios))
            .filter(|f| !f.is_empty());
        (!normal.is_empty()).then_some(Sincronia {
            normal,
            passada_final: final_,
        })
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

    /// Compassos de cada fluxo (I-12, fase B): a passada normal toca os compassos do plano (ou a partitura toda, sem plano); a do final, só quando
    /// o final foi aceito; a introdução, os que começam antes do "*". Mesma régua das notas das vozes de cada fluxo.
    fn compassos(&self, tem_final: bool, fim_intro: Option<f64>) -> Option<Compassos> {
        let inicios = &self.estrutura.inicios;
        if inicios.len() < 2 {
            return None;
        }
        Some(Compassos {
            normal: compassos_da_passada(inicios, &self.trechos_normais()),
            passada_final: self
                .plano
                .as_ref()
                .filter(|_| tem_final)
                .map(|p| compassos_da_passada(inicios, &p.final_)),
            introducao: fim_intro.map(|fim| compassos_da_introducao(inicios, fim)),
        })
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
