package br.pro.bibliotecamusical.ccb

import android.os.Bundle
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  // A ponte do serviço de reprodução (I-22): `window.BmccbServico`, usada pelo JavaScript para ligar e desligar o serviço em primeiro plano.
  override fun onWebViewCreate(webView: WebView) {
    webView.addJavascriptInterface(PonteServico(this, webView), "BmccbServico")
  }
}
