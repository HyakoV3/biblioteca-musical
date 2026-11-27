package br.pro.bibliotecamusical

import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * Serviço em primeiro plano (tipo mídia) que mantém o app vivo enquanto um hino toca, para o som não parar com a tela bloqueada ou o app em
 * segundo plano (I-22). Quem o liga e desliga é o JavaScript, pela ponte `BmServico` (ver `PonteServico.kt`): liga ao começar a tocar
 * (o toque em "tocar" deixa o app visível, que é o que o Android 12 em diante exige para iniciar um serviço em primeiro plano) e desliga ao
 * pausar, parar ou terminar. O som em si continua sendo gerado na WebView; o serviço só segura o processo e a CPU (WAKE_LOCK parcial).
 * A notificação mostra o título do hino e o botão "Parar", que avisa o JavaScript (`aoParar`).
 */
class ServicoAudio : Service() {
    companion object {
        const val CANAL = "reproducao"
        const val ID_NOTIFICACAO = 1
        const val ACAO_PARAR = "br.pro.bibliotecamusical.PARAR"

        /** Avisa o JavaScript que a pessoa tocou em "Parar" na notificação (definido pela ponte; nulo com o app fechado). */
        @Volatile
        var aoParar: (() -> Unit)? = null

        /**
         * `startForegroundService` obriga o serviço a chamar `startForeground` em poucos segundos; se a parada chegasse antes (tocar e pausar logo em
         * seguida), o serviço seria destruído sem tê-lo chamado e o Android derrubaria o app. Então, enquanto o serviço ainda não chegou lá
         * (`aguardandoPrimeiroPlano`), a ponte não o para: só marca `paradaPendente`, e o serviço se encerra sozinho DEPOIS de chamar `startForeground`.
         * Tudo isso roda na thread principal (a ponte passa para ela e `onStartCommand` já roda nela), então não precisa de trava.
         */
        var aguardandoPrimeiroPlano = false
        var paradaPendente = false

        /**
         * O que o serviço está segurando agora: um hino tocando e/ou uma gravação do microfone (Gravador). O serviço só se encerra quando
         * nenhum dos dois precisa dele (ver `PonteServico`). Gravar com a tela bloqueada exige o tipo `microphone`: sem ele o Android corta o
         * microfone do app que sai da tela (a gravação parava em cerca de 30 s).
         */
        @Volatile
        var tocando = false

        @Volatile
        var gravando = false

        /** O metrônomo está ligado (I-20): o clique segue com a tela bloqueada até a pessoa parar. Tipo `mediaPlayback`, wake lock sem limite. */
        @Volatile
        var metronomo = false

        /**
         * Chamado quando o serviço é destruído (o hino acabou, a gravação ou o metrônomo pararam, ou a pessoa tocou em "Parar"): a `MainActivity` o usa para
         * pausar de novo a WebView que ela manteve acordada, se o app ainda estiver em segundo plano.
         */
        @Volatile
        var aoOcioso: (() -> Unit)? = null

        /** Título do hino que toca (a notificação o mostra enquanto `tocando`); o da gravação é o nome do app. */
        var tituloAtual = ""

        /** O serviço existe (criado e ainda não destruído): aí um pedido de atualização usa `startService`, que também vale com o app em segundo plano. */
        var ativo = false

        /** O Android recusou subir o serviço de gravação: avisa o JavaScript, que deixa de contar com a proteção (definido pela ponte). */
        @Volatile
        var aoFalhar: (() -> Unit)? = null

        /** Avisa o JavaScript que a pessoa tocou em "Parar" na notificação com o metrônomo ligado (definido pela ponte; nulo com o app fechado). */
        @Volatile
        var aoPararMetronomo: (() -> Unit)? = null

        /** O Android recusou subir o serviço do metrônomo: avisa o JavaScript, que para e mostra o aviso. */
        @Volatile
        var aoFalharMetronomo: (() -> Unit)? = null

        /** Avisa o JavaScript que a pessoa tocou em "Parar" na notificação durante uma gravação (definido pela ponte; nulo com o app fechado). */
        @Volatile
        var aoPararGravacao: (() -> Unit)? = null
    }

    private val trava by lazy { TravaDeCpu(this) }
    private val notificacao by lazy { NotificacaoServico(this) }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACAO_PARAR) {
            pararPelaNotificacao()
            return START_NOT_STICKY
        }
        ativo = true
        if (!entrarEmPrimeiroPlano()) return START_NOT_STICKY
        aguardandoPrimeiroPlano = false
        if (paradaPendente) {
            // A pessoa já tinha pausado ou parado enquanto o serviço subia: agora que ele chamou `startForeground`, pode sair sem derrubar o app.
            paradaPendente = false
            encerrar()
            return START_NOT_STICKY
        }
        trava.segurar()
        // Se o sistema matar o processo, o hino já se perdeu: não faz sentido ressuscitar o serviço sem som.
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        ativo = false
        tocando = false
        gravando = false
        metronomo = false
        trava.soltar()
        try {
            aoOcioso?.invoke()
        } catch (e: Exception) {
            android.util.Log.w("bm", "não deu para pausar a WebView ao fim do serviço", e)
        }
        super.onDestroy()
    }

    private fun encerrar() {
        trava.soltar()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    /** O toque em "Parar" na notificação: avisa o JavaScript, zera o que o serviço segurava e se encerra. */
    private fun pararPelaNotificacao() {
        aoParar?.invoke()
        aoPararGravacao?.invoke()
        aoPararMetronomo?.invoke()
        tocando = false
        gravando = false
        metronomo = false
        tituloAtual = ""
        encerrar()
    }

    /** Chama `startForeground` com a notificação do estado atual. Devolve false se o Android recusou (o serviço já se encerrou). */
    private fun entrarEmPrimeiroPlano(): Boolean {
        val titulo = notificacao.titulo()
        try {
            notificacao.criarCanal()
            val pronta = notificacao.montar(titulo)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) startForeground(ID_NOTIFICACAO, pronta, tipoDoServico()) else startForeground(ID_NOTIFICACAO, pronta)
            return true
        } catch (e: Exception) {
            // O Android recusou (ForegroundServiceStartNotAllowedException no 12+, SecurityException sem a permissão do tipo de mídia, restrição
            // do fabricante): o hino segue tocando como antes, só sem a proteção, e o app não cai.
            android.util.Log.w("bm", "startForeground recusado; o hino segue sem o serviço", e)
            aguardandoPrimeiroPlano = false
            paradaPendente = false
            val eraGravacao = gravando
            val eraMetronomo = metronomo
            tocando = false
            gravando = false
            metronomo = false
            if (eraGravacao) aoFalhar?.invoke()
            if (eraMetronomo) aoFalharMetronomo?.invoke()
            stopSelf()
            return false
        }
    }
}

/** O tipo do serviço em primeiro plano (Android 10 em diante): mídia, e microfone se há gravação. */
private fun tipoDoServico(): Int {
    var tipo = if (ServicoAudio.tocando || ServicoAudio.metronomo || !ServicoAudio.gravando) ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK else 0
    if (ServicoAudio.gravando) tipo = tipo or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
    return tipo
}
