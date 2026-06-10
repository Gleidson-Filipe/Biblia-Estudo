package com.gleidson123.BibliaEstudo

import android.annotation.SuppressLint
import android.content.Context
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule

@SuppressLint("SetJavaScriptEnabled")
class BibleReaderView(context: Context) : WebView(context) {

    private var onVersePress: ((Int) -> Unit)? = null
    private var onVerseNumPress: ((Int) -> Unit)? = null
    private var onVerseComparePress: ((Int) -> Unit)? = null
    private var onInterlinearWordPress: ((String, String, String) -> Unit)? = null
    private var onInterlinearDismiss: ((Int) -> Unit)? = null
    private var isDark: Boolean = false

    init {
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.allowFileAccess = true
        scrollBarStyle = SCROLLBARS_INSIDE_OVERLAY
        isScrollbarFadingEnabled = true
        addJavascriptInterface(BibleJSInterface(), "BibleNative")
        webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                // Page loaded — pending scrollToVerse will be handled by loadChapter
            }
        }
    }

    fun loadChapter(html: String, scrollToVerse: Int) {
        val fullHtml = buildHtml(html)
        webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                if (scrollToVerse > 1) {
                    post {
                        evaluateJavascript(
                            "var el = document.getElementById('v$scrollToVerse'); if(el) el.scrollIntoView();",
                            null
                        )
                    }
                }
            }
        }
        loadDataWithBaseURL("file:///android_asset/", fullHtml, "text/html", "UTF-8", null)
    }

    fun scrollToVerse(verseNum: Int) {
        post {
            evaluateJavascript(
                "var el = document.getElementById('v$verseNum'); if(el) el.scrollIntoView();",
                null
            )
        }
    }

    fun clearSelection() {
        post {
            evaluateJavascript(
                "if(selected){selected.classList.remove('selected');selected=null;}",
                null
            )
        }
    }

    fun selectVerse(verseNum: Int) {
        post {
            evaluateJavascript(
                "if(selected)selected.classList.remove('selected');var el=document.getElementById('v$verseNum');if(el){el.classList.add('selected');selected=el;}",
                null
            )
        }
    }

    fun updateVerseHighlight(verseNum: Int, color: String) {
        val js = if (color.isNotEmpty()) {
            "var el=document.getElementById('v$verseNum');if(el){el.style.backgroundColor='${color}33';el.style.borderRadius='4px';el.style.padding='0 4px';}"
        } else {
            "var el=document.getElementById('v$verseNum');if(el){el.style.backgroundColor='';el.style.borderRadius='';el.style.padding='';}"
        }
        post { evaluateJavascript(js, null) }
    }

    fun setOnVersePress(listener: (Int) -> Unit) {
        onVersePress = listener
    }

    fun setOnVerseNumPress(listener: (Int) -> Unit) {
        onVerseNumPress = listener
    }

    fun setOnVerseComparePress(listener: (Int) -> Unit) {
        onVerseComparePress = listener
    }

    fun setOnInterlinearWordPress(listener: (String, String, String) -> Unit) {
        onInterlinearWordPress = listener
    }

    fun setOnInterlinearDismiss(listener: (Int) -> Unit) {
        onInterlinearDismiss = listener
    }

    fun showInterlinear(verseNum: Int, wordsJson: String) {
        val js = """
            (function() {
                var el = document.getElementById('v$verseNum');
                if (!el) return;
                var old = el.querySelector('.interlinear-block');
                if (old) old.remove();
                var textEl = el.querySelector('.verse-text');
                if (textEl) textEl.style.display = 'none';
                window.__interlinearVerse = $verseNum;
                var words = $wordsJson;
                var block = document.createElement('div');
                block.className = 'interlinear-block';
                block.onclick = function(e) { e.stopPropagation(); };
                words.forEach(function(w, idx) {
                    (function(word, idx) {
                        var div = document.createElement('div');
                        div.className = 'interlinear-word';
                        div.setAttribute('data-strongs', word.strongs || '');
                        div.setAttribute('data-gloss', word.gloss || '');
                        div.setAttribute('data-translit', word.translit || '');
                        div.addEventListener('click', function(e) {
                            e.stopPropagation();
                            e.preventDefault();
                            BibleNative.onInterlinearWordPress(String(idx), word.gloss || '', word.translit || '');
                        }, true);
                        var g = document.createElement('span');
                        g.className = 'interlinear-gloss';
                        g.textContent = word.gloss || '-';
                        g.style.pointerEvents = 'none';
                        var t = document.createElement('span');
                        t.className = 'interlinear-translit';
                        t.textContent = word.translit || '';
                        t.style.pointerEvents = 'none';
                        div.appendChild(g);
                        div.appendChild(t);
                        block.appendChild(div);
                    })(w, idx);
                });
                el.appendChild(block);
                el.scrollIntoView({block: 'nearest', inline: 'nearest'});
            })();
        """.trimIndent()
        post { evaluateJavascript(js, null) }
    }

    fun clearInterlinear(verseNum: Int) {
        val js = """
            (function() {
                var el = document.getElementById('v$verseNum');
                if (!el) return;
                var old = el.querySelector('.interlinear-block');
                if (old) old.remove();
                var textEl = el.querySelector('.verse-text');
                if (textEl) textEl.style.display = '';
                window.__interlinearVerse = null;
            })();
        """.trimIndent()
        post { evaluateJavascript(js, null) }
    }

    fun applyTheme(isDark: Boolean) {
        this.isDark = isDark
        val bg      = if (isDark) "#0F0E0D" else "#FAF7F2"
        val text    = if (isDark) "#F2EFEA" else "#1A1613"
        val accent  = if (isDark) "#3B82F6" else "#1E40AF"
        val border  = if (isDark) "#242120" else "#F2EDE4"
        val subtle  = if (isDark) "rgba(59,130,246,0.15)" else "rgba(30,64,175,0.08)"
        val js = """
            var r = document.documentElement.style;
            r.setProperty('--bg','$bg');
            r.setProperty('--text','$text');
            r.setProperty('--accent','$accent');
            r.setProperty('--border','$border');
            r.setProperty('--accent-subtle','$subtle');
            document.body.style.backgroundColor='$bg';
            document.body.style.color='$text';
        """.trimIndent()
        post { evaluateJavascript(js, null) }
    }

    private fun buildHtml(bodyContent: String): String {
        val bg       = if (isDark) "#0F0E0D" else "#FAF7F2"
        val text     = if (isDark) "#F2EFEA" else "#1A1613"
        val accent   = if (isDark) "#3B82F6" else "#1E40AF"
        val border   = if (isDark) "#242120" else "#F2EDE4"
        val subtle   = if (isDark) "rgba(59,130,246,0.15)" else "rgba(30,64,175,0.08)"
        val textSec  = if (isDark) "rgba(242,239,234,0.60)" else "rgba(26,22,19,0.50)"
        return """
            <!DOCTYPE html>
            <html style="--bg:$bg;--text:$text;--accent:$accent;--border:$border;--accent-subtle:$subtle;--text-secondary:$textSec;">
            <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
            <link rel="stylesheet" href="file:///android_asset/bible_reader.css">
            </head>
            <body>
            $bodyContent
            <div style="height:160px;"></div>
            <script>
              var selected = null;
              function onVerseClick(num) {
                if (window.__interlinearVerse != null) {
                  if (window.__interlinearVerse !== num) {
                    BibleNative.onInterlinearDismiss(num);
                  }
                  return;
                }
                var el = document.getElementById('v' + num);
                if (selected && selected === el) {
                  selected.classList.remove('selected');
                  selected = null;
                  BibleNative.onVersePress(-1);
                } else {
                  if (selected) selected.classList.remove('selected');
                  if (el) { el.classList.add('selected'); selected = el; }
                  BibleNative.onVersePress(num);
                }
              }
              function onVerseNumClick(num) {
                BibleNative.onVerseNumPress(num);
              }
              function onVerseCompareClick(num) {
                BibleNative.onVerseComparePress(num);
              }
            </script>
            </body>
            </html>
        """.trimIndent()
    }

    inner class BibleJSInterface {
        @JavascriptInterface
        fun onVersePress(verseNum: Int) {
            post { onVersePress?.invoke(verseNum) }
        }

        @JavascriptInterface
        fun onVerseNumPress(verseNum: Int) {
            post { onVerseNumPress?.invoke(verseNum) }
        }

        @JavascriptInterface
        fun onVerseComparePress(verseNum: Int) {
            post { onVerseComparePress?.invoke(verseNum) }
        }

        @JavascriptInterface
        fun onInterlinearWordPress(strongs: String, gloss: String, translit: String) {
            post { onInterlinearWordPress?.invoke(strongs, gloss, translit) }
        }

        @JavascriptInterface
        fun onInterlinearDismiss(verseNum: Int) {
            post { onInterlinearDismiss?.invoke(verseNum) }
        }
    }
}
