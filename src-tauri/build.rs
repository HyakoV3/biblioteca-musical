use std::{env, fs, path::PathBuf};

fn main() {
    // Pacote de conteúdo opcional que o build leva DENTRO do binário (para APKs de teste fechado).
    // Uso: BMCCB_PACOTE=/caminho/hinario.json npm run tauri android build ...
    // O arquivo nunca entra no Git: só o caminho é informado na hora do build. Sem a variável, o app
    // não leva conteúdo nenhum além do pacote de exemplo fictício.
    println!("cargo:rerun-if-env-changed=BMCCB_PACOTE");
    let conteudo = match env::var("BMCCB_PACOTE") {
        Ok(caminho) if !caminho.trim().is_empty() => {
            println!("cargo:rerun-if-changed={caminho}");
            fs::read_to_string(&caminho)
                .unwrap_or_else(|e| panic!("BMCCB_PACOTE: não foi possível ler {caminho}: {e}"))
        }
        _ => String::new(),
    };
    let saida = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR")).join("pacote_incluso.json");
    fs::write(saida, conteudo).expect("gravar pacote_incluso.json");

    tauri_build::build()
}
