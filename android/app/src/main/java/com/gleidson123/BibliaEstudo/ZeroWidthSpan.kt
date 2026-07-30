package com.gleidson123.BibliaEstudo

import android.graphics.Canvas
import android.graphics.Paint
import android.text.NoCopySpan
import android.text.style.ReplacementSpan

internal class ZeroWidthSpan : ReplacementSpan(), NoCopySpan {
    override fun getSize(paint: Paint, text: CharSequence?, start: Int, end: Int, fm: Paint.FontMetricsInt?) = 0
    override fun draw(canvas: Canvas, text: CharSequence?, start: Int, end: Int, x: Float, top: Int, y: Int, bottom: Int, paint: Paint) {}
}
