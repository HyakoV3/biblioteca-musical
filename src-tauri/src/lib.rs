mod hinario;

use tauri::Manager;

/// Carrega o hinário de `<app_data>/content/hinario.json` ou o pacote de exemplo.
#[tauri::command]
fn carregar_hinario(app: tauri::AppHandle) -> Result<hinario::Pacote, String> {
    let dir = app.path().app_data_dir().ok().map(|d| d.join("content"));
    hinario::carregar(dir.as_deref())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![carregar_hinario])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
