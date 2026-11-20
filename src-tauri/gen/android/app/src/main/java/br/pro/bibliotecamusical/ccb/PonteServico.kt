package br.pro.bibliotecamusical.ccb

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.webkit.JavascriptInterface
import android.webkit.WebView
import java.lang.ref.WeakReference

/**
 * Ponte entre o JavaScript do app e o serviço de reprodução (I-22), exposta à WebView como `window.BmccbServico`. O app só carrega conteúdo
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
                wv.post { wv.evaluateJavascript("window.__bmccbGravacaoParadaPelaNotificacao && window.__bmccbGravacaoParadaPelaNotificacao()", null) }
            }
        }
        ServicoAudio.aoFalhar = {
            fraca.get()?.let { wv ->
                wv.post { wv.evaluateJavascript("window.__bmccbServicoDeGravacaoFalhou && window.__bmccbServicoDeGravacaoFalhou()", null) }
            }
        }
        ServicoAudio.aoParar = {
            fraca.get()?.let { wv ->
                wv.post { wv.evaluateJavascript("window.__bmccbParadoPelaNotificacao && window.__bmccbParadoPelaNotificacao()", null) }
            }
        }
    }

    /** Solta o aviso do botão "Parar" quando a Activity é destruída (ela e a WebView não podem ficar presas a um campo estático). */
    fun soltar() {
        ServicoAudio.aoParar = null
        ServicoAudio.aoPararGravacao = null
        ServicoAudio.aoFalhar = null
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
            android.util.Log.w("bmccb", "não deu para saber se há fone", e)
            false
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
                android.util.Log.w("bmccb", "não deu para atualizar o serviço", e)
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
            android.util.Log.w("bmccb", "serviço de reprodução não iniciou", e)
            val eraGravacao = ServicoAudio.gravando
            ServicoAudio.tocando = false
            ServicoAudio.gravando = false
            if (eraGravacao) ServicoAudio.aoFalhar?.invoke()
        }
    }

    private fun desligarSeOcioso() {
        if (ServicoAudio.tocando || ServicoAudio.gravando) {
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
