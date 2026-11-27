//! As vozes de uma pauta: a passada normal e, com o padrão de final reconhecido, a passada do final.

use crate::leitura::{Leitura, avisar_omitidos};
use crate::partes::NomeDaPauta;
use crate::percurso::Acorde;
use crate::recortes::selecionar;
use crate::vozes::dividir_em_vozes;
use std::collections::BTreeMap;

impl Leitura<'_> {
    /// As vozes da pauta. Com o padrão de final reconhecido, saem as notas da passada normal e as da passada do final.
    pub(crate) fn montar_as_vozes(
        &mut self,
        nome: NomeDaPauta,
        camadas: BTreeMap<usize, Vec<Acorde>>,
    ) {
        let camadas: Vec<Vec<Acorde>> = camadas.into_values().collect();
        let Some(plano) = &self.plano else {
            let (linhas, omitidos) = dividir_em_vozes(camadas, nome.limite());
            self.avisos
                .extend(avisar_omitidos(&nome.rotulo(), omitidos));
            self.vozes.extend(nome.nomear(linhas));
            return;
        };
        // Guarda as notas inteiras: se o final for descartado, as vozes são refeitas com a leitura única.
        self.pautas_guardadas.push((nome.clone(), camadas.clone()));
        let recorte = |segmentos: &[(usize, usize)]| -> Vec<Vec<Acorde>> {
            camadas
                .iter()
                .map(|c| selecionar(c, &self.estrutura.inicios, segmentos))
                .collect()
        };
        let (normal, final_) = (recorte(&plano.normal), recorte(&plano.final_));
        // Com o plano, a contagem é a da leitura recortada: só vale se o final for aceito.
        let (linhas, omitidos) = dividir_em_vozes(normal, nome.limite());
        self.avisos_do_recorte
            .extend(avisar_omitidos(&nome.rotulo(), omitidos));
        let max = linhas.len();
        self.vozes.extend(nome.nomear(linhas));
        self.montar_vozes_do_final(final_, &nome, max);
    }

    fn montar_vozes_do_final(&mut self, camadas: Vec<Vec<Acorde>>, nome: &NomeDaPauta, max: usize) {
        let (linhas, omitidos) = dividir_em_vozes(camadas, nome.limite());
        let quem = format!("{} (passada do final)", nome.rotulo());
        self.avisos_do_recorte
            .extend(avisar_omitidos(&quem, omitidos));
        if linhas.len() == max {
            self.vozes_final.extend(nome.nomear(linhas));
            return;
        }
        // As vozes do final precisam corresponder uma a uma às da passada normal.
        self.final_ok = false;
        self.avisos.push(format!(
            "{}: a passada do final tem {} voz(es) e a normal {max}; o final foi descartado",
            nome.rotulo(),
            linhas.len()
        ));
    }
}
