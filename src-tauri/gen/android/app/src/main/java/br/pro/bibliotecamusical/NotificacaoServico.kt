package br.pro.bibliotecamusical

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

/** A notificação do serviço em primeiro plano (`ServicoAudio`): o canal, o título e o texto conforme o que está ligado, e o botão "Parar". */
internal class NotificacaoServico(private val contexto: Context) {
    /** O título muda com o que o serviço segura: o hino que toca, o metrônomo sozinho ou o nome do app (gravação). */
    fun titulo(): String {
        return if (ServicoAudio.tocando && ServicoAudio.tituloAtual.isNotBlank()) {
            ServicoAudio.tituloAtual
        } else if (ServicoAudio.metronomo && !ServicoAudio.gravando) {
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

    fun montar(titulo: String): Notification {
        val construtor = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(contexto, ServicoAudio.CANAL) else @Suppress("DEPRECATION") Notification.Builder(contexto)
        return construtor
            .setSmallIcon(R.drawable.ic_notificacao)
            .setContentTitle(titulo)
            .setContentText(contexto.getString(texto()))
            .setContentIntent(intencaoDeAbrir())
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_TRANSPORT)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .addAction(Notification.Action.Builder(null, contexto.getString(R.string.notificacao_parar), intencaoDeParar()).build())
            .build()
    }

    private fun texto(): Int =
        if (ServicoAudio.gravando) R.string.notificacao_gravando else if (ServicoAudio.metronomo && !ServicoAudio.tocando) R.string.notificacao_metronomo else R.string.notificacao_tocando

    private fun intencaoDeAbrir(): PendingIntent = PendingIntent.getActivity(
        contexto,
        0,
        Intent(contexto, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    private fun intencaoDeParar(): PendingIntent = PendingIntent.getService(
        contexto,
        1,
        Intent(contexto, ServicoAudio::class.java).setAction(ServicoAudio.ACAO_PARAR),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
}
