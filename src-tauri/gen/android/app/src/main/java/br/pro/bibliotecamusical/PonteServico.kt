package br.pro.bibliotecamusical

import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
import java.lang.ref.WeakReference

/**
 * Ponte entre o JavaScript do app e o serviço de reprodução (I-22), exposta à WebView como `window.BmServico`. O app só carrega conteúdo
 * local, e a ponte só aceita um título de hino (texto) e o pedido de ligar ou desligar o serviço; não lê nada do aparelho.
 * Os métodos chegam em uma thread da WebView, então tudo o que mexe no Android passa para a thread principal.
 */
class PonteServico(private val atividade: MainActivity, webView: WebView) {
    private val controle = ControleDoServico(atividade)

    init {
        // A notificação do serviço tem o botão "Parar": o toque avisa o JavaScript, que para o hino de verdade (`reproducao.parar()`). O campo é
        // estático e sobrevive à Activity, então só guarda uma referência FRACA da WebView; a `MainActivity` o limpa em `onDestroy` (ver `soltar`).
        val fraca = WeakReference(webView)
        ServicoAudio.aoPararGravacao = { avisarJs(fraca, "__bmGravacaoParadaPelaNotificacao") }
        ServicoAudio.aoPararMetronomo = { avisarJs(fraca, "__bmMetronomoParadoPelaNotificacao") }
        ServicoAudio.aoFalharMetronomo = { avisarJs(fraca, "__bmServicoDoMetronomoFalhou") }
        ServicoAudio.aoFalhar = { avisarJs(fraca, "__bmServicoDeGravacaoFalhou") }
        ServicoAudio.aoParar = { avisarJs(fraca, "__bmParadoPelaNotificacao") }
    }

    /** Solta o aviso do botão "Parar" quando a Activity é destruída (ela e a WebView não podem ficar presas a um campo estático). */
    fun soltar() {
        ServicoAudio.aoParar = null
        ServicoAudio.aoPararGravacao = null
        ServicoAudio.aoFalhar = null
        ServicoAudio.aoPararMetronomo = null
        ServicoAudio.aoFalharMetronomo = null
    }

    @JavascriptInterface
    fun iniciar(titulo: String) {
        atividade.runOnUiThread {
            ServicoAudio.tocando = true
            controle.ligar(titulo)
        }
    }

    @JavascriptInterface
    fun parar() {
        atividade.runOnUiThread {
            ServicoAudio.tocando = false
            controle.desligarSeOcioso()
        }
    }

    /** O Gravador começou a gravar: o serviço (agora também com o tipo microfone) mantém a gravação viva com a tela bloqueada ou o app em segundo plano. */
    @JavascriptInterface
    fun iniciarGravacao() {
        atividade.runOnUiThread {
            ServicoAudio.gravando = true
            controle.ligar("")
        }
    }

    /** O metrônomo ligou: o serviço (tipo mídia, wake lock sem limite) mantém o clique vivo com a tela bloqueada ou o app em segundo plano. */
    @JavascriptInterface
    fun iniciarMetronomo() {
        atividade.runOnUiThread {
            ServicoAudio.metronomo = true
            controle.ligar("")
        }
    }

    @JavascriptInterface
    fun pararMetronomo() {
        atividade.runOnUiThread {
            ServicoAudio.metronomo = false
            controle.desligarSeOcioso()
        }
    }

    @JavascriptInterface
    fun pararGravacao() {
        atividade.runOnUiThread {
            ServicoAudio.gravando = false
            controle.desligarSeOcioso()
        }
    }

    /** Há fone ligado (com fio, USB ou Bluetooth)? Com ele o hino pode tocar durante a gravação sem entrar no microfone. */
    @JavascriptInterface
    fun temFone(): Boolean {
        return SaidaDeAudio.temFone(atividade)
    }

    /**
     * Mantém a tela acesa (`FLAG_KEEP_SCREEN_ON` da janela) enquanto `ligar` for verdadeiro; falso devolve a tela ao tempo do sistema.
     * A janela só aceita a mudança na thread principal.
     */
    @JavascriptInterface
    fun manterTela(ligar: Boolean) {
        atividade.runOnUiThread {
            try {
                if (ligar) atividade.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                else atividade.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            } catch (e: Exception) {
                android.util.Log.w("bm", "não deu para mexer na tela ligada", e)
            }
        }
    }

    /**
     * De onde o som sai agora: "usb" (fone ou cabo com conversor na USB-C), "fio" (3,5 mm), "bluetooth" ou "alto-falante". Com várias saídas
     * ligadas vale a ordem do Android (USB, depois fio, depois Bluetooth). O app escolhe o modo de áudio POR rota (as rotas estalam diferente).
     */
    @JavascriptInterface
    fun rotaDeSaida(): String {
        return SaidaDeAudio.rota(atividade)
    }
}

/** Chama `window.<funcao>()` na WebView (na thread dela), se ela ainda existir e a função estiver definida. */
private fun avisarJs(fraca: WeakReference<WebView>, funcao: String) {
    fraca.get()?.let { wv ->
        wv.post { wv.evaluateJavascript("window.$funcao && window.$funcao()", null) }
    }
}
