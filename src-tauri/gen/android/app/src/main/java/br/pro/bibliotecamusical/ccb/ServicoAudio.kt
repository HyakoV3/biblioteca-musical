package br.pro.bibliotecamusical.ccb

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager

/**
 * Serviço em primeiro plano (tipo mídia) que mantém o app vivo enquanto um hino toca, para o som não parar com a tela bloqueada ou o app em
 * segundo plano (I-22). Quem o liga e desliga é o JavaScript, pela ponte `BmccbServico` (ver `PonteServico.kt`): liga ao começar a tocar
 * (o toque em "tocar" deixa o app visível, que é o que o Android 12 em diante exige para iniciar um serviço em primeiro plano) e desliga ao
 * pausar, parar ou terminar. O som em si continua sendo gerado na WebView; o serviço só segura o processo e a CPU (WAKE_LOCK parcial).
 * A notificação mostra o título do hino e o botão "Parar", que avisa o JavaScript (`aoParar`).
 */
class ServicoAudio : Service() {
    companion object {
        const val CANAL = "reproducao"
        const val ID_NOTIFICACAO = 1
        const val ACAO_PARAR = "br.pro.bibliotecamusical.ccb.PARAR"

        /** O hino mais longo cabe folgado em uma hora; o limite evita um wake lock esquecido se o JavaScript nunca avisar que parou. */
        private const val LIMITE_WAKE_LOCK_MS = 60L * 60L * 1000L

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
        var tocando = false
        var gravando = false

        /** Título do hino que toca (a notificação o mostra enquanto `tocando`); o da gravação é o nome do app. */
        var tituloAtual = ""

        /** O serviço existe (criado e ainda não destruído): aí um pedido de atualização usa `startService`, que também vale com o app em segundo plano. */
        var ativo = false

        /** O Android recusou subir o serviço de gravação: avisa o JavaScript, que deixa de contar com a proteção (definido pela ponte). */
        @Volatile
        var aoFalhar: (() -> Unit)? = null

        /** Avisa o JavaScript que a pessoa tocou em "Parar" na notificação durante uma gravação (definido pela ponte; nulo com o app fechado). */
        @Volatile
        var aoPararGravacao: (() -> Unit)? = null
    }

    private var wakeLock: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACAO_PARAR) {
            aoParar?.invoke()
            aoPararGravacao?.invoke()
            tocando = false
            gravando = false
            tituloAtual = ""
            encerrar()
            return START_NOT_STICKY
        }
        ativo = true
        val titulo = if (tocando && tituloAtual.isNotBlank()) tituloAtual else getString(R.string.app_name)
        try {
            criarCanal()
            val notificacao = montarNotificacao(titulo)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                var tipo = if (tocando || !gravando) ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK else 0
                if (gravando) tipo = tipo or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                startForeground(ID_NOTIFICACAO, notificacao, tipo)
            } else {
                startForeground(ID_NOTIFICACAO, notificacao)
            }
        } catch (e: Exception) {
            // O Android recusou (ForegroundServiceStartNotAllowedException no 12+, SecurityException sem a permissão do tipo de mídia, restrição
            // do fabricante): o hino segue tocando como antes, só sem a proteção, e o app não cai.
            android.util.Log.w("bmccb", "startForeground recusado; o hino segue sem o serviço", e)
            aguardandoPrimeiroPlano = false
            paradaPendente = false
            val eraGravacao = gravando
            tocando = false
            gravando = false
            if (eraGravacao) aoFalhar?.invoke()
            stopSelf()
            return START_NOT_STICKY
        }
        aguardandoPrimeiroPlano = false
        if (paradaPendente) {
            // A pessoa já tinha pausado ou parado enquanto o serviço subia: agora que ele chamou `startForeground`, pode sair sem derrubar o app.
            paradaPendente = false
            encerrar()
            return START_NOT_STICKY
        }
        segurarCpu()
        // Se o sistema matar o processo, o hino já se perdeu: não faz sentido ressuscitar o serviço sem som.
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        ativo = false
        tocando = false
        gravando = false
        soltarCpu()
        super.onDestroy()
    }

    private fun encerrar() {
        soltarCpu()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    /**
     * Refeito a cada `onStartCommand`, para o estado atual valer: um hino tem o limite de uma hora (contado de novo a cada mudança); uma
     * gravação NÃO tem limite (ela segue até a pessoa parar, e o wake lock é solto ao parar o serviço). Sem isso, a CPU dormiria com a tela
     * bloqueada passada uma hora de gravação.
     */
    private fun segurarCpu() {
        soltarCpu()
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "bmccb:reproducao").apply {
            setReferenceCounted(false)
            if (gravando) acquire() else acquire(LIMITE_WAKE_LOCK_MS)
        }
    }

    private fun soltarCpu() {
        wakeLock?.takeIf { it.isHeld }?.release()
        wakeLock = null
    }

    private fun criarCanal() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val gerente = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (gerente.getNotificationChannel(CANAL) != null) return
        // IMPORTANCE_LOW: aparece na barra sem som nem vibração (o som é o do hino).
        val canal = NotificationChannel(CANAL, getString(R.string.canal_reproducao), NotificationManager.IMPORTANCE_LOW)
        canal.setShowBadge(false)
        gerente.createNotificationChannel(canal)
    }

    private fun montarNotificacao(titulo: String): Notification {
        val abrir = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val parar = PendingIntent.getService(
            this,
            1,
            Intent(this, ServicoAudio::class.java).setAction(ACAO_PARAR),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val construtor = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CANAL) else @Suppress("DEPRECATION") Notification.Builder(this)
        return construtor
            .setSmallIcon(R.drawable.ic_notificacao)
            .setContentTitle(titulo)
            .setContentText(getString(if (gravando) R.string.notificacao_gravando else R.string.notificacao_tocando))
            .setContentIntent(abrir)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_TRANSPORT)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .addAction(Notification.Action.Builder(null, getString(R.string.notificacao_parar), parar).build())
            .build()
    }
}
