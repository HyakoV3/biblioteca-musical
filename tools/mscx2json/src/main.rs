//! Converte partituras MuseScore em XML (.mscx) para o `hinario.json` do app.
//! Uso: mscx2json --id ID --nome NOME arquivo.mscx|pasta ... > hinario.json
//!
//! Cada arquivo deve se chamar `hino-<número>.mscx`. O tempo sai em batidas
//! (semínima = 1) e as notas em MIDI, como descrito em docs/FORMATO.md.

mod cli;
mod conserto;
mod conversao;
mod coro;
mod correcoes;
mod estrutura;
mod modelo;
mod montagem;
mod partes;
mod percurso;
mod saida;
mod sincronia;
mod tonalidade;
mod validacao;
mod versos;
mod vozes;
mod xml;

#[cfg(test)]
mod testes_apoio;
#[cfg(test)]
mod testes_compassos;
#[cfg(test)]
mod testes_conserto;
#[cfg(test)]
mod testes_coro;
#[cfg(test)]
mod testes_estrutura;
#[cfg(test)]
mod testes_final;
#[cfg(test)]
mod testes_leitura;
#[cfg(test)]
mod testes_saida;
#[cfg(test)]
mod testes_sincronia;
#[cfg(test)]
mod testes_texto;
#[cfg(test)]
mod testes_tonalidade;
#[cfg(test)]
mod testes_versos;
#[cfg(test)]
mod testes_vozes;

// Os nomes que o módulo `correcoes` (e os testes dele) pegam da raiz.
#[cfg(test)]
use montagem::montar_letra;
use percurso::Silaba;
use xml::sem_numero_inicial;

fn main() {
    if let Err(e) = cli::executar(std::env::args().skip(1).collect()) {
        eprintln!("erro: {e}");
        std::process::exit(1);
    }
}
