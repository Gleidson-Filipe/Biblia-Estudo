package com.gleidson123.BibliaEstudo

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
import android.text.NoCopySpan
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.method.TransformationMethod
import android.text.style.ReplacementSpan
import android.view.View

private const val SENTINEL = 'ㅤ'

/**
 * Encadeia um TransformationMethod base (ex: SingleLineTransformationMethod do RN)
 * com a ocultação do U+3164. Aplica o base primeiro, depois varre o resultado
 * procurando U+3164 e substitui por ZeroWidthSpan.
 */
class ComposedTransformation(
    private val base: TransformationMethod?
) : TransformationMethod {

    override fun getTransformation(source: CharSequence?, view: View?): CharSequence {
        // 1. Aplica o método base (SingleLine substitui \n por espaço, etc.)
        val intermediate: CharSequence = if (base != null && source != null)
            base.getTransformation(source, view) ?: source
        else
            source ?: ""

        // 2. Se não há sentinel no original, retorna o resultado do base sem cópia
        if (source?.indexOf(SENTINEL) == null || source.indexOf(SENTINEL) < 0)
            return intermediate

        // 3. Envolve em SpannableStringBuilder e aplica ZeroWidthSpan em cada U+3164
        val builder = SpannableStringBuilder(intermediate)
        var i = 0
        while (i < builder.length) {
            if (builder[i] == SENTINEL) {
                builder.setSpan(ZeroWidthSpan(), i, i + 1, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }
            i++
        }
        return builder
    }

    override fun onFocusChanged(
        view: View?,
        sourceText: CharSequence?,
        focused: Boolean,
        direction: Int,
        previouslyFocusedRect: Rect?
    ) {
        base?.onFocusChanged(view, sourceText, focused, direction, previouslyFocusedRect)
    }

    /** Span que ocupa zero pixels de largura e não desenha nenhum glifo. */
    private class ZeroWidthSpan : ReplacementSpan(), NoCopySpan {
        override fun getSize(
            paint: Paint, text: CharSequence?,
            start: Int, end: Int, fm: Paint.FontMetricsInt?
        ): Int = 0

        override fun draw(
            canvas: Canvas, text: CharSequence?,
            start: Int, end: Int, x: Float, top: Int, y: Int, bottom: Int, paint: Paint
        ) { /* nada desenhado */ }
    }
}
