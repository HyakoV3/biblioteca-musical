package br.pro.bibliotecamusical

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
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
    private var pediuNotificacao = false

    init {
        // A notificação do serviço tem o botão "Parar": o toque avisa o JavaScript, que para o hino de verdade (`reproducao.parar()`). O campo é
        // estático e sobrevive à Activity, então só guarda uma referência FRACA da WebView; a `MainActivity` o limpa em `onDestroy` (ver `soltar`).
        val fraca = WeakReference(webView)
        ServicoAudio.aoPararGravacao = {
            fraca.get()?.let { wv ->
                wv.post { wv.evaluateJavascript("window.__bmGravacaoParadaPelaNotificacao && window.__bmGravacaoParadaPelaNotificacao()", null) }
            }
        }
        ServicoAudio.aoPararMetronomo = {
            fraca.get()?.let { wv ->
                wv.post { wv.evaluateJavascript("window.__bmMetronomoParadoPelaNotificacao && window.__bmMetronomoParadoPelaNotificacao()", null) }
            }
        }
        ServicoAudio.aoFalharMetronomo = {
            fraca.get()?.let { wv ->
                wv.post { wv.evaluateJavascript("window.__bmServicoDoMetronomoFalhou && window.__bmServicoDoMetronomoFalhou()", null) }
            }
        }
        ServicoAudio.aoFalhar = {
            fraca.get()?.let { wv ->
                wv.post { wv.evaluateJavascript("window.__bmServicoDeGravacaoFalhou && window.__bmServicoDeGravacaoFalhou()", null) }
            }
        }
        ServicoAudio.aoParar = {
            fraca.get()?.let { wv ->
                wv.post { wv.evaluateJavascript("window.__bmParadoPelaNotificacao && window.__bmParadoPelaNotificacao()", null) }
            }
        }
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
            ligar(titulo)
        }
    }

    @JavascriptInterface
    fun parar() {
        atividade.runOnUiThread {
            ServicoAudio.tocando = false
            desligarSeOcioso()
        }
    }

    /** O Gravador começou a gravar: o serviço (agora também com o tipo microfone) mantém a gravação viva com a tela bloqueada ou o app em segundo plano. */
    @JavascriptInterface
    fun iniciarGravacao() {
        atividade.runOnUiThread {
            ServicoAudio.gravando = true
            ligar("")
        }
    }

    /** O metrônomo ligou: o serviço (tipo mídia, wake lock sem limite) mantém o clique vivo com a tela bloqueada ou o app em segundo plano. */
    @JavascriptInterface
    fun iniciarMetronomo() {
        atividade.runOnUiThread {
            ServicoAudio.metronomo = true
            ligar("")
        }
    }

    @JavascriptInterface
    fun pararMetronomo() {
        atividade.runOnUiThread {
            ServicoAudio.metronomo = false
            desligarSeOcioso()
        }
    }

    @JavascriptInterface
    fun pararGravacao() {
        atividade.runOnUiThread {
            ServicoAudio.gravando = false
            desligarSeOcioso()
        }
    }

    /** Há fone ligado (com fio, USB ou Bluetooth)? Com ele o hino pode tocar durante a gravação sem entrar no microfone. */
    @JavascriptInterface
    fun temFone(): Boolean {
        return try {
            val audio = atividade.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS).any { d ->
                when (d.type) {
                    AudioDeviceInfo.TYPE_WIRED_HEADPHONES, AudioDeviceInfo.TYPE_WIRED_HEADSET, AudioDeviceInfo.TYPE_USB_HEADSET,
                    AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> true
                    else -> Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && d.type == AudioDeviceInfo.TYPE_BLE_HEADSET
                }
            }
        } catch (e: Exception) {
            android.util.Log.w("bm", "não deu para saber se há fone", e)
            false
        }
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
        return try {
            val audio = atividade.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val tipos = audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS).map { it.type }
            when {
                tipos.any { it == AudioDeviceInfo.TYPE_USB_HEADSET || it == AudioDeviceInfo.TYPE_USB_DEVICE } -> "usb"
                tipos.any { it == AudioDeviceInfo.TYPE_WIRED_HEADPHONES || it == AudioDeviceInfo.TYPE_WIRED_HEADSET } -> "fio"
                tipos.any {
                    it == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP || it == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
                        (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && it == AudioDeviceInfo.TYPE_BLE_HEADSET)
                } -> "bluetooth"
                else -> "alto-falante"
            }
        } catch (e: Exception) {
            android.util.Log.w("bm", "não deu para saber a rota de saída", e)
            "alto-falante"
        }
    }

    private fun ligar(titulo: String) {
        if (titulo.isNotBlank()) ServicoAudio.tituloAtual = titulo.take(120)
        val intent = Intent(atividade, ServicoAudio::class.java)
        if (ServicoAudio.ativo) {
            // Já está no ar: só refaz o tipo, o título e o texto da notificação (`startService` vale também com o app em segundo plano).
            ServicoAudio.paradaPendente = false
            try {
                atividade.startService(intent)
            } catch (e: Exception) {
                android.util.Log.w("bm", "não deu para atualizar o serviço", e)
            }
            return
        }
        pedirPermissaoDeNotificacao()
        ServicoAudio.paradaPendente = false
        ServicoAudio.aguardandoPrimeiroPlano = true
        try {
            atividade.startForegroundService(intent)
        } catch (e: Exception) {
            ServicoAudio.aguardandoPrimeiroPlano = false
            // O Android pode recusar (app fora da tela, restrição do fabricante): o hino segue tocando como antes, só sem a proteção.
            android.util.Log.w("bm", "serviço de reprodução não iniciou", e)
            val eraGravacao = ServicoAudio.gravando
            val eraMetronomo = ServicoAudio.metronomo
            ServicoAudio.tocando = false
            ServicoAudio.gravando = false
            ServicoAudio.metronomo = false
            if (eraGravacao) ServicoAudio.aoFalhar?.invoke()
            if (eraMetronomo) ServicoAudio.aoFalharMetronomo?.invoke()
        }
    }

    private fun desligarSeOcioso() {
        if (ServicoAudio.tocando || ServicoAudio.gravando || ServicoAudio.metronomo) {
            // Só uma das duas atividades terminou: o serviço fica, com o tipo, o título e o texto do que sobrou.
            if (ServicoAudio.ativo) ligar("")
            return
        }
        ServicoAudio.tituloAtual = ""
        if (ServicoAudio.aguardandoPrimeiroPlano) {
            // O serviço ainda está subindo: parar agora o destruiria sem ele ter chamado `startForeground` (o Android derrubaria o app).
            // Ele se encerra sozinho assim que chamar.
            ServicoAudio.paradaPendente = true
        } else {
            atividade.stopService(Intent(atividade, ServicoAudio::class.java))
        }
    }

    /** Android 13 em diante: sem a permissão o serviço roda, mas a notificação (e o botão "Parar") não aparece. Pede uma vez por abertura do app. */
    private fun pedirPermissaoDeNotificacao() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || pediuNotificacao) return
        if (atividade.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return
        pediuNotificacao = true
        atividade.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS)) { }
    }
}
