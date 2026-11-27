//! O final de um hino: valer ou ser descartado, e os avisos de correções e de estrutura que dependem disso.

use crate::coro::separar_sem_plano;
use crate::leitura::{Leitura, avisar_omitidos};
use crate::montagem::montar_letra;
use crate::vozes::dividir_em_vozes;
use roxmltree::Document;

impl Leitura<'_> {
    pub(crate) fn avisar_correcoes_sem_letra(&mut self) {
        if !self.ajustes.is_empty() && !self.correcoes_tentadas {
            self.avisos.push(format!(
                "hino {}: {} correção(ões) da letra NÃO aplicada(s), porque a partitura não tem letra",
                self.numero_hino,
                self.ajustes.len()
            ));
        }
    }

    /// O final vale quando as vozes dele casam com as da passada normal; senão é descartado e tudo é refeito sem o plano.
    /// Devolve se foi descartado.
    pub(crate) fn decidir_o_final(&mut self) -> bool {
        let descartado = self.plano.is_some() && !(self.final_ok && !self.vozes_final.is_empty());
        if descartado {
            self.refazer_sem_plano();
        } else {
            self.avisos.append(&mut self.avisos_do_recorte);
        }
        descartado
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

    pub(crate) fn avisar_estrutura(&mut self, doc: &Document, final_descartado: bool) {
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
}
