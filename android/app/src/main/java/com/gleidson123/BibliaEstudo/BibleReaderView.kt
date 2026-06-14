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
    private var onReturnIconPress: ((Int) -> Unit)? = null
    private var isDark: Boolean = false

    init {
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.allowFileAccess = true
        setBackgroundColor(android.graphics.Color.TRANSPARENT)
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

    fun updateHtml(html: String) {
        val fullHtml = buildHtml(html)
        val scrollY = scrollY
        webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                post { scrollTo(0, scrollY) }
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
            "var el=document.getElementById('v$verseNum');if(el){el.style.backgroundColor='${color}33';el.style.borderRadius='4px';}"
        } else {
            "var el=document.getElementById('v$verseNum');if(el){el.style.backgroundColor='';el.style.borderRadius='';}"
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

    fun setOnReturnIconPress(listener: (Int) -> Unit) {
        onReturnIconPress = listener
    }

    fun showInterlinear(verseNum: Int, wordsJson: String) {
        val js = """
            (function() {
                var el = document.getElementById('v$verseNum');
                if (!el) return;
                var old = el.querySelector('.interlinear-block');
                if (old) old.remove();
                var words = $wordsJson;
                if (!words || words.length === 0) return;
                var textEl = el.querySelector('.verse-text');
                if (textEl) textEl.style.display = 'none';
                window.__interlinearVerse = $verseNum;
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

    fun toggleMultiSelect(verseNum: Int) {
        val js = """
            (function() {
                var el = document.getElementById('v$verseNum');
                if (!el) return;
                if (el.classList.contains('multi-selected')) {
                    el.classList.remove('multi-selected');
                } else {
                    el.classList.add('multi-selected');
                }
            })();
        """.trimIndent()
        post { evaluateJavascript(js, null) }
    }

    fun clearMultiSelect() {
        val js = "document.querySelectorAll('.verse.multi-selected').forEach(function(el){el.classList.remove('multi-selected');});"
        post { evaluateJavascript(js, null) }
    }

    fun focusVerse(verseNum: Int) {
        val js = """
            (function() {
                document.querySelectorAll('.verse.focus-target').forEach(function(el){ el.classList.remove('focus-target'); });
                document.body.classList.remove('focus-mode');
                var el = document.getElementById('v$verseNum');
                if (!el) return;
                el.classList.add('focus-target');
                document.body.classList.add('focus-mode');
                function onScroll() {
                    document.body.classList.remove('focus-mode');
                    document.querySelectorAll('.verse.focus-target').forEach(function(e){ e.classList.remove('focus-target'); });
                    document.removeEventListener('scroll', onScroll);
                }
                document.addEventListener('scroll', onScroll, { passive: true, once: true });
                document.addEventListener('click', onScroll, { once: true });
            })();
        """.trimIndent()
        post { evaluateJavascript(js, null) }
    }

    fun updateBadges(noteJson: String, corrJson: String, groupNoteJson: String = "[]", groupCorrJson: String = "[]", savedJson: String = "[]", groupNoteWithNotesJson: String = "[]", tgtJson: String = "{}") {
        val noteSvgBlue = """<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>"""
        val noteSvgYellow = """<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>"""
        val linkSvgBlue = """<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>"""
        val linkSvgYellow = """<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>"""
        val returnSvgBlue = """<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>"""
        val returnSvgYellow = """<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>"""
        val js = """
            (function() {
                var noteVerses = $noteJson;
                var corrVerses = $corrJson;
                var groupNoteVerses = $groupNoteJson;
                var groupCorrVerses = $groupCorrJson;
                var savedVerses = $savedJson;
                var groupNoteWithNotesVerses = $groupNoteWithNotesJson;
                var tgtObj = $tgtJson;
                var noteSet = {}; var corrSet = {}; var gNoteSet = {}; var gCorrSet = {}; var savedSet = {}; var gNoteWithNotesSet = {}; var tgtSet = {};
                noteVerses.forEach(function(v) { noteSet[v] = true; });
                corrVerses.forEach(function(v) { corrSet[v] = true; });
                groupNoteVerses.forEach(function(v) { gNoteSet[v] = true; });
                groupCorrVerses.forEach(function(v) { gCorrSet[v] = true; });
                savedVerses.forEach(function(v) { savedSet[v] = true; });
                groupNoteWithNotesVerses.forEach(function(v) { gNoteWithNotesSet[v] = true; });
                Object.keys(tgtObj).forEach(function(k) { tgtSet[parseInt(k, 10)] = tgtObj[k]; });
                document.querySelectorAll('.verse').forEach(function(el) {
                    var id = el.id;
                    if (!id || id[0] !== 'v') return;
                    var num = parseInt(id.slice(1), 10);
                    var hasNote = !!noteSet[num];
                    var hasCorr = !!corrSet[num];
                    var hasGroupNote = !!gNoteSet[num];
                    var hasGroupCorr = !!gCorrSet[num];
                    var isSaved = !!savedSet[num];
                    var isGroup = hasGroupNote || hasGroupCorr;
                    var hasAnnotation = hasNote || hasCorr || isGroup || isSaved;
                    var numEl = el.querySelector('.verse-num');
                    var hasIndividual = hasNote || hasCorr;
                    if (numEl) {
                        if (hasAnnotation) {
                            numEl.className = 'verse-num verse-num--marked';
                            numEl.style.borderRadius = '4px';
                            numEl.style.minWidth = '1.6em';
                            numEl.style.height = '1.6em';
                            numEl.style.padding = '0 4px';
                            numEl.style.lineHeight = '1.6em';
                            numEl.style.backgroundColor = isGroup ? '#F59E0B' : 'var(--accent)';
                            numEl.style.color = '#fff';
                            numEl.style.display = 'inline-flex';
                            numEl.style.alignItems = 'center';
                            numEl.style.justifyContent = 'center';
                            numEl.setAttribute('onclick', 'event.stopPropagation();onVerseNumClick(' + num + ')');
                        } else {
                            numEl.className = 'verse-num';
                            numEl.style.borderRadius = '';
                            numEl.style.minWidth = '';
                            numEl.style.height = '';
                            numEl.style.padding = '';
                            numEl.style.lineHeight = '';
                            numEl.style.backgroundColor = '';
                            numEl.style.color = '';
                            numEl.style.display = '';
                            numEl.style.alignItems = '';
                            numEl.style.justifyContent = '';
                            numEl.removeAttribute('onclick');
                        }
                        var numWrap = numEl.parentNode;
                        var existingDot = numWrap.querySelector('.group-dot');
                        if (!(isGroup && hasIndividual) && existingDot) {
                            existingDot.remove();
                        }
                        if (isGroup && hasIndividual && !existingDot) {
                            var dot = document.createElement('span');
                            dot.className = 'group-dot';
                            dot.style.cssText = 'width:6px;height:6px;border-radius:3px;background-color:var(--accent);display:inline-block;margin-left:3px;flex-shrink:0;vertical-align:middle;';
                            numWrap.appendChild(dot);
                        }
                    }
                    var tgtType = tgtSet[num];
                    var hasTgt = !!tgtType;
                    var iconsEl = el.querySelector('.verse-icons-badges');
                    if (iconsEl) {
                        var showNote = hasNote || !!gNoteWithNotesSet[num];
                        var showCorr = hasCorr || hasGroupCorr;
                        var noteHtml = showNote ? '<span style="display:inline-flex;align-items:center;padding:2px 3px;">${noteSvgBlue}</span>' : '';
                        var corrHtml = showCorr ? '<span style="display:inline-flex;align-items:center;padding:2px 3px;">${linkSvgBlue}</span>' : '';
                        var tgtHtml = '';
                        if (hasTgt) {
                            var retSvg = (tgtType === 'individual') ? '${returnSvgBlue}' : '${returnSvgYellow}';
                            var retDot = (tgtType === 'both') ? '<span style="width:5px;height:5px;border-radius:50%;background:var(--accent);display:inline-block;margin-left:2px;flex-shrink:0;"></span>' : '';
                            var sep = (showNote || showCorr) ? '<span class="verse-icon-sep"></span>' : '';
                            tgtHtml = sep + '<span style="display:inline-flex;align-items:center;padding:2px 2px;cursor:pointer;" onclick="event.stopPropagation();onReturnIconClick(' + num + ')">' + retSvg + retDot + '</span>';
                        }
                        var trailingSep = (showNote || showCorr || hasTgt) ? '<span class="verse-icon-sep"></span>' : '';
                        iconsEl.innerHTML = noteHtml + corrHtml + tgtHtml + trailingSep;
                    }
                    var barColor = isGroup ? '#F59E0B' : (isSaved ? 'var(--accent)' : '');
                    el.style.borderLeftColor = barColor || 'transparent';
                });
            })();
        """.trimIndent()
        post { evaluateJavascript(js, null) }
    }

    fun updateSavedNoColor(verseNums: List<Int>) {
        val js = """
            (function() {
                var nums = ${verseNums};
                nums.forEach(function(n) {
                    var el = document.getElementById('v' + n);
                    if (!el) return;
                    el.style.borderLeftColor = 'var(--accent)';
                });
            })();
        """.trimIndent()
        post { evaluateJavascript(js, null) }
    }

    fun removeSavedNoColor(verseNums: List<Int>) {
        val js = """
            (function() {
                var nums = ${verseNums};
                nums.forEach(function(n) {
                    var el = document.getElementById('v' + n);
                    if (!el) return;
                    el.style.borderLeftColor = 'transparent';
                });
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
        val textSec = if (isDark) "rgba(242,239,234,0.60)" else "rgba(26,22,19,0.50)"
        val js = """
            var r = document.documentElement.style;
            r.setProperty('--bg','$bg');
            r.setProperty('--text','$text');
            r.setProperty('--accent','$accent');
            r.setProperty('--border','$border');
            r.setProperty('--accent-subtle','$subtle');
            r.setProperty('--text-secondary','$textSec');
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
                BibleNative.onVersePress(num);
              }
              function onVerseNumClick(num) {
                BibleNative.onVerseNumPress(num);
              }
              function onVerseCompareClick(num) {
                BibleNative.onVerseComparePress(num);
              }
              function onReturnIconClick(num) {
                BibleNative.onReturnIconPress(num);
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

        @JavascriptInterface
        fun onReturnIconPress(verseNum: Int) {
            post { onReturnIconPress?.invoke(verseNum) }
        }
    }
}
