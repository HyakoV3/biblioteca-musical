[Português](apk-de-teste.md) · [English](apk-de-teste.en.md) · **Español**

# APK de prueba cerrada

> Esta página traduce solo la guía para quien prueba y un resumen para quien publica. El registro completo (cómo se genera y firma el APK, el historial de versiones y las verificaciones después de cada merge) está en portugués en [`apk-de-teste.md`](apk-de-teste.md).

## Para quien va a probar

La app es **independiente y no oficial** (no tiene vínculo con la Congregación Cristiana en Brasil) y está en **prueba cerrada**: todavía puede fallar. Para instalarla:

1. **Descargue la versión más nueva** en la página de [Releases](https://github.com/HyakoV3/biblioteca-musical/releases) del proyecto (la de arriba de la lista).
2. **Descargue el archivo que termina en `.apk`** (por ejemplo `bibliotecamusical-0.3.10.apk`). Ignore el `.aab` y el `SHA256SUMS`: no son para instalar.
3. **Permita la instalación desde fuera de la tienda** cuando Android lo pregunte (la opción "Instalar apps desconocidas" del navegador o del administrador de archivos) y toque el archivo para instalar.
4. **Al actualizar, instale encima**: no desinstale. **Desinstalar borra las grabaciones guardadas y los paquetes descargados** (la app no hace copia de seguridad de las grabaciones). Si necesita desinstalar, comparta antes, con el botón **Compartir** del Grabador, las grabaciones que quiera conservar.
5. **Compruebe la versión** en Ajustes, "Acerca de la app", e indíquela al reportar un problema.
6. **Para reportar:** cuente a quien le pasó el enlace qué hizo, qué esperaba y qué ocurrió, y la versión. No envíe datos personales.

La app ya abre con **5 himnos de ejemplo** (dominio público, con letra y partitura) para que vea cómo funciona. En el primer acceso ofrece **descargar el himnario** (cerca de 4 MB); las partituras y los sonidos grabados son opcionales, en Ajustes, "Contenido". Una vez descargados, todo funciona sin conexión.

## Para quien publica

Los APK salen por el Release de GitHub. El contenido (himnario y partituras) **no va dentro del APK**: la app lo descarga del repositorio `HyakoV3/biblioteca-musical-pacotes`. La autorización del transcriptor para distribuir ese contenido está registrada en [`licencas-de-terceiros.md`](licencas-de-terceiros.md); **no cubre** a los autores de las letras y de la música ni la edición del himnario. Antes de cualquier publicación abierta (tienda o tag final), esos derechos deben decidirse.

Una compilación puede, si hace falta, llevar un `hinario.json` **dentro del binario** (el historial de la página en portugués cuenta cómo). El contenido **nunca entra en Git**: solo se informa la ruta del archivo en el momento de compilar.
