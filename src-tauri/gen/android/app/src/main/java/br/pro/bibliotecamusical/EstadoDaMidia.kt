package br.pro.bibliotecamusical

/** Os botões que a notificação pode ter: alternar (tocar ou pausar) e parar. */
internal enum class BotaoMidia { ALTERNAR, PARAR }

/** O que a notificação diz que o serviço está fazendo (escolhe o texto da segunda linha). */
internal enum class Situacao { GRAVANDO, TOCANDO, METRONOMO, PAUSADO }

/**
 * Funções puras (sem Android) que decidem o que a notificação de mídia mostra em cada estado. A gravação não é mídia: tem só "Parar".
 * Hino e metrônomo, tocando ou pausados, têm "Tocar ou Pausar" e "Parar". Só o CI compila isto (Kotlin não compila no ambiente local).
 */
internal fun botoesDaNotificacao(gravando: Boolean, tocando: Boolean, metronomo: Boolean, pausado: Boolean): List<BotaoMidia> =
    if (!gravando && (tocando || metronomo || pausado)) listOf(BotaoMidia.ALTERNAR, BotaoMidia.PARAR) else listOf(BotaoMidia.PARAR)

/** Há som saindo agora (hino ou metrônomo)? */
internal fun somSaindo(tocando: Boolean, metronomo: Boolean): Boolean = tocando || metronomo

internal fun situacaoDoServico(gravando: Boolean, tocando: Boolean, metronomo: Boolean, pausado: Boolean): Situacao =
    if (gravando) Situacao.GRAVANDO else if (tocando) Situacao.TOCANDO else if (metronomo) Situacao.METRONOMO else if (pausado) Situacao.PAUSADO else Situacao.TOCANDO
