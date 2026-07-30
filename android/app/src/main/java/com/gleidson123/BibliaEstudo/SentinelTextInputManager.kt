package com.gleidson123.BibliaEstudo

import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.views.textinput.ReactEditText
import com.facebook.react.views.textinput.ReactTextInputManager

/**
 * ViewManager que substitui a fábrica de ReactEditText por SentinelEditText,
 * herdando todas as props e eventos do TextInput padrão do React Native.
 *
 * Nome JS: "SentinelTextInput"
 */
class SentinelTextInputManager : ReactTextInputManager() {

    override fun getName(): String = "SentinelTextInput"

    override fun createViewInstance(context: ThemedReactContext): ReactEditText =
        SentinelEditText(context)
}
