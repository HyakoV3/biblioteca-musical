package br.pro.bibliotecamusical

import android.content.Context
import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Build

/**
 * A `MediaSession` do sistema (sem Media3) do `ServicoAudio` (I-47, etapa 1): dá à notificação o estilo de mídia (controles na tela bloqueada e
 * nas Configurações rápidas) e recebe os botões do fone. Não guarda estado próprio: o JavaScript manda, e `atualizar` só reflete.
 * `alternar(querTocar)` recebe true para o play e false para o pause; `parar` é o stop.
 */
internal class SessaoDeMidia(contexto: Context, private val alternar: (Boolean) -> Unit, private val parar: () -> Unit) {
    private val sessao = MediaSession(contexto, "bm-servico")

    init {
        marcarBotoesDoFone()
        sessao.setCallback(object : MediaSession.Callback() {
            override fun onPlay() = alternar(true)

            override fun onPause() = alternar(false)

            override fun onStop() = parar()
        })
    }

    val token: MediaSession.Token
        get() = sessao.sessionToken

    /** Do Android 8 em diante os botões do fone dispensam as flags (que ficaram obsoletas); antes, a sessão precisa declará-las. */
    @Suppress("DEPRECATION")
    private fun marcarBotoesDoFone() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) return
        sessao.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS or MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS)
    }

    /** Reflete o estado atual (título e se há som saindo); sem o botão de alternar (gravação), só o stop vale. */
    fun atualizar(titulo: String) {
        val botoes = botoesDaNotificacao(ServicoAudio.gravando, ServicoAudio.tocando, ServicoAudio.metronomo, ServicoAudio.pausadoAlgum())
        val acoes = if (BotaoMidia.ALTERNAR in botoes) ACOES_DE_MIDIA else PlaybackState.ACTION_STOP
        val tocandoAgora = ServicoAudio.gravando || somSaindo(ServicoAudio.tocando, ServicoAudio.metronomo)
        val estado = if (tocandoAgora) PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED
        sessao.setMetadata(MediaMetadata.Builder().putString(MediaMetadata.METADATA_KEY_TITLE, titulo).build())
        sessao.setPlaybackState(PlaybackState.Builder().setActions(acoes).setState(estado, PlaybackState.PLAYBACK_POSITION_UNKNOWN, 1f).build())
        sessao.isActive = true
    }

    fun liberar() {
        sessao.isActive = false
        sessao.release()
    }

    private companion object {
        const val ACOES_DE_MIDIA = PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_PLAY_PAUSE or PlaybackState.ACTION_STOP
    }
}
