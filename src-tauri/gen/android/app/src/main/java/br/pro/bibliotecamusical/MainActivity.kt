package br.pro.bibliotecamusical

import android.os.Build
import android.os.Bundle
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  private var ponte: PonteServico? = null
  private var compartilhar: PonteCompartilhar? = null
  private var webView: WebView? = null

  /** A atividade está em segundo plano (entre `onPause` e `onResume`): só então a WebView pode ser pausada de novo quando o áudio acaba. */
  @Volatile
  private var emSegundoPlano = false

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  // A ponte do serviço de reprodução (I-22): `window.BmServico`, usada pelo JavaScript para ligar e desligar o serviço em primeiro plano.
  override fun onWebViewCreate(webView: WebView) {
    this.webView = webView
    // O processo da WebView (o "renderizador") perde prioridade quando a tela não está à vista, e o som sintetizado, que é calculado na hora, falha ou estala. Com `waivedWhenNotVisible = false` ele
    // mantém a prioridade de "importante" mesmo escondido. (Só existe a partir do Android 8; antes, nada a fazer.)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false)
    }
    // Quando o serviço de áudio acaba com o app ainda em segundo plano, garante que a WebView esteja pausada (senão o JavaScript e a renderização gastariam bateria à toa).
    ServicoAudio.aoOcioso = { runOnUiThread { pausarSeOcioso() } }
    val nova = PonteServico(this, webView)
    ponte = nova
    webView.addJavascriptInterface(nova, "BmServico")
    // A ponte de compartilhar uma gravação (Gravador): `window.BmCompartilhar`, abre a folha de compartilhamento do sistema.
    val outra = PonteCompartilhar(this)
    outra.limparAntigos() // cópias de gravações enviadas numa sessão anterior não ficam no cache sem prazo
    compartilhar = outra
    webView.addJavascriptInterface(outra, "BmCompartilhar")
  }

  // O WryActivity pausa a WebView em `onPause` (ao ir para segundo plano ou bloquear a tela), e é assim que fica: o app NÃO a religa de imediato. Antes ele chamava `webView.onResume()` aqui
  // com o áudio ligado, para o som não cair; esse "pausa e volta" a cada bloqueio ou desbloqueio da tela estalava o som, e sem ele o estalo diminuiu bastante (teste do responsável, APK
  // 2952dc6, 2026-11-23). Quem segura o som com a tela bloqueada é o serviço em primeiro plano (`ServicoAudio`) com a prioridade do renderizador (`onWebViewCreate`).
  override fun onPause() {
    super.onPause()
    emSegundoPlano = true
  }

  override fun onResume() {
    emSegundoPlano = false
    super.onResume()
  }

  private fun audioLigado() = ServicoAudio.tocando || ServicoAudio.gravando || ServicoAudio.metronomo

  /** O áudio acabou: se o app segue em segundo plano, garante que a WebView esteja pausada (hoje ela já foi pausada em `onPause`; isto é só uma segurança). */
  private fun pausarSeOcioso() {
    if (emSegundoPlano && !audioLigado()) webView?.onPause()
  }

  override fun onDestroy() {
    ServicoAudio.aoOcioso = null
    webView = null
    ponte?.soltar()
    ponte = null
    compartilhar?.soltar()
    compartilhar = null
    // Fechar o app de vez (não uma recriação por rotação) leva a WebView, e com ela o som: o serviço e a notificação não ficam sobrando.
    if (isFinishing) stopService(android.content.Intent(this, ServicoAudio::class.java))
    super.onDestroy()
  }
}
