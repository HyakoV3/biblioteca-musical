//! A letra de uma pauta: correções do arquivo, separação do final ou do coro e montagem das linhas.

use crate::coro::{separar_o_final, separar_sem_plano};
use crate::correcoes;
use crate::leitura::Leitura;
use crate::montagem::montar_letra;
use crate::percurso::Silaba;

impl Leitura<'_> {
    /// A letra sai da primeira pauta que tem sílabas: corrigida pelo arquivo de correções e com o final (ou o coro) separado.
    pub(crate) fn montar_a_letra(&mut self, mut silabas: Vec<Silaba>, respiracoes: Vec<f64>) {
        if !self.letra.is_empty() || silabas.is_empty() {
            return;
        }
        self.correcoes_tentadas = true;
        self.avisos.extend(correcoes::aplicar(
            &mut silabas,
            self.numero_hino,
            self.ajustes,
        ));
        // Guarda a letra já corrigida, antes de separar o final: se o final for descartado, a letra é refeita sem o plano.
        self.letra_base = Some((silabas.clone(), respiracoes.clone()));
        self.separar_final_ou_coro(&mut silabas);
        (self.letra, self.marcas) = montar_letra(silabas, respiracoes);
    }

    fn separar_final_ou_coro(&mut self, silabas: &mut [Silaba]) {
        let segunda_casa = self
            .plano
            .as_ref()
            .and_then(|p| p.final_.last())
            .map(|&(a2, _)| a2);
        let Some(a2) = segunda_casa else {
            separar_sem_plano(silabas, &mut self.avisos);
            return;
        };
        let no_final = separar_o_final(silabas, self.estrutura.inicios[a2]);
        if no_final > 0 {
            self.avisos.push(format!(
                "final separado: {no_final} sílabas cantadas só na última vez viraram o bloco \"Final\""
            ));
        }
    }
}
