package com.gleidson123.BibliaEstudo

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.RCTEventEmitter

class BibleReaderViewManager(private val reactContext: ReactApplicationContext) :
    SimpleViewManager<BibleReaderView>() {

    override fun getName() = "BibleReaderView"

    override fun createViewInstance(context: ThemedReactContext): BibleReaderView {
        val view = BibleReaderView(context)
        view.setOnVersePress { verseNum ->
            val event = com.facebook.react.bridge.Arguments.createMap().apply {
                putInt("verse", verseNum)
            }
            context.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onVersePress", event)
        }
        view.setOnVerseNumPress { verseNum ->
            val event = com.facebook.react.bridge.Arguments.createMap().apply {
                putInt("verse", verseNum)
            }
            context.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onVerseNumPress", event)
        }
        view.setOnVerseComparePress { verseNum ->
            val event = com.facebook.react.bridge.Arguments.createMap().apply {
                putInt("verse", verseNum)
            }
            context.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onVerseComparePress", event)
        }
        view.setOnInterlinearWordPress { strongs, gloss, translit ->
            val event = com.facebook.react.bridge.Arguments.createMap().apply {
                putString("strongs", strongs)
                putString("gloss", gloss)
                putString("translit", translit)
            }
            context.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onInterlinearWordPress", event)
        }
        view.setOnInterlinearDismiss { verseNum ->
            val event = com.facebook.react.bridge.Arguments.createMap().apply {
                putInt("verse", verseNum)
            }
            context.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onInterlinearDismiss", event)
        }
        view.setOnReturnIconPress { verseNum ->
            val event = com.facebook.react.bridge.Arguments.createMap().apply {
                putInt("verse", verseNum)
            }
            context.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(view.id, "onReturnIconPress", event)
        }
        return view
    }

    @ReactProp(name = "htmlContent")
    fun setHtmlContent(view: BibleReaderView, html: String?) {
        // html is set via command loadChapter
    }

    @ReactProp(name = "isDark")
    fun setIsDark(view: BibleReaderView, isDark: Boolean) {
        view.applyTheme(isDark)
    }

    override fun getCommandsMap(): Map<String, Int> = mapOf(
        "loadChapter" to COMMAND_LOAD_CHAPTER,
        "scrollToVerse" to COMMAND_SCROLL_TO_VERSE,
        "clearSelection" to COMMAND_CLEAR_SELECTION,
        "updateVerseHighlight" to COMMAND_UPDATE_VERSE_HIGHLIGHT,
        "showInterlinear" to COMMAND_SHOW_INTERLINEAR,
        "clearInterlinear" to COMMAND_CLEAR_INTERLINEAR,
        "selectVerse" to COMMAND_SELECT_VERSE,
        "updateHtml" to COMMAND_UPDATE_HTML,
        "updateBadges" to COMMAND_UPDATE_BADGES,
        "toggleMultiSelect" to COMMAND_TOGGLE_MULTI_SELECT,
        "clearMultiSelect" to COMMAND_CLEAR_MULTI_SELECT,
        "updateSavedNoColor" to COMMAND_UPDATE_SAVED_NO_COLOR,
        "removeSavedNoColor" to COMMAND_REMOVE_SAVED_NO_COLOR,
        "focusVerse" to COMMAND_FOCUS_VERSE
    )

    override fun receiveCommand(view: BibleReaderView, commandId: String, args: ReadableArray?) {
        when (commandId) {
            "loadChapter" -> {
                val html = args?.getString(0) ?: ""
                val scrollToVerse = args?.getInt(1) ?: 1
                view.loadChapter(html, scrollToVerse)
            }
            "scrollToVerse" -> {
                val verseNum = args?.getInt(0) ?: 1
                view.scrollToVerse(verseNum)
            }
            "clearSelection" -> view.clearSelection()
            "updateVerseHighlight" -> {
                val verseNum = args?.getInt(0) ?: 1
                val color = args?.getString(1) ?: ""
                view.updateVerseHighlight(verseNum, color)
            }
            "showInterlinear" -> {
                val verseNum = args?.getInt(0) ?: 1
                val wordsJson = args?.getString(1) ?: "[]"
                view.showInterlinear(verseNum, wordsJson)
            }
            "clearInterlinear" -> {
                val verseNum = args?.getInt(0) ?: 1
                view.clearInterlinear(verseNum)
            }
            "selectVerse" -> {
                val verseNum = args?.getInt(0) ?: 1
                view.selectVerse(verseNum)
            }
            "updateHtml" -> {
                val html = args?.getString(0) ?: ""
                view.updateHtml(html)
            }
            "updateBadges" -> {
                val noteJson = args?.getString(0) ?: "[]"
                val corrJson = args?.getString(1) ?: "[]"
                val groupNoteJson = args?.getString(2) ?: "[]"
                val groupCorrJson = args?.getString(3) ?: "[]"
                val savedJson = args?.getString(4) ?: "[]"
                val groupNoteWithNotesJson = args?.getString(5) ?: "[]"
                val tgtJson = args?.getString(6) ?: "{}"
                val saveGroupJson = args?.getString(7) ?: "[]"
                view.updateBadges(noteJson, corrJson, groupNoteJson, groupCorrJson, savedJson, groupNoteWithNotesJson, tgtJson, saveGroupJson)
            }
            "toggleMultiSelect" -> {
                val verseNum = args?.getInt(0) ?: 1
                view.toggleMultiSelect(verseNum)
            }
            "clearMultiSelect" -> view.clearMultiSelect()
            "focusVerse" -> {
                val verseNum = args?.getInt(0) ?: 1
                view.focusVerse(verseNum)
            }
            "updateSavedNoColor" -> {
                val numsArray = args?.getArray(0)
                val nums = mutableListOf<Int>()
                if (numsArray != null) {
                    for (i in 0 until numsArray.size()) nums.add(numsArray.getInt(i))
                }
                view.updateSavedNoColor(nums)
            }
            "removeSavedNoColor" -> {
                val numsArray = args?.getArray(0)
                val nums = mutableListOf<Int>()
                if (numsArray != null) {
                    for (i in 0 until numsArray.size()) nums.add(numsArray.getInt(i))
                }
                view.removeSavedNoColor(nums)
            }
        }
    }

    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> = mapOf(
        "onVersePress" to mapOf("registrationName" to "onVersePress"),
        "onVerseNumPress" to mapOf("registrationName" to "onVerseNumPress"),
        "onVerseComparePress" to mapOf("registrationName" to "onVerseComparePress"),
        "onInterlinearWordPress" to mapOf("registrationName" to "onInterlinearWordPress"),
        "onInterlinearDismiss" to mapOf("registrationName" to "onInterlinearDismiss"),
        "onReturnIconPress" to mapOf("registrationName" to "onReturnIconPress")
    )

    companion object {
        const val COMMAND_LOAD_CHAPTER = 1
        const val COMMAND_SCROLL_TO_VERSE = 2
        const val COMMAND_CLEAR_SELECTION = 3
        const val COMMAND_UPDATE_VERSE_HIGHLIGHT = 4
        const val COMMAND_SHOW_INTERLINEAR = 5
        const val COMMAND_CLEAR_INTERLINEAR = 6
        const val COMMAND_SELECT_VERSE = 7
        const val COMMAND_UPDATE_HTML = 8
        const val COMMAND_UPDATE_BADGES = 9
        const val COMMAND_TOGGLE_MULTI_SELECT = 10
        const val COMMAND_CLEAR_MULTI_SELECT = 11
        const val COMMAND_UPDATE_SAVED_NO_COLOR = 12
        const val COMMAND_REMOVE_SAVED_NO_COLOR = 13
        const val COMMAND_FOCUS_VERSE = 14
    }
}
