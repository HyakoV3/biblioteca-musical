[Português](SECURITY.md) · [English](SECURITY.en.md) · **Español**

# Seguridad

## Cómo reportar una vulnerabilidad

No abra una *issue* pública con detalles de una falla de seguridad. Use **Security, Report a vulnerability** en este repositorio (reporte privado de GitHub). Si esa opción no aparece, abra una *issue* solo pidiendo un contacto privado, sin describir la falla.

## Qué hace la app con la red y con los datos

- No tiene cuenta ni inicio de sesión, y no envía datos de uso.
- Por la red, la app solo accede a **una dirección**, de paquetes opcionales: el repositorio público de paquetes en GitHub (**himnario, partituras y sonidos grabados**). El servidor del responsable (File Browser) dejó de ser usado por la app el 2026-11-24 y solo sirve APK antiguos. Ese permiso está restringido, en `src-tauri/capabilities/default.json`, a una ruta de GitHub (`.../biblioteca-musical-pacotes/releases/download/*`). GitHub redirige la descarga a su almacenamiento de assets, y el plugin no restringe ese destino (solo la URL inicial); el contenido sigue protegido por el SHA-256 de cada archivo, verificado contra el manifiesto incluido en la app.
- Cada paquete descargado se verifica por **tamaño y SHA-256** contra el manifiesto que va dentro de la app (`src/lib/hinario/manifesto.json`, `src/lib/partituras/manifesto.json` y `src/lib/sons/manifesto.json`) antes de guardarse. Un paquete adulterado, incompleto o de tamaño absurdo (zip "bomba": la descarga tiene un tope de 100 MiB) se rechaza completo; en Rust, cada partitura pasa además por una limpieza del SVG (lista de elementos permitidos). Detalles en [`docs/pacote-do-hinario.md`](docs/pacote-do-hinario.md), [`docs/pacote-de-partituras.md`](docs/pacote-de-partituras.md) y [`docs/pacote-de-sons.md`](docs/pacote-de-sons.md) (en portugués).
- **Micrófono:** solo el Grabador y el "¿Qué nota es esta?" del Afinador lo usan, con el permiso pedido solo al grabar o al tocar en Escuchar (el Afinador no graba nada: lee el sonido y lo descarta); la grabación queda en el aparato y solo sale cuando la persona toca **Compartir** (hoja de compartir del sistema). El `FileProvider` que entrega la grabación a la otra app expone solo la subcarpeta `compartilhar/` de la caché de la propia app, y no todo el almacenamiento.
- **Defensa en profundidad de la ventana:** la app tiene una CSP restrictiva (`app.security.csp` en `src-tauri/tauri.conf.json`: sin `unsafe-eval`, sin `*`, scripts solo de la propia app y `wasm-unsafe-eval` para los filtros de ruido), la ventana solo navega dentro del origen de la app (`on_navigation` en `src-tauri/src/lib.rs`; la app no tiene enlaces externos) y el plugin `opener` fue eliminado (la app no abre enlaces). Las copias de grabaciones enviadas quedan en `cache/compartilhar/` y se borran tras una hora, al abrir la app y en el "Borrar todas" del Grabador. `tests/seguranca.test.ts` fija la CSP, los permisos y el `FileProvider`.
- El contenido de los himnarios (letras y partituras) **no está en este repositorio**: solo código y datos de prueba ficticios.

## Versiones

El proyecto está en desarrollo (0.x) y no hay versión publicada en una tienda. Las correcciones de seguridad entran en `main`.
