package br.pro.bibliotecamusical.ccb

import android.os.Bundle
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  private var ponte: PonteServico? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  // A ponte do serviço de reprodução (I-22): `window.BmccbServico`, usada pelo JavaScript para ligar e desligar o serviço em primeiro plano.
  override fun onWebViewCreate(webView: WebView) {
    val nova = PonteServico(this, webView)
    ponte = nova
    webView.addJavascriptInterface(nova, "BmccbServico")
    // A ponte de compartilhar uma gravação (Gravador): `window.BmccbCompartilhar`, abre a folha de compartilhamento do sistema.
    webView.addJavascriptInterface(PonteCompartilhar(this), "BmccbCompartilhar")
  }

  override fun onDestroy() {
    ponte?.soltar()
    ponte = null
    // Fechar o app de vez (não uma recriação por rotação) leva a WebView, e com ela o som: o serviço e a notificação não ficam sobrando.
    if (isFinishing) stopService(android.content.Intent(this, ServicoAudio::class.java))
    super.onDestroy()
  }
}
