package com.gleidson123.BibliaEstudo

import android.content.Context
import android.text.Editable
import android.text.Spanned
import android.text.TextWatcher
import com.facebook.react.views.textinput.ReactEditText

private const val SENTINEL_CHAR = 'ㅤ'

class SentinelEditText(context: Context) : ReactEditText(context) {

    private val watcher = object : TextWatcher {
        override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
        override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        override fun afterTextChanged(s: Editable?) { applySpans(s ?: return) }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        addTextChangedListener(watcher)
        applySpans(editableText)
    }

    override fun onDetachedFromWindow() {
        removeTextChangedListener(watcher)
        super.onDetachedFromWindow()
    }

    internal fun applySpans(s: Editable) {
        s.getSpans(0, s.length, ZeroWidthSpan::class.java).forEach { s.removeSpan(it) }
        for (i in s.indices) {
            if (s[i] == SENTINEL_CHAR) {
                s.setSpan(ZeroWidthSpan(), i, i + 1, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }
        }
    }
}
