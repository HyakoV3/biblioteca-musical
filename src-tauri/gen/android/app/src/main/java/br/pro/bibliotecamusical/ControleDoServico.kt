package br.pro.bibliotecamusical

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build

/**
 * Liga, atualiza e desliga o `ServicoAudio` a partir da `PonteServico`. Tudo aqui roda na thread principal (a ponte passa para ela antes de chamar).
 */
internal class ControleDoServico(private val atividade: MainActivity) {
    private var pediuNotificacao = false

    fun ligar(titulo: String) {
        if (titulo.isNotBlank()) ServicoAudio.tituloAtual = titulo.take(120)
        val intent = Intent(atividade, ServicoAudio::class.java)
        if (ServicoAudio.ativo) {
            atualizar(intent)
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
            avisarRecusa()
        }
    }

    fun desligarSeOcioso() {
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

    /** Já está no ar: só refaz o tipo, o título e o texto da notificação (`startService` vale também com o app em segundo plano). */
    private fun atualizar(intent: Intent) {
        ServicoAudio.paradaPendente = false
        try {
            atividade.startService(intent)
        } catch (e: Exception) {
            android.util.Log.w("bm", "não deu para atualizar o serviço", e)
        }
    }

    /** O serviço não subiu: zera o que ele deveria segurar e avisa o JavaScript do que era gravação ou metrônomo. */
    private fun avisarRecusa() {
        val eraGravacao = ServicoAudio.gravando
        val eraMetronomo = ServicoAudio.metronomo
        ServicoAudio.tocando = false
        ServicoAudio.gravando = false
        ServicoAudio.metronomo = false
        if (eraGravacao) ServicoAudio.aoFalhar?.invoke()
        if (eraMetronomo) ServicoAudio.aoFalharMetronomo?.invoke()
    }

    /** Android 13 em diante: sem a permissão o serviço roda, mas a notificação (e o botão "Parar") não aparece. Pede uma vez por abertura do app. */
    private fun pedirPermissaoDeNotificacao() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || pediuNotificacao) return
        if (atividade.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return
        pediuNotificacao = true
        atividade.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS)) { }
    }
}
