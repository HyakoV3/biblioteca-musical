mod hinario;
mod pacote;
mod svg;

use std::path::PathBuf;
use tauri::Manager;

fn pasta_conteudo(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|d| d.join("content"))
        .map_err(|e| format!("pasta de dados indisponível: {e}"))
}

/// Carrega o hinário de `<app_data>/content/hinario.json` ou o pacote de exemplo.
#[tauri::command]
async fn carregar_hinario(app: tauri::AppHandle) -> Result<hinario::Pacote, String> {
    hinario::carregar(pasta_conteudo(&app).ok().as_deref())
}

/// Valida e importa o conteúdo de um `hinario.json` escolhido pelo usuário.
#[tauri::command]
async fn importar_hinario(app: tauri::AppHandle, json: String) -> Result<hinario::Pacote, String> {
    hinario::importar(&pasta_conteudo(&app)?, &json)
}

/// O andamento da instalação das partituras, que o Rust manda à interface por um canal: `feito` de `total` partituras tratadas.
#[derive(Clone, serde::Serialize)]
struct ProgressoInstalacao {
    feito: u32,
    total: u32,
}

/// Importa o pacote de partituras (`.zip` só com `partituras/hino-N.svg`, que o app baixou) que a interface manda em **base64**
/// (`zip`), para o hinário já instalado. Não pode ser corpo binário: no Android o Tauri não entrega `InvokeBody::Raw` (ver
/// `pacote::importar_base64_progresso`). É `async` para rodar fora da thread da interface.
#[tauri::command]
async fn importar_partituras(
    app: tauri::AppHandle,
    zip: String,
    ao_progresso: tauri::ipc::Channel<ProgressoInstalacao>,
) -> Result<pacote::Importacao, String> {
    pacote::importar_base64_progresso(&pasta_conteudo(&app)?, &zip, &mut |feito, total| {
        // Se a interface já não escuta, o aviso se perde sem problema: a importação segue.
        let _ = ao_progresso.send(ProgressoInstalacao { feito, total });
    })
}

/// Apaga só as partituras importadas (o hinário fica).
#[tauri::command]
async fn remover_partituras(app: tauri::AppHandle) -> Result<hinario::Pacote, String> {
    hinario::remover_partituras(&pasta_conteudo(&app)?)
}

/// O SVG da partitura do hino `numero` (já conferido pela limpeza de `svg.rs`), na versão para a tela: `paisagem` pede a larga.
#[tauri::command]
async fn ler_partitura(
    app: tauri::AppHandle,
    numero: u32,
    paisagem: bool,
) -> Result<String, String> {
    pacote::ler_partitura(&pasta_conteudo(&app)?, numero, paisagem)
}

/// Apaga o conteúdo importado e volta ao pacote de exemplo.
#[tauri::command]
async fn remover_conteudo(app: tauri::AppHandle) -> Result<hinario::Pacote, String> {
    hinario::remover(&pasta_conteudo(&app)?)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            carregar_hinario,
            importar_hinario,
            importar_partituras,
            remover_partituras,
            ler_partitura,
            remover_conteudo
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
