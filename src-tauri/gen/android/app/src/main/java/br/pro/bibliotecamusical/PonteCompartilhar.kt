package br.pro.bibliotecamusical

import android.content.Intent
import android.util.Base64
import android.webkit.JavascriptInterface
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.FutureTask
import java.util.concurrent.TimeUnit

/**
 * Ponte para compartilhar uma gravação do Gravador, exposta à WebView como `window.BmCompartilhar`. O JavaScript entrega o áudio em pedaços
 * (base64: `comecar`, `parte`..., `enviar`); aqui ele vira um arquivo no cache do app e abre a folha de compartilhamento do sistema, que mostra
 * os apps mais usados da pessoa (WhatsApp etc.). Só escreve dentro de `cache/compartilhar` (o nome é saneado) e não lê nada do aparelho.
 * Os métodos chegam em uma thread da WebView; só abrir a folha passa para a thread principal (e a ponte espera o resultado).
 * Cada envio usa uma subpasta própria (`cache/compartilhar/<instante>/`), e só pastas com mais de uma hora são apagadas: o app de destino
 * (WhatsApp etc.) pode ainda estar lendo o arquivo de um envio anterior. O JavaScript envia um de cada vez.
 */
class PonteCompartilhar(private val atividade: MainActivity) {
    private var saida: FileOutputStream? = null
    private var arquivo: File? = null
    private var mime = "audio/*"
    private val umaHora = 60L * 60 * 1000

    private fun pasta() = File(atividade.cacheDir, "compartilhar")

    /** Começa um novo arquivo, numa subpasta nova. Envios com mais de uma hora são apagados (a pasta não cresce). Devolve false se não deu para criar. */
    @JavascriptInterface
    @Synchronized
    fun comecar(nome: String, tipo: String): Boolean {
        cancelar()
        return try {
            val agora = System.currentTimeMillis()
            val raiz = pasta()
            raiz.mkdirs()
            raiz.listFiles()?.forEach { if (agora - it.lastModified() > umaHora) it.deleteRecursively() }
            val dir = File(raiz, agora.toString())
            dir.mkdirs()
            val limpo = nome.replace(Regex("[^A-Za-z0-9._-]"), "_").take(80).ifEmpty { "gravacao" }
            val f = File(dir, limpo)
            saida = FileOutputStream(f)
            arquivo = f
            mime = if (tipo.matches(Regex("[a-z]+/[a-z0-9.+-]+"))) tipo else "audio/*"
            true
        } catch (e: Exception) {
            android.util.Log.w("bm", "compartilhar: não criou o arquivo", e)
            cancelar()
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
            android.util.Log.w("bm", "compartilhar: falhou ao gravar um pedaço", e)
            cancelar()
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
            cancelar()
            return false
        }
        saida = null
        if (f == null || !f.exists() || f.length() == 0L) {
            cancelar()
            return false
        }
        return try {
            val uri = FileProvider.getUriForFile(atividade, "${atividade.packageName}.fileprovider", f)
            val envio = Intent(Intent.ACTION_SEND).apply {
                type = mime
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val folha = Intent.createChooser(envio, titulo.take(80))
            // Espera a folha abrir para devolver o resultado de verdade (a exceção de `startActivity` acontece na thread principal).
            val abrir = FutureTask<Boolean> {
                try {
                    atividade.startActivity(folha)
                    true
                } catch (e: Exception) {
                    android.util.Log.w("bm", "compartilhar: não abriu a folha", e)
                    false
                }
            }
            atividade.runOnUiThread(abrir)
            val abriu = abrir.get(5, TimeUnit.SECONDS)
            if (!abriu) cancelar() else arquivo = null // aberta: o arquivo fica para o app de destino ler
            abriu
        } catch (e: Exception) {
            android.util.Log.w("bm", "compartilhar: não preparou o envio", e)
            false
        }
    }

    /** Descarta o envio em andamento: fecha o arquivo e apaga o que já foi escrito. Chamada pelo JavaScript quando algo falha depois de `comecar`. */
    @JavascriptInterface
    @Synchronized
    fun cancelar() {
        try {
            saida?.close()
        } catch (_: Exception) {
        }
        saida = null
        arquivo?.let { it.parentFile?.deleteRecursively() }
        arquivo = null
    }

    /** A Activity foi destruída no meio de um envio: não deixa o arquivo aberto. */
    fun soltar() = cancelar()
}
