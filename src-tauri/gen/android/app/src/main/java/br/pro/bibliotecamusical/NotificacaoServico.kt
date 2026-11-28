package br.pro.bibliotecamusical

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.media.session.MediaSession
import android.os.Build

/** A notificação do serviço em primeiro plano (`ServicoAudio`): o canal, o título e o texto conforme o que está ligado, e o botão "Parar". */
internal class NotificacaoServico(private val contexto: Context) {
    /** O título muda com o que o serviço segura: o hino que toca, o metrônomo sozinho ou o nome do app (gravação). */
    fun titulo(): String {
        return if ((ServicoAudio.tocando || ServicoAudio.hinoPausado) && ServicoAudio.tituloAtual.isNotBlank()) {
            ServicoAudio.tituloAtual
        } else if ((ServicoAudio.metronomo || ServicoAudio.metronomoPausado) && !ServicoAudio.gravando) {
            contexto.getString(R.string.notificacao_metronomo_titulo)
        } else {
            contexto.getString(R.string.app_name)
        }
    }

    fun criarCanal() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val gerente = contexto.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (gerente.getNotificationChannel(ServicoAudio.CANAL) != null) return
        // IMPORTANCE_LOW: aparece na barra sem som nem vibração (o som é o do hino).
        val canal = NotificationChannel(ServicoAudio.CANAL, contexto.getString(R.string.canal_reproducao), NotificationManager.IMPORTANCE_LOW)
        canal.setShowBadge(false)
        gerente.createNotificationChannel(canal)
    }

    /** A notificação de mídia (I-47): `MediaStyle` ligado à sessão, com "Tocar ou Pausar" (hino e metrônomo) e "Parar". A gravação só tem "Parar". */
    fun montar(titulo: String, token: MediaSession.Token): Notification {
        val construtor = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(contexto, ServicoAudio.CANAL) else @Suppress("DEPRECATION") Notification.Builder(contexto)
        val botoes = botoesDaNotificacao(ServicoAudio.gravando, ServicoAudio.tocando, ServicoAudio.metronomo, ServicoAudio.pausadoAlgum())
        botoes.forEach { construtor.addAction(acao(it)) }
        return construtor
            .setSmallIcon(R.drawable.ic_notificacao)
            .setContentTitle(titulo)
            .setContentText(contexto.getString(texto()))
            .setContentIntent(intencaoDeAbrir())
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_TRANSPORT)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setStyle(Notification.MediaStyle().setMediaSession(token).setShowActionsInCompactView(*IntArray(botoes.size) { it }))
            .build()
    }

    private fun acao(botao: BotaoMidia): Notification.Action = when (botao) {
        BotaoMidia.PARAR -> criarAcao(R.drawable.ic_midia_parar, R.string.notificacao_parar, intencaoDoServico(1, ServicoAudio.ACAO_PARAR))
        BotaoMidia.ALTERNAR ->
            if (somSaindo(ServicoAudio.tocando, ServicoAudio.metronomo)) criarAcao(R.drawable.ic_midia_pause, R.string.notificacao_pausar, intencaoDoServico(2, ServicoAudio.ACAO_ALTERNAR))
            else criarAcao(R.drawable.ic_midia_play, R.string.notificacao_tocar, intencaoDoServico(2, ServicoAudio.ACAO_ALTERNAR))
    }

    private fun criarAcao(icone: Int, rotulo: Int, intencao: PendingIntent): Notification.Action =
        Notification.Action.Builder(Icon.createWithResource(contexto, icone), contexto.getString(rotulo), intencao).build()

    private fun texto(): Int =
        when (situacaoDoServico(ServicoAudio.gravando, ServicoAudio.tocando, ServicoAudio.metronomo, ServicoAudio.pausadoAlgum())) {
            Situacao.GRAVANDO -> R.string.notificacao_gravando
            Situacao.METRONOMO -> R.string.notificacao_metronomo
            Situacao.PAUSADO -> R.string.notificacao_pausado
            Situacao.TOCANDO -> R.string.notificacao_tocando
        }

    private fun intencaoDeAbrir(): PendingIntent = PendingIntent.getActivity(
        contexto,
        0,
        Intent(contexto, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    private fun intencaoDoServico(codigo: Int, acao: String): PendingIntent = PendingIntent.getService(
        contexto,
        codigo,
        Intent(contexto, ServicoAudio::class.java).setAction(acao),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
}
