package br.pro.bibliotecamusical.ccb

import android.content.Intent
import android.util.Base64
import android.webkit.JavascriptInterface
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream

/**
 * Ponte para compartilhar uma gravação do Gravador, exposta à WebView como `window.BmccbCompartilhar`. O JavaScript entrega o áudio em pedaços
 * (base64: `comecar`, `parte`..., `enviar`); aqui ele vira um arquivo no cache do app e abre a folha de compartilhamento do sistema, que mostra
 * os apps mais usados da pessoa (WhatsApp etc.). Só escreve dentro de `cache/compartilhar` (o nome é saneado) e não lê nada do aparelho.
 * Os métodos chegam em uma thread da WebView; só abrir a folha passa para a thread principal.
 */
class PonteCompartilhar(private val atividade: MainActivity) {
    private var saida: FileOutputStream? = null
    private var arquivo: File? = null
    private var mime = "audio/*"

    private fun pasta() = File(atividade.cacheDir, "compartilhar")

    /** Começa um novo arquivo. Os de envios anteriores são apagados (a pasta não cresce). Devolve false se não deu para criar. */
    @JavascriptInterface
    @Synchronized
    fun comecar(nome: String, tipo: String): Boolean {
        fechar()
        return try {
            val dir = pasta()
            dir.mkdirs()
            dir.listFiles()?.forEach { it.delete() }
            val limpo = nome.replace(Regex("[^A-Za-z0-9._-]"), "_").take(80).ifEmpty { "gravacao" }
            val f = File(dir, limpo)
            saida = FileOutputStream(f)
            arquivo = f
            mime = if (tipo.matches(Regex("[a-z]+/[a-z0-9.+-]+"))) tipo else "audio/*"
            true
        } catch (e: Exception) {
            android.util.Log.w("bmccb", "compartilhar: não criou o arquivo", e)
            fechar()
            false
        }
    }

    @JavascriptInterface
    @Synchronized
    fun parte(base64: String): Boolean {
        val s = saida ?: return false
        return try {
            s.write(Base64.decode(base64, Base64.DEFAULT))
            true
        } catch (e: Exception) {
            android.util.Log.w("bmccb", "compartilhar: falhou ao gravar um pedaço", e)
            fechar()
            false
        }
    }

    /** Fecha o arquivo e abre a folha de compartilhamento. Devolve false se algo falhou antes de abrir. */
    @JavascriptInterface
    @Synchronized
    fun enviar(titulo: String): Boolean {
        val f = arquivo
        try {
            saida?.close()
        } catch (e: Exception) {
            fechar()
            return false
        }
        saida = null
        if (f == null || !f.exists() || f.length() == 0L) return false
        return try {
            val uri = FileProvider.getUriForFile(atividade, "${atividade.packageName}.fileprovider", f)
            val envio = Intent(Intent.ACTION_SEND).apply {
                type = mime
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val folha = Intent.createChooser(envio, titulo.take(80))
            atividade.runOnUiThread {
                try {
                    atividade.startActivity(folha)
                } catch (e: Exception) {
                    android.util.Log.w("bmccb", "compartilhar: não abriu a folha", e)
                }
            }
            true
        } catch (e: Exception) {
            android.util.Log.w("bmccb", "compartilhar: não preparou o envio", e)
            false
        }
    }

    private fun fechar() {
        try {
            saida?.close()
        } catch (_: Exception) {
        }
        saida = null
        arquivo = null
    }
}
