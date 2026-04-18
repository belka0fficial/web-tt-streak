package com.streaksaver.app

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

class MainActivity : Activity() {

    private val APP_URL = "https://web-tt-streak.up.railway.app"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val web = WebView(this)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.databaseEnabled = true
        web.settings.setSupportZoom(false)
        web.settings.userAgentString =
            "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"

        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                // Keep all navigation inside the app
                return false
            }
        }

        setContentView(web)
        web.loadUrl(APP_URL)
    }

    override fun onBackPressed() {
        val web = (contentView as? WebView) ?: return super.onBackPressed()
        if (web.canGoBack()) web.goBack() else super.onBackPressed()
    }
}
