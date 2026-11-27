package br.pro.bibliotecamusical

import android.content.Context
import android.os.PowerManager

/** O wake lock parcial do `ServicoAudio`, que segura a CPU com a tela bloqueada. */
internal class TravaDeCpu(private val contexto: Context) {
    private var wakeLock: PowerManager.WakeLock? = null

    /**
     * Refeito a cada `onStartCommand`, para o estado atual valer: um hino tem o limite de uma hora (contado de novo a cada mudança); uma
     * gravação NÃO tem limite (ela segue até a pessoa parar, e o wake lock é solto ao parar o serviço). Sem isso, a CPU dormiria com a tela
     * bloqueada passada uma hora de gravação.
     */
    fun segurar() {
        soltar()
        val pm = contexto.getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "bm:reproducao").apply {
            setReferenceCounted(false)
            if (ServicoAudio.gravando || ServicoAudio.metronomo) acquire() else acquire(LIMITE_WAKE_LOCK_MS)
        }
    }

    fun soltar() {
        wakeLock?.takeIf { it.isHeld }?.release()
        wakeLock = null
    }

    private companion object {
        /** O hino mais longo cabe folgado em uma hora; o limite evita um wake lock esquecido se o JavaScript nunca avisar que parou. */
        const val LIMITE_WAKE_LOCK_MS = 60L * 60L * 1000L
    }
}
