import { useAppTheme } from '@/components/ThemeContext';
import { globalVersionRef, linkVerseCallbackRef, selectorNavigationRef } from '@/components/verse-context-ref';
import { Colors } from '@/constants/theme';
import { addNoteGroup, cleanJesusTags, getVerses, searchReference, updateNoteGroup } from '@/database/queries';
import { editorHtml } from '@/editor/editorHtml';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Bold, Clipboard as ClipboardIcon, Copy, Highlighter, Italic, Link, Link2, Trash2, Underline, X } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';

const MAX_LEN = 500;

type LinkData = {
  id: string;
  book_id: number; chapter: number;
  verseStart: number; verseEnd: number;
  book_name: string; book_abbrev: string;
};

function chipLabel(d: LinkData) {
  const ref = d.verseStart === d.verseEnd ? `${d.verseStart}` : `${d.verseStart}-${d.verseEnd}`;
  return `${d.book_name} ${d.chapter}:${ref}`;
}

export default function NotaGlobal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useAppTheme();
  const colors = Colors[isDark ? 'dark' : 'light'];
  const params = useLocalSearchParams<{ groupId?: string; initialContent?: string }>();

  const webviewRef = useRef<WebView>(null);
  const [charCount, setCharCount] = useState(0);
  const [hasChips, setHasChips] = useState(false);
  const [previewLink, setPreviewLink] = useState<LinkData | null>(null);
  const [formatState, setFormatState] = useState({ bold: false, italic: false, underline: false, mark: false });
  const chipsRef = useRef<Record<string, LinkData>>({});

  const canSave = charCount > 0 || hasChips;

  const injectJs = (js: string) => webviewRef.current?.injectJavaScript(`${js}; true;`);

  const onWebViewLoad = () => {
    injectJs(`window.setMaxChars(${MAX_LEN})`);
    injectJs(`window.setAccentColor(${JSON.stringify(colors.accent)})`);
    if (params.initialContent) {
      injectJs(`window.setHtml(${JSON.stringify(params.initialContent)})`);
    }
  };

  const onMessage = (e: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'CHANGE') {
        setCharCount(msg.charCount ?? 0);
        setHasChips(Object.keys(chipsRef.current).length > 0);
      } else if (msg.type === 'FORMAT_STATE') {
        setFormatState({ bold: !!msg.bold, italic: !!msg.italic, underline: !!msg.underline, mark: !!msg.mark });
      } else if (msg.type === 'COPY_TEXT') {
        const text = msg.text || '';
        if (text) Clipboard.setStringAsync(text);
      } else if (msg.type === 'PASTE_WITH_CHIPS') {
        const raw: string = msg.text || '';
        const parts: { type: string; text?: string; id?: string; label?: string; accentColor?: string }[] = [];
        const regex = /\[\[([^\]]+)\]\]/g;
        let last = 0, m: RegExpExecArray | null;
        while ((m = regex.exec(raw)) !== null) {
          if (m.index > last) parts.push({ type: 'text', text: raw.slice(last, m.index) });
          const label = m[1];
          // parse "Livro cap:ver" ou "Livro cap:ver-ver"
          const refMatch = label.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);
          if (refMatch) {
            const ref = searchReference(`${refMatch[1]} ${refMatch[2]}:${refMatch[3]}`);
            if (ref) {
              const chipId = `chip_${Date.now()}_${parts.length}`;
              const verseStart = parseInt(refMatch[3], 10);
              const verseEnd = refMatch[4] ? parseInt(refMatch[4], 10) : verseStart;
              const data: LinkData = {
                id: chipId, book_id: ref.book.id, chapter: parseInt(refMatch[2], 10),
                verseStart, verseEnd, book_name: ref.book.name_pt, book_abbrev: ref.book.abbrev,
              };
              chipsRef.current[chipId] = data;
              setHasChips(true);
              parts.push({ type: 'chip', id: chipId, label, accentColor: colors.accent });
            } else {
              parts.push({ type: 'text', text: label });
            }
          } else {
            parts.push({ type: 'text', text: label });
          }
          last = m.index + m[0].length;
        }
        if (last < raw.length) parts.push({ type: 'text', text: raw.slice(last) });
        injectJs(`window.pasteResolved(${JSON.stringify(parts)})`);
      } else if (msg.type === 'CHIP_PRESS') {
        const link = chipsRef.current[msg.id];
        if (link) setPreviewLink(link);
      }
    } catch {}
  };

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) injectJs(`window.pasteText(${JSON.stringify(text)})`);
  };

  const openVersePicker = () => {
    linkVerseCallbackRef.current = (book_id, chapter, verseStart, verseEnd, book_abbrev, book_name) => {
      const chipId = `chip_${Date.now()}`;
      const data: LinkData = { id: chipId, book_id, chapter, verseStart, verseEnd, book_name, book_abbrev };
      chipsRef.current[chipId] = data;
      const label = chipLabel(data);
      injectJs(`window.insertChip(${JSON.stringify(chipId)}, ${JSON.stringify(label)}, ${JSON.stringify(colors.accent)})`);
      setHasChips(true);
    };
    router.push('/vincular');
  };

  const previewVerses = useMemo(() => {
    if (!previewLink) return [];
    const all = getVerses(previewLink.book_id, previewLink.chapter);
    const version = globalVersionRef.current ?? 'ara';
    const out: { num: number; text: string }[] = [];
    for (let v = previewLink.verseStart; v <= previewLink.verseEnd; v++) {
      const d = all.find(x => x.verse === v);
      if (!d) continue;
      const raw = version === 'arc' ? d.text_arc
        : version === 'kjv' ? d.text_kjv
        : version === 'dby' ? d.text_dby
        : d.text_ara;
      const t = cleanJesusTags(raw ?? d.text_ara ?? d.text_arc ?? d.text_kjv ?? d.text_dby ?? '');
      if (t) out.push({ num: v, text: t });
    }
    return out;
  }, [previewLink]);

  const handleSave = () => {
    const verses = Object.values(chipsRef.current).flatMap(d =>
      Array.from({ length: d.verseEnd - d.verseStart + 1 }, (_, k) => ({
        book_id: d.book_id, chapter: d.chapter, verse: d.verseStart + k,
      }))
    );
    injectJs(`window.ReactNativeWebView.postMessage(JSON.stringify({type:'SAVE_TEXT',text:document.querySelector('.ProseMirror')?.innerText||''}))`);
    _pendingSave.current = { verses };
  };

  const _pendingSave = useRef<{ verses: { book_id: number; chapter: number; verse: number }[] } | null>(null);

  const onMessageWithSave = (e: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'SAVE_TEXT' && _pendingSave.current) {
        const plain = (msg.text || '').replace(/ㅤ/g, '').trim();
        const { verses } = _pendingSave.current;
        _pendingSave.current = null;
        if (!plain && verses.length === 0) return;
        if (params.groupId) {
          updateNoteGroup(Number(params.groupId), plain || '(nota com versículo)');
        } else {
          addNoteGroup(plain || '(nota com versículo)', verses);
        }
        Vibration.vibrate(20);
        router.back();
        return;
      }
      onMessage(e);
    } catch {}
  };

  const previewTitle = previewLink
    ? `${previewLink.book_name} ${previewLink.chapter}:${previewLink.verseStart === previewLink.verseEnd ? previewLink.verseStart : `${previewLink.verseStart}-${previewLink.verseEnd}`}`
    : '';

  const closePreview = () => setPreviewLink(null);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={18} color='#FFFFFF' />
        </Pressable>
        <Text style={styles.headerTitle}>Nota global</Text>
        <Pressable style={[styles.verseBtn, { backgroundColor: colors.accent }]} onPress={openVersePicker}>
          <Link2 size={14} color='#FFFFFF' />
          <Text style={styles.verseBtnText}>Versículo</Text>
        </Pressable>
      </View>

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <Pressable style={styles.toolbarBtn} onPress={() => injectJs('window.copyText()')}>
          <Copy size={16} color='#8A8A8A' />
        </Pressable>
        <Pressable style={styles.toolbarBtn} onPress={handlePaste}>
          <ClipboardIcon size={16} color='#8A8A8A' />
        </Pressable>
        <Pressable style={styles.toolbarBtn} onPress={() => injectJs('window.deleteBack()')}>
          <Trash2 size={16} color='#8A8A8A' />
        </Pressable>
        <View style={styles.toolbarSep} />
        <Pressable style={styles.toolbarBtn} onPress={() => injectJs('window.toggleBold()')}>
          <Bold size={16} color={formatState.bold ? colors.accent : '#8A8A8A'} />
        </Pressable>
        <Pressable style={styles.toolbarBtn} onPress={() => injectJs('window.toggleItalic()')}>
          <Italic size={16} color={formatState.italic ? colors.accent : '#8A8A8A'} />
        </Pressable>
        <Pressable style={styles.toolbarBtn} onPress={() => injectJs('window.toggleUnderline()')}>
          <Underline size={16} color={formatState.underline ? colors.accent : '#8A8A8A'} />
        </Pressable>
        <Pressable style={styles.toolbarBtn} onPress={() => injectJs('window.toggleMark()')}>
          <Highlighter size={16} color={formatState.mark ? colors.accent : '#8A8A8A'} />
        </Pressable>
        <Text style={styles.counter}>{charCount}/{MAX_LEN}</Text>
      </View>

      {/* Editor WebView */}
      <WebView
        ref={webviewRef}
        source={{ html: editorHtml }}
        style={styles.webview}
        onLoad={onWebViewLoad}
        onMessage={onMessageWithSave}
        keyboardDisplayRequiresUserAction={false}
        scrollEnabled={true}
        nestedScrollEnabled={true}
        showsVerticalScrollIndicator={false}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={false}
        cacheEnabled={false}
        incognito={true}
      />

      {/* Salvar */}
      <View style={[styles.cta, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={[styles.saveBtn, { backgroundColor: colors.accent }, !canSave && { opacity: 0.4 }]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Text style={styles.saveBtnText}>Salvar nota</Text>
        </Pressable>
      </View>

      {/* Modal de prévia do versículo */}
      {previewLink && (
        <Modal visible transparent animationType="fade" onRequestClose={closePreview}>
          <Pressable style={styles.modalOverlay} onPress={closePreview}>
            <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
              {/* Rouba foco do WebView sem abrir teclado */}
              <TextInput style={styles.focusStealer} autoFocus showSoftInputOnFocus={false} caretHidden />

              {/* Cabeçalho */}
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <View style={styles.modalTitleRow}>
                  <Link size={16} color={colors.accent} />
                  <Text style={[styles.modalTitle, { color: colors.accent }]}>{previewTitle}</Text>
                </View>
                <Pressable onPress={closePreview} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={20} color={colors.textSecondary} />
                </Pressable>
              </View>

              {/* Versículos */}
              <ScrollView bounces={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.modalBody}>
                {previewVerses.map(v => (
                  <View key={v.num} style={styles.modalVerseRow}>
                    <Text style={[styles.modalVerseNum, { color: colors.accent }]}>{v.num}</Text>
                    <Text style={[styles.modalVerseText, { color: colors.text }]}>{'"'}{v.text}{'"'}</Text>
                  </View>
                ))}
              </ScrollView>

              {/* Botão Ver capítulo */}
              <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: colors.accent }]}
                  onPress={() => {
                    closePreview();
                    selectorNavigationRef.navigate?.(previewLink.book_id, previewLink.chapter, previewLink.verseStart);
                    router.back();
                  }}
                >
                  <Text style={styles.modalBtnText}>Ver capítulo</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F0F0F' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#242424', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  verseBtn: {
    flexDirection: 'row', alignItems: 'center',
    gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  verseBtnText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  toolbar: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#2A2A2A',
    paddingHorizontal: 16, paddingVertical: 4, gap: 4,
  },
  toolbarBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  toolbarSep: { width: 1, height: 20, backgroundColor: '#2A2A2A', marginHorizontal: 4 },
  webview: { flex: 1, backgroundColor: '#0F0F0F' },
  counter: { fontSize: 12, color: '#555555', marginLeft: 'auto' },
  cta: { paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#1E1E1E' },
  saveBtn: { borderRadius: 16, paddingVertical: 17, alignItems: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    width: '100%', maxHeight: Dimensions.get('window').height * 0.75,
    borderRadius: 20, overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1,
  },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { fontWeight: 'bold', fontSize: 16, fontFamily: 'serif' },
  modalBody: { padding: 16, gap: 12 },
  modalVerseRow: { gap: 4 },
  modalVerseNum: { fontWeight: '700', fontSize: 13, marginBottom: 2 },
  modalVerseText: { fontSize: 16, lineHeight: 26, fontFamily: 'serif', fontStyle: 'italic' },
  modalFooter: { padding: 16, borderTopWidth: 1 },
  modalBtn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  modalBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  focusStealer: { position: 'absolute', width: 0, height: 0, opacity: 0 },
});
