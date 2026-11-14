mod hinario;

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
fn carregar_hinario(app: tauri::AppHandle) -> Result<hinario::Pacote, String> {
    hinario::carregar(pasta_conteudo(&app).ok().as_deref())
}

/// Valida e importa o conteúdo de um `hinario.json` escolhido pelo usuário.
#[tauri::command]
fn importar_hinario(app: tauri::AppHandle, json: String) -> Result<hinario::Pacote, String> {
    hinario::importar(&pasta_conteudo(&app)?, &json)
}

/// Apaga o conteúdo importado e volta ao pacote de exemplo.
#[tauri::command]
fn remover_conteudo(app: tauri::AppHandle) -> Result<hinario::Pacote, String> {
    hinario::remover(&pasta_conteudo(&app)?)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            carregar_hinario,
            importar_hinario,
            remover_conteudo
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
