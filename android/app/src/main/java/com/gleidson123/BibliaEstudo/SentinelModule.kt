package com.gleidson123.BibliaEstudo

import android.text.Editable
import android.text.Spanned
import android.text.TextWatcher
import android.widget.EditText
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.uimanager.UIManagerHelper

private const val SENTINEL_CHAR = 'ㅤ'

class SentinelModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "SentinelModule"

    @ReactMethod
    fun install(viewTag: Int) {
        UiThreadUtil.runOnUiThread {
            try {
                val uiManager = UIManagerHelper.getUIManager(reactContext, viewTag)
                val view = uiManager?.resolveView(viewTag)
                if (view is EditText) attachWatcher(view)
            } catch (_: Exception) {}
        }
    }

    private fun attachWatcher(editText: EditText) {
        if (editText.getTag(R.id.sentinel_installed) == true) return
        editText.setTag(R.id.sentinel_installed, true)

        val watcher = object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) { applySpans(s ?: return) }
        }
        editText.addTextChangedListener(watcher)
        applySpans(editText.editableText)
    }

    private fun applySpans(s: Editable) {
        s.getSpans(0, s.length, ZeroWidthSpan::class.java).forEach { s.removeSpan(it) }
        for (i in s.indices) {
            if (s[i] == SENTINEL_CHAR) {
                s.setSpan(ZeroWidthSpan(), i, i + 1, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }
        }
    }
}
