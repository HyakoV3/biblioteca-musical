package br.pro.bibliotecamusical.ccb

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.webkit.JavascriptInterface
import android.webkit.WebView

/**
 * Ponte entre o JavaScript do app e o serviço de reprodução (I-22), exposta à WebView como `window.BmccbServico`. O app só carrega conteúdo
 * local, e a ponte só aceita um título de hino (texto) e o pedido de ligar ou desligar o serviço; não lê nada do aparelho.
 * Os métodos chegam em uma thread da WebView, então tudo o que mexe no Android passa para a thread principal.
 */
class PonteServico(private val atividade: MainActivity, private val webView: WebView) {
    private var pediuNotificacao = false

    init {
        // A notificação do serviço tem o botão "Parar": o toque avisa o JavaScript, que para o hino de verdade (`reproducao.parar()`).
        ServicoAudio.aoParar = {
            webView.post { webView.evaluateJavascript("window.__bmccbParadoPelaNotificacao && window.__bmccbParadoPelaNotificacao()", null) }
        }
    }

    @JavascriptInterface
    fun iniciar(titulo: String) {
        atividade.runOnUiThread {
            pedirPermissaoDeNotificacao()
            val intent = Intent(atividade, ServicoAudio::class.java).putExtra(ServicoAudio.EXTRA_TITULO, titulo.take(120))
            try {
                atividade.startForegroundService(intent)
            } catch (e: Exception) {
                // O Android pode recusar (app fora da tela, restrição do fabricante): o hino segue tocando como antes, só sem a proteção.
                android.util.Log.w("bmccb", "serviço de reprodução não iniciou", e)
            }
        }
    }

    @JavascriptInterface
    fun parar() {
        atividade.runOnUiThread { atividade.stopService(Intent(atividade, ServicoAudio::class.java)) }
    }

    /** Android 13 em diante: sem a permissão o serviço roda, mas a notificação (e o botão "Parar") não aparece. Pede uma vez por abertura do app. */
    private fun pedirPermissaoDeNotificacao() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || pediuNotificacao) return
        if (atividade.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return
        pediuNotificacao = true
        atividade.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS)) { }
    }
}
