import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Vibration,
  Animated,
  Modal,
  BackHandler,
  InteractionManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { BookOpen, MessageSquare, Plus, Save, Check, X, Link, ChevronRight, ArrowLeftRight, Search, ArrowLeft, Calendar, Edit2, Trash2 } from 'lucide-react-native';
import { Colors, Spacing } from '@/constants/theme';
import {
  addNote,
  updateNote,
  deleteNote,
  getNotesByVerse,
  getBooks,
  getChaptersCount,
  getVersesCount,
  invalidateVersesCache,
  getVerse,
  addNoteGroup,
  updateNoteGroup,
  deleteNoteGroup,
  getNoteGroupsByVerse,
  countNoteGroupsByChapter,
  getGroupIdsForVerses,
  mergeNoteGroups,
  NoteGroup,
  Book,
  Verse,
  Note,
  parseGroupNotes,
  BlockLink,
  addBlockLink,
  removeBlockLink,
  getBlockLinksFromBlock,
  getBlockLinksFromVerse,
  getBlockLinksToVerse,
  countBlockLinksFromBlock,
} from '@/database/queries';
import { activeStudyVerseRef, dbModifiedRef } from '@/components/verse-context-ref';


type BookRowProps = {
  book: Book;
  isSelected: boolean;
  isActiveBook: boolean;
  accentColor: string;
  isDark: boolean;
  textColor: string;
  textSecondaryColor: string;
  textMutedColor: string;
  atualColor: string;
  atualBg: string;
  onPress: (book: Book) => void;
};

const BookRow = memo(({ book, isSelected, isActiveBook, accentColor, isDark, textColor, textSecondaryColor, textMutedColor, atualColor, atualBg, onPress }: BookRowProps) => (
  <Pressable
    style={[styles.bookRowLine, {
      backgroundColor: isSelected ? `${accentColor}18` : (isDark ? '#161413' : '#FFFFFF'),
      borderColor: isSelected ? accentColor : (isDark ? '#242120' : '#EBE6DA'),
      borderWidth: isSelected ? 1.5 : 1,
    }]}
    onPress={() => onPress(book)}
  >
    <View style={styles.bookRowLeft}>
      <View style={[styles.bookAbbrevBadge, { backgroundColor: isActiveBook ? atualColor : isSelected ? accentColor : (isDark ? '#2C2826' : '#F2EDE4') }]}>
        <Text style={[styles.bookAbbrevText, isSelected ? { color: '#FFF' } : isActiveBook ? { color: '#FFF' } : { color: textSecondaryColor }]}>
          {book.abbrev.toUpperCase()}
        </Text>
      </View>
      <Text style={[styles.bookRowText, isSelected ? { color: accentColor, fontWeight: 'bold' } : { color: textColor }]}>
        {book.name_pt}
      </Text>
      {isActiveBook && (
        <View style={[styles.originBadge, { backgroundColor: atualBg }]}>
          <Text style={[styles.originBadgeText, { color: atualColor }]}>Atual</Text>
        </View>
      )}
    </View>
    <ChevronRight size={16} color={isSelected ? accentColor : textMutedColor} />
  </Pressable>
));

type BookPickerListProps = {
  allBooks: Book[];
  activeVerseBookId: number | undefined;
  selectedLinkBookId: number | undefined;
  linkAccentColor: string;
  isDark: boolean;
  textColor: string;
  textSecondaryColor: string;
  textMutedColor: string;
  atualColor: string;
  atualBg: string;
  bookListReady: boolean;
  resetKey: number;
  onSelectBook: (book: Book) => void;
};

const BookPickerList = memo(({
  allBooks, activeVerseBookId, selectedLinkBookId,
  linkAccentColor, isDark, textColor, textSecondaryColor, textMutedColor,
  atualColor, atualBg, bookListReady, resetKey, onSelectBook,
}: BookPickerListProps) => {
  const [testamentFilter, setTestamentFilter] = useState<'all' | 'old' | 'new'>('all');
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const bookScrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    setTestamentFilter('all');
    setBookSearchQuery('');
  }, [resetKey]);


  // Filtra apenas por busca; o filtro de testamento é feito via display:none para evitar desmontagem
  const searchFilteredOT = useMemo(() =>
    allBooks.filter(b => b.testament === 'old' && (
      !bookSearchQuery ||
      b.name_pt.toLowerCase().includes(bookSearchQuery.toLowerCase()) ||
      b.abbrev.toLowerCase().includes(bookSearchQuery.toLowerCase())
    )),
  [allBooks, bookSearchQuery]);

  const searchFilteredNT = useMemo(() =>
    allBooks.filter(b => b.testament === 'new' && (
      !bookSearchQuery ||
      b.name_pt.toLowerCase().includes(bookSearchQuery.toLowerCase()) ||
      b.abbrev.toLowerCase().includes(bookSearchQuery.toLowerCase())
    )),
  [allBooks, bookSearchQuery]);

  const handleSelectBook = useCallback((book: Book) => {
    onSelectBook(book);
  }, [onSelectBook]);

  return (
    <>
      <View style={[styles.searchAndFilterRow, { paddingHorizontal: Spacing.four }]}>
        <View style={[styles.compactSearchBox, { backgroundColor: isDark ? '#1C1A19' : '#FFF', borderColor: isDark ? '#3C3835' : '#E6DEC9' }]}>
          <Search size={14} color={textMutedColor} />
          <TextInput
            style={[styles.pickerSearchInput, { color: textColor }]}
            placeholder="Buscar livro..."
            placeholderTextColor={isDark ? '#6E6662' : '#A3998D'}
            value={bookSearchQuery}
            onChangeText={setBookSearchQuery}
            clearButtonMode="never"
          />
          {bookSearchQuery.length > 0 && (
            <Pressable onPress={() => setBookSearchQuery('')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ padding: 4 }}>
              <X size={16} color={textSecondaryColor} />
            </Pressable>
          )}
        </View>
        <View style={[styles.compactTestamentSelector, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}>
          {(['all', 'old', 'new'] as const).map((f) => (
            <Pressable
              key={f}
              style={[styles.compactTestamentBtn, testamentFilter === f && { backgroundColor: linkAccentColor }]}
              onPress={() => { setTestamentFilter(f); Vibration.vibrate(10); }}
            >
              <Text style={[styles.compactTestamentBtnText, testamentFilter === f ? { color: '#FFF' } : { color: textSecondaryColor }]}>
                {f === 'all' ? 'Todos' : f === 'old' ? 'VT' : 'NT'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {!bookListReady && (
        <View style={{ flex: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.two }}>
          {Array.from({ length: 12 }, (_, i) => (
            <View key={i} style={[styles.bookRowLine, {
              backgroundColor: isDark ? '#161413' : '#FFFFFF',
              borderColor: isDark ? '#242120' : '#EBE6DA',
              borderWidth: 1,
              marginBottom: 6,
            }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
                <View style={{ width: 38, height: 26, borderRadius: 8, backgroundColor: isDark ? '#2C2826' : '#EDE8DF' }} />
                <View style={{ width: 60 + (i % 4) * 25, height: 13, borderRadius: 4, backgroundColor: isDark ? '#2C2826' : '#EDE8DF' }} />
              </View>
            </View>
          ))}
        </View>
      )}
      {bookListReady && (
        <ScrollView
          ref={bookScrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: Spacing.four, paddingBottom: 72 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Antigo Testamento — oculto via display:none, sem desmontar BookRow */}
          <View style={testamentFilter === 'new' ? { display: 'none' } : undefined}>
            {searchFilteredOT.length > 0 && (
              <>
                <View style={styles.testamentHeaderContainer}>
                  <View style={[styles.testamentIndicatorBar, { backgroundColor: linkAccentColor }]} />
                  <Text style={[styles.testamentHeaderLabel, { color: textColor }]}>Antigo Testamento</Text>
                </View>
                {searchFilteredOT.map((book) => (
                  <BookRow
                    key={`book_${book.id}`}
                    book={book}
                    isSelected={selectedLinkBookId === book.id}
                    isActiveBook={activeVerseBookId === book.id}
                    accentColor={linkAccentColor}
                    isDark={isDark}
                    textColor={textColor}
                    textSecondaryColor={textSecondaryColor}
                    textMutedColor={textMutedColor}
                    atualColor={atualColor}
                    atualBg={atualBg}
                    onPress={handleSelectBook}
                  />
                ))}
              </>
            )}
          </View>

          {/* Novo Testamento — oculto via display:none, sem desmontar BookRow */}
          <View style={testamentFilter === 'old' ? { display: 'none' } : undefined}>
            {searchFilteredNT.length > 0 && (
              <>
                <View style={styles.testamentHeaderContainer}>
                  <View style={[styles.testamentIndicatorBar, { backgroundColor: linkAccentColor }]} />
                  <Text style={[styles.testamentHeaderLabel, { color: textColor }]}>Novo Testamento</Text>
                </View>
                {searchFilteredNT.map((book) => (
                  <BookRow
                    key={`book_${book.id}`}
                    book={book}
                    isSelected={selectedLinkBookId === book.id}
                    isActiveBook={activeVerseBookId === book.id}
                    accentColor={linkAccentColor}
                    isDark={isDark}
                    textColor={textColor}
                    textSecondaryColor={textSecondaryColor}
                    textMutedColor={textMutedColor}
                    atualColor={atualColor}
                    atualBg={atualBg}
                    onPress={handleSelectBook}
                  />
                ))}
              </>
            )}
          </View>
        </ScrollView>
      )}
    </>
  );
});


const parseSqliteDate = (dateStr: string) => {
  if (!dateStr) return new Date();
  const parts = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);
  if (parts) {
    const year = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10) - 1;
    const day = parseInt(parts[3], 10);
    const hour = parseInt(parts[4], 10);
    const minute = parseInt(parts[5], 10);
    const second = parseInt(parts[6], 10);
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }
  return new Date(dateStr);
};

function buildRangesLabel(verses: Array<{ book_id: number; chapter: number; verse: number }>): string {
  if (verses.length === 0) return '';
  const nums = [...new Set(verses.map(v => v.verse))].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = nums[0], end = nums[0];
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === end + 1) { end = nums[i]; }
    else { ranges.push(start === end ? `${start}` : `${start}-${end}`); start = end = nums[i]; }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  const book = verses[0];
  return `${book.book_id ? '' : ''}vers. ${ranges.join(', ')}`;
}

const formatNoteDate = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} às ${hours}:${minutes}`;
};

export default function StudyAndNotesScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const noteInputRef = useRef<any>(null);

  // Cores suaves para o item "Atual" (livro, capítulo e versículo sob estudo) - Laranja Puro e Vibrante
  const atualColor = isDark ? '#F97316' : '#EA580C';
  const atualBg = isDark ? 'rgba(249, 115, 22, 0.08)' : 'rgba(234, 88, 12, 0.05)';
  const atualBorder = isDark ? '#C2410C' : '#FDBA74';

  // Active study verse context
  const [activeVerse, setActiveVerse] = useState<Verse | null>(activeStudyVerseRef.current);
  const [blockLinks, setBlockLinks] = useState<BlockLink[]>([]);
  const [noteText, setNoteText] = useState('');
  const [noteInputFocused, setNoteInputFocused] = useState(false);
  const [noteHistory, setNoteHistory] = useState<Note[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<number | null>(null);
  const [showLimitInfo, setShowLimitInfo] = useState(false);
  const [showGroupVersesModal, setShowGroupVersesModal] = useState(false);
  const pendingEditRef = useRef<{ id: number; text: string } | null>(null);
  const pendingTabRef = useRef<'history' | null>(null);
  const pendingHighlightNoteRef = useRef<number | null>(null);
  const pendingHighlightGroupRef = useRef<number | null>(null);
  const savedGroupVersesRef = useRef<Array<{ book_id: number; chapter: number; verse: number }> | null>(null);

  // Group mode
  const [groupVerses, setGroupVerses] = useState<Array<{ book_id: number; chapter: number; verse: number }> | null>(null);
  const [noteGroups, setNoteGroups] = useState<NoteGroup[]>([]);
  const [incomingLinks, setIncomingLinks] = useState<BlockLink[]>([]);
  const [editingGroupNoteId, setEditingGroupNoteId] = useState<number | null>(null);
  const [editingGroupNoteIndex, setEditingGroupNoteIndex] = useState<number | null>(null);
  const [groupNoteEditText, setGroupNoteEditText] = useState('');
  const [chapterGroupCount, setChapterGroupCount] = useState(0);
  const [highlightedNoteId, setHighlightedNoteId] = useState<number | null>(null);
  const [highlightedGroupId, setHighlightedGroupId] = useState<number | null>(null);
  const [highlightedGroupNoteIndex, setHighlightedGroupNoteIndex] = useState<number | null>(null);
  const [noteTypeFilter, setNoteTypeFilter] = useState<'individual' | 'group'>('individual');
  const [linkTypeFilter, setLinkTypeFilter] = useState<'individual' | 'group'>('individual');

  // Tab State
  const [detailMode, setDetailMode] = useState<'note' | 'links' | 'references'>(activeStudyVerseRef.mode ?? 'note');
  const [noteTab, setNoteTab] = useState<'verse' | 'history'>('verse');

  // Selected translation to display in the main card (ARA, ARC, KJV, DBY)
  const [selectedTranslation, setSelectedTranslation] = useState<'ARA' | 'ARC' | 'KJV' | 'DBY'>('ARA');

  // EMBEDDED TEOLOGICAL LINK PICKER STATE
  const [allBooks, setAllBooks] = useState<Book[]>(() => getBooks());
  const [pickerStep, setPickerStep] = useState<'book' | 'chapter' | 'verse'>('book');
  const [selectedLinkBook, setSelectedLinkBook] = useState<Book | null>(null);
  const [selectedLinkChapter, setSelectedLinkChapter] = useState<number | null>(null);
  const [selectedLinkVerseStart, setSelectedLinkVerseStart] = useState<number | null>(null);
  const [selectedLinkVerseEnd, setSelectedLinkVerseEnd] = useState<number | null>(null);

  // Lists for picking
  const [chaptersList, setChaptersList] = useState<number[]>([]);
  const [versesList, setVersesList] = useState<number[]>([]);

  const bookListInitializedRef = useRef(false);
  const [bookListReady, setBookListReady] = useState(false);
  const [pickerResetKey, setPickerResetKey] = useState(0);


  const syncFromRef = () => {
    const current = activeStudyVerseRef.current;
    setActiveVerse(current);
    setDetailMode(activeStudyVerseRef.mode);
    const gv = activeStudyVerseRef.groupVerses ?? null;
    setGroupVerses(gv);
    savedGroupVersesRef.current = gv;
    const isGroupContext = !!(activeStudyVerseRef.highlightGroupId || (gv && gv.length > 1));
    setNoteTypeFilter(isGroupContext ? 'group' : 'individual');
    // sempre reseta estados de edição ao entrar numa nova sessão
    setEditingGroupNoteId(null);
    setNoteText('');
    setEditingNoteId(null);

    // Reseta síncronamente os estados do picker de vinculação para evitar flicker
    setPickerStep('book');
    setPickerResetKey(k => k + 1);
    setSelectedLinkChapter(null);
    setSelectedLinkVerseStart(null);
    setSelectedLinkVerseEnd(null);
    if (current) {
      const matchedBook = allBooks.find(b => b.id === current.book_id);
      if (matchedBook) {
        setSelectedLinkBook(matchedBook);
        const chaptersCount = getChaptersCount(matchedBook.id);
        setChaptersList(Array.from({ length: chaptersCount }, (_, i) => i + 1));
      } else {
        setSelectedLinkBook(null);
      }
    } else {
      setSelectedLinkBook(null);
    }

    if (activeStudyVerseRef.highlightGroupId !== null || activeStudyVerseRef.highlightNoteId !== null) {
      const hgid = activeStudyVerseRef.highlightGroupId;
      const hnid = activeStudyVerseRef.highlightNoteId;
      const hgni = activeStudyVerseRef.highlightGroupNoteIndex;
      activeStudyVerseRef.highlightGroupId = null;
      activeStudyVerseRef.highlightNoteId = null;
      activeStudyVerseRef.highlightGroupNoteIndex = null;
      pendingTabRef.current = 'history';
      if (hgid !== null) { pendingHighlightGroupRef.current = hgid; }
      if (hnid !== null) pendingHighlightNoteRef.current = hnid;
      if (hgni !== null) { setTimeout(() => setHighlightedGroupNoteIndex(hgni), 50); }
    } else {
      pendingTabRef.current = null;
      pendingHighlightGroupRef.current = null;
      pendingHighlightNoteRef.current = null;
      setHighlightedGroupId(null);
      setHighlightedNoteId(null);
    }
  };

  // Subscrevemos SEMPRE (não apenas no foco) para que syncFromRef rode ANTES de a tela aparecer,
  // eliminando o flash de estado antigo quando o usuário toca "Vincular"
  useEffect(() => {
    if (activeStudyVerseRef.current) syncFromRef();
    return activeStudyVerseRef.subscribe(syncFromRef);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // No foco: apenas o skeleton na primeira visita (syncFromRef já é tratado pela subscription sempre-ativa)
  useFocusEffect(useCallback(() => {
    if (!bookListInitializedRef.current) {
      setBookListReady(false);
      const timer = setTimeout(() => {
        setBookListReady(true);
        bookListInitializedRef.current = true;
      }, 32);
      return () => clearTimeout(timer);
    }
  }, []));

  // Reseta o picker ao trocar de aba manualmente — chamado inline nos handlers de setDetailMode
  const resetPickerForMode = useCallback(() => {
    setPickerStep('book');
    setPickerResetKey(k => k + 1);
    setSelectedLinkChapter(null);
    setSelectedLinkVerseStart(null);
    setSelectedLinkVerseEnd(null);
    if (activeVerse) {
      const matchedBook = allBooks.find(b => b.id === activeVerse.book_id);
      if (matchedBook) {
        setSelectedLinkBook(matchedBook);
        setChaptersList(Array.from({ length: getChaptersCount(matchedBook.id) }, (_, i) => i + 1));
      } else {
        setSelectedLinkBook(null);
      }
    } else {
      setSelectedLinkBook(null);
    }
  }, [activeVerse, allBooks]);

  // Sync active verse content (correlations, note content) when activeVerse updates
  useEffect(() => {
    if (!activeVerse) return;
    const task = InteractionManager.runAfterInteractions(() => {
      try {
        // Fetch full verse with all translations if any version is missing
        if (!activeVerse.text_arc || !activeVerse.text_kjv) {
          const full = getVerse(activeVerse.book_id, activeVerse.chapter, activeVerse.verse);
          if (full) { setActiveVerse(full); return; }
        }

        const gv = savedGroupVersesRef.current;
        const src = (gv && gv.length > 0) ? gv : [{ book_id: activeVerse.book_id, chapter: activeVerse.chapter, verse: activeVerse.verse }];
        setBlockLinks(gv && gv.length > 0
          ? getBlockLinksFromBlock(src)
          : getBlockLinksFromVerse(activeVerse.book_id, activeVerse.chapter, activeVerse.verse));
        setIncomingLinks(getBlockLinksToVerse(activeVerse.book_id, activeVerse.chapter, activeVerse.verse));

        setNoteHistory(getNotesByVerse(activeVerse.book_id, activeVerse.chapter, activeVerse.verse));
        setNoteGroups(getNoteGroupsByVerse(activeVerse.book_id, activeVerse.chapter, activeVerse.verse));
        setChapterGroupCount(countNoteGroupsByChapter(activeVerse.book_id, activeVerse.chapter));
        if (pendingTabRef.current === 'history') {
          setNoteTab('history');
          if (pendingHighlightNoteRef.current !== null) { setHighlightedNoteId(pendingHighlightNoteRef.current); }
          if (pendingHighlightGroupRef.current !== null) { setHighlightedGroupId(pendingHighlightGroupRef.current); }
        } else if (pendingEditRef.current) {
          const { id, text } = pendingEditRef.current;
          pendingEditRef.current = null;
          setNoteText(text);
          setEditingNoteId(id);
          setNoteTab('history');
        } else {
          setNoteText('');
          setNoteTab('verse');
          setEditingNoteId(null);
          if (pendingHighlightNoteRef.current === null) setHighlightedNoteId(null);
          if (pendingHighlightGroupRef.current === null) setHighlightedGroupId(null);
        }

        // Pre-load chapters for the active verse's book
        const matchedBook = allBooks.find(b => b.id === activeVerse.book_id);
        if (matchedBook) {
          setSelectedLinkBook(matchedBook);
          const chaptersCount = getChaptersCount(matchedBook.id);
          setChaptersList(Array.from({ length: chaptersCount }, (_, i) => i + 1));
        }
      } catch (e) {
        console.warn('[study] useEffect error:', e);
      }
    });
    return () => task.cancel();
  }, [activeVerse]);


  // Interceptar o botão/gesto físico de voltar do Android
  useEffect(() => {
    const handleBackButton = () => {
      if (detailMode === 'references') {
        setDetailMode('links');
        resetPickerForMode();
        Vibration.vibrate(10);
        return true;
      }
      // Se estivermos na aba "Vincular" e não estivermos no passo inicial (book)
      if (detailMode === 'links' && pickerStep !== 'book') {
        if (pickerStep === 'verse') {
          setPickerStep('chapter');
          setSelectedLinkVerseStart(null);
          setSelectedLinkVerseEnd(null);
        } else {
          setPickerStep('book');
          setSelectedLinkChapter(null);
          setSelectedLinkVerseStart(null);
          setSelectedLinkVerseEnd(null);
        }
        Vibration.vibrate(10);
        return true; // Intercepta e impede o comportamento padrão de fechar a tela
      }
      return false; // Permite o comportamento padrão (fechar/voltar de tela)
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackButton);
    return () => backHandler.remove();
  }, [detailMode, pickerStep]);

  // Handle Book Selection in picker
  const handleSelectBook = useCallback((book: Book) => {
    setSelectedLinkBook(book);
    setSelectedLinkChapter(null);
    setSelectedLinkVerseStart(null);
    setSelectedLinkVerseEnd(null);

    const chaptersCount = getChaptersCount(book.id);
    setChaptersList(Array.from({ length: chaptersCount }, (_, i) => i + 1));

    setPickerStep('chapter');
    Vibration.vibrate(15);
  }, []);

  // Handle Chapter Selection in picker
  const handleSelectChapter = (chapterNum: number) => {
    if (!selectedLinkBook) return;
    setSelectedLinkChapter(chapterNum);
    setSelectedLinkVerseStart(null);
    setSelectedLinkVerseEnd(null);

    const versesCount = getVersesCount(selectedLinkBook.id, chapterNum);
    const verses = Array.from({ length: versesCount }, (_, i) => i + 1);
    setVersesList(verses);

    setPickerStep('verse');
    Vibration.vibrate(15);
  };

  // Handle Verse Selection in picker (range selection)
  const handleSelectVerse = (verseNum: number) => {
    if (selectedLinkVerseStart === null) {
      setSelectedLinkVerseStart(verseNum);
      setSelectedLinkVerseEnd(null);
    } else if (selectedLinkVerseStart === verseNum && selectedLinkVerseEnd === null) {
      // tap same start verse → deselect
      setSelectedLinkVerseStart(null);
    } else if (selectedLinkVerseEnd !== null) {
      // range already set → start fresh from this verse
      setSelectedLinkVerseStart(verseNum);
      setSelectedLinkVerseEnd(null);
    } else {
      // second tap → set end if range ≤ 20
      const lo = Math.min(selectedLinkVerseStart, verseNum);
      const hi = Math.max(selectedLinkVerseStart, verseNum);
      if (hi - lo + 1 <= 20) {
        setSelectedLinkVerseEnd(verseNum);
      }
    }
    Vibration.vibrate(15);
  };

  const selectedVerseRange: number[] = (() => {
    if (selectedLinkVerseStart === null) return [];
    if (selectedLinkVerseEnd === null) return [selectedLinkVerseStart];
    const lo = Math.min(selectedLinkVerseStart, selectedLinkVerseEnd);
    const hi = Math.max(selectedLinkVerseStart, selectedLinkVerseEnd);
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  })();

  // Confirm Link Addition
  const handleAddLink = () => {
    if (!activeVerse || !selectedLinkBook || !selectedLinkChapter || selectedVerseRange.length === 0) return;

    const srcVerses = groupVerses && groupVerses.length > 1
      ? groupVerses.map(v => v.verse)
      : [activeVerse.verse];
    const srcBlock = groupVerses && groupVerses.length > 1
      ? groupVerses
      : [{ book_id: activeVerse.book_id, chapter: activeVerse.chapter, verse: activeVerse.verse }];

    // prevent self-link: tgt cannot be same book+chapter with same verses
    if (selectedLinkBook.id === activeVerse.book_id && selectedLinkChapter === activeVerse.chapter) {
      const tgtSet = new Set(selectedVerseRange);
      if (srcVerses.every(v => tgtSet.has(v)) && selectedVerseRange.length === srcVerses.length) return;
    }

    if (countBlockLinksFromBlock(srcBlock) >= 10) return;

    addBlockLink(
      activeVerse.book_id, activeVerse.chapter, srcVerses,
      selectedLinkBook.id, selectedLinkChapter, selectedVerseRange
    );

    Vibration.vibrate(30);
    dbModifiedRef.modified = true;
    invalidateVersesCache();

    setBlockLinks(groupVerses && groupVerses.length > 1
      ? getBlockLinksFromBlock(srcBlock)
      : getBlockLinksFromVerse(activeVerse.book_id, activeVerse.chapter, activeVerse.verse));
    setSelectedLinkVerseStart(null);
    setSelectedLinkVerseEnd(null);
  };

  const refreshNotes = () => {
    if (!activeVerse) return;
    setNoteHistory(getNotesByVerse(activeVerse.book_id, activeVerse.chapter, activeVerse.verse));
    dbModifiedRef.modified = true;
    invalidateVersesCache();
  };

  const handleSaveNote = () => {
    if (!activeVerse || !noteText.trim()) return;
    setEditingGroupNoteId(null);
    if (editingNoteId !== null) {
      // Editing existing note
      updateNote(editingNoteId, noteText.trim());
      setEditingNoteId(null);
    } else {
      // New note
      if (noteHistory.length >= 5) return;
      addNote(activeVerse.book_id, activeVerse.chapter, activeVerse.verse, noteText.trim());
    }
    setNoteText('');
    setNoteInputFocused(false);
    noteInputRef.current?.blur();
    setNoteTab('history');
    refreshNotes();
    Vibration.vibrate(20);
  };

  const handleDeleteNote = (id: number) => {
    setNoteToDelete(id);
    Vibration.vibrate(10);
  };

  const confirmDeleteNote = () => {
    if (noteToDelete !== null) {
      deleteNote(noteToDelete);
      if (editingNoteId === noteToDelete) { setEditingNoteId(null); setNoteText(''); }
      setNoteToDelete(null);
      refreshNotes();
      Vibration.vibrate(25);
    }
  };

  const handleRemoveBlockLink = (linkId: number) => {
    removeBlockLink(linkId);
    dbModifiedRef.modified = true;
    invalidateVersesCache();
    if (groupVerses && groupVerses.length > 1) {
      const src = groupVerses;
      setBlockLinks(getBlockLinksFromBlock(src));
    } else if (activeVerse) {
      setBlockLinks(getBlockLinksFromVerse(activeVerse.book_id, activeVerse.chapter, activeVerse.verse));
    }
  };

  const handleGoToVerse = (bookId: number, chapter: number, verse: number) => {
    router.navigate({
      pathname: '/',
      params: {
        bookId: String(bookId),
        chapter: String(chapter),
        verse: String(verse)
      }
    });
  };

  const getDisplayedScriptureText = () => {
    if (!activeVerse) return '';
    switch (selectedTranslation) {
      case 'ARC': return activeVerse.text_arc || '(Sem tradução ARC)';
      case 'KJV': return activeVerse.text_kjv || '(Sem tradução KJV)';
      case 'DBY': return activeVerse.text_dby || '(Sem tradução DBY)';
      default: return activeVerse.text_ara;
    }
  };

  const hasIndividualNotes = noteHistory.length > 0;
  const hasGroupNotes = noteGroups.some(g => parseGroupNotes(g.content ?? '').length > 0);
  const showTypeFilter = hasIndividualNotes && hasGroupNotes;
  const activeGroupNoteCount = noteGroups.length > 0 ? parseGroupNotes(noteGroups[0]?.content ?? '').length : 0;

  const isGroupLink = !!(groupVerses && groupVerses.length > 1);
  const linkAccentColor = isGroupLink ? '#F59E0B' : colors.accent;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Sleek Minimalist Top Navigation Header */}
      <View style={styles.topBackHeader}>
        <Pressable
          style={[styles.backIconCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
          onPress={() => {
            Vibration.vibrate(10);
            if (detailMode === 'references') {
              setDetailMode('links');
              resetPickerForMode();
            } else {
              router.navigate('/');
            }
          }}
        >
          <ArrowLeft size={18} color={colors.text} />
        </Pressable>
        
        <Text style={[styles.topHeaderTitle, { color: colors.text, fontFamily: 'serif' }]}>
          {detailMode === 'note' ? 'Anotação' : detailMode === 'links' ? 'Vincular' : 'Referências Cruzadas'}
        </Text>
        
        <View style={{ width: 38 }} />
      </View>


      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* TAB VINCULAR: sempre montada para abertura instantânea, mesmo sem versículo */}
        <View
          style={activeVerse && detailMode === 'links'
            ? { flex: 1, paddingTop: Spacing.two }
            : { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0 }
          }
          pointerEvents={activeVerse && detailMode === 'links' ? 'auto' : 'none'}
        >
            {/* Back button when not on book step */}
            {pickerStep !== 'book' && (
              <Pressable
                style={[styles.pickerBackRow, { borderBottomColor: isDark ? '#2B2725' : '#F0EAD9', marginHorizontal: Spacing.four }]}
                onPress={() => {
                  if (pickerStep === 'verse') {
                    setPickerStep('chapter');
                    setSelectedLinkVerseStart(null);
                    setSelectedLinkVerseEnd(null);
                  } else {
                    setPickerStep('book');
                    setSelectedLinkChapter(null);
                    setSelectedLinkVerseStart(null);
                    setSelectedLinkVerseEnd(null);
                  }
                  Vibration.vibrate(10);
                }}
              >
                <ArrowLeft size={15} color={linkAccentColor} />
                <Text style={[styles.pickerBackLabel, { color: linkAccentColor }]}>
                  {pickerStep === 'verse'
                    ? (selectedVerseRange.length > 0
                        ? `${selectedLinkBook?.name_pt} — Cap. ${selectedLinkChapter} — vers. ${selectedVerseRange.length === 1 ? selectedVerseRange[0] : `${Math.min(...selectedVerseRange)}-${Math.max(...selectedVerseRange)}`}`
                        : `${selectedLinkBook?.name_pt} — Cap. ${selectedLinkChapter}`)
                    : selectedLinkBook?.name_pt ?? 'Livros'}
                </Text>
              </Pressable>
            )}

            {/* BOOK PICKER — componente isolado para evitar re-render do pai ao trocar filtro */}
            {pickerStep === 'book' && (
              <BookPickerList
                allBooks={allBooks}
                activeVerseBookId={activeVerse?.book_id}
                selectedLinkBookId={selectedLinkBook?.id}
                linkAccentColor={linkAccentColor}
                isDark={isDark}
                textColor={colors.text}
                textSecondaryColor={colors.textSecondary}
                textMutedColor={colors.textMuted}
                atualColor={atualColor}
                atualBg={atualBg}
                bookListReady={bookListReady}
                resetKey={pickerResetKey}
                onSelectBook={handleSelectBook}
              />
            )}

            {/* CHAPTER GRID */}
            {pickerStep === 'chapter' && selectedLinkBook && (
              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: Spacing.four, paddingBottom: 56 }}>
                <View style={styles.numberWrapGrid}>
                  {chaptersList.map((chapNum) => {
                    const isSelected = selectedLinkChapter === chapNum;
                    const isActiveChapter = activeVerse && selectedLinkBook.id === activeVerse.book_id && activeVerse.chapter === chapNum;
                    return (
                      <Pressable
                        key={`picker_ch_${chapNum}`}
                        style={[
                          styles.numberCircleBtn, 
                          isSelected 
                            ? { backgroundColor: linkAccentColor }
                            : { backgroundColor: colors.backgroundElement }
                        ]}
                        onPress={() => handleSelectChapter(chapNum)}
                      >
                        <Text 
                          style={[
                            styles.numberCircleText, 
                            isSelected 
                              ? { color: '#FFF', fontWeight: 'bold' } 
                              : isActiveChapter 
                                ? { color: atualColor, fontWeight: 'bold' }
                                : { color: colors.text }
                          ]}
                        >
                          {chapNum}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={{ height: 16 }} />
              </ScrollView>
            )}

            {/* VERSE GRID */}
            {pickerStep === 'verse' && selectedLinkBook && selectedLinkChapter && (
              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: Spacing.four, paddingBottom: 56 }}>
                <View style={styles.numberWrapGrid}>
                  {versesList.map((verseNum) => {
                    const isStart = selectedLinkVerseStart === verseNum;
                    const isInRange = selectedVerseRange.includes(verseNum);
                    const isSelf = activeVerse && selectedLinkBook.id === activeVerse.book_id && selectedLinkChapter === activeVerse.chapter && verseNum === activeVerse.verse;
                    const lo = selectedLinkVerseStart !== null ? Math.min(selectedLinkVerseStart, verseNum) : verseNum;
                    const hi = selectedLinkVerseStart !== null ? Math.max(selectedLinkVerseStart, verseNum) : verseNum;
                    const wouldExceed = selectedLinkVerseStart !== null && selectedLinkVerseEnd === null && (hi - lo + 1) > 20;
                    return (
                      <Pressable
                        key={`picker_vs_${verseNum}`}
                        disabled={isSelf || wouldExceed}
                        style={[
                          styles.numberCircleBtn,
                          isStart ? { backgroundColor: linkAccentColor } :
                          isInRange ? { backgroundColor: `${linkAccentColor}44` } :
                          { backgroundColor: colors.backgroundElement },
                          wouldExceed && { opacity: 0.3 },
                        ]}
                        onPress={() => handleSelectVerse(verseNum)}
                      >
                        <Text style={[
                          styles.numberCircleText,
                          isStart ? { color: '#FFF', fontWeight: 'bold' } :
                          isInRange ? { color: linkAccentColor, fontWeight: '600' } :
                          isSelf ? { color: atualColor, fontWeight: 'bold', opacity: 0.75 } :
                          { color: colors.text }
                        ]}>
                          {verseNum}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={{ height: 16 }} />
              </ScrollView>
            )}

            {/* BARRAS DE AÇÃO FIXAS NO RODAPÉ */}
            {pickerStep === 'verse' && selectedLinkBook && selectedLinkChapter && selectedVerseRange.length > 0 ? (
              /* Confirm bar — fixa quando versículo selecionado */
              <View
                style={[
                  styles.fixedBottomBar,
                  {
                    backgroundColor: isDark ? '#1C1A19' : '#FFF',
                    borderTopColor: isDark ? '#2B2725' : '#E6DEC9',
                    paddingBottom: (insets.bottom || 0) + Spacing.three
                  }
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pickerConfirmSummary, { color: colors.textMuted }]}>DESTINO SELECIONADO</Text>
                  <Text style={[styles.pickerConfirmRef, { color: linkAccentColor, fontWeight: 'bold' }]}>
                    {selectedLinkBook.name_pt} {selectedLinkChapter}:{selectedVerseRange.length === 1 ? selectedVerseRange[0] : `${Math.min(...selectedVerseRange)}-${Math.max(...selectedVerseRange)}`}
                  </Text>
                </View>
                <Pressable style={[styles.pickerConfirmBtn, { backgroundColor: linkAccentColor }]} onPress={handleAddLink}>
                  <Plus size={16} color="#FFF" />
                  <Text style={styles.pickerConfirmBtnText}>Vincular</Text>
                </Pressable>
              </View>
            ) : (
              /* Botão de ver referências vinculado fixo no rodapé */
              (blockLinks.length > 0 || incomingLinks.length > 0) && (
                <View
                  style={[
                    styles.fixedBottomBar,
                    {
                      backgroundColor: isDark ? '#1C1A19' : '#FFF',
                      borderTopColor: isDark ? '#2B2725' : '#E6DEC9',
                      paddingBottom: (insets.bottom || 0) + Spacing.three
                    }
                  ]}
                >
                  <Pressable
                    onPress={() => {
                      setDetailMode('references');
                      Vibration.vibrate(10);
                    }}
                    style={[styles.fixedBottomBtn, { backgroundColor: linkAccentColor }]}
                  >
                    <Link size={15} color="#FFF" strokeWidth={2.5} />
                    <Text style={styles.fixedBottomBtnText}>
                      Ver Referências ({blockLinks.length + incomingLinks.length})
                    </Text>
                  </Pressable>
                </View>
              )
            )}


            </View>

            {/* TABS ANOTAÇÃO e VINCULADOS */}
            {activeVerse && detailMode !== 'links' && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
            <View style={styles.studyWorkspace}>
              {/* TAB 1: ANOTAÇÃO */}
              {detailMode === 'note' && (
                <>
                  {/* Caixa de texto — azul individual, amarelo grupo */}
                  {(() => {
                    const isGroup = groupVerses && groupVerses.length > 1;
                    const existingGroupIds = isGroup ? getGroupIdsForVerses(groupVerses!) : [];
                    const isMerge = isGroup && existingGroupIds.length > 0;
                    const accentColor = showTypeFilter
                      ? (noteTypeFilter === 'group' || editingGroupNoteId !== null ? '#F59E0B' : colors.accent)
                      : ((isGroup || editingGroupNoteId !== null) ? '#F59E0B' : colors.accent);
                    const handleSave = () => {
                      if (!noteText.trim()) return;
                      if (editingGroupNoteId !== null) {
                        const currentGroup = noteGroups.find(g => g.id === editingGroupNoteId);
                        const existing = parseGroupNotes(currentGroup?.content ?? '');
                        let updated: string[];
                        if (editingGroupNoteIndex !== null && editingGroupNoteIndex < existing.length) {
                          updated = [...existing];
                          updated[editingGroupNoteIndex] = noteText.trim();
                        } else {
                          updated = [...existing, noteText.trim()];
                        }
                        updateNoteGroup(editingGroupNoteId, JSON.stringify(updated));
                        setEditingGroupNoteIndex(null);
                        dbModifiedRef.modified = true;
                        invalidateVersesCache();
                        setNoteGroups(getNoteGroupsByVerse(activeVerse!.book_id, activeVerse!.chapter, activeVerse!.verse));
                        setEditingGroupNoteId(null);
                        setNoteText('');
                        setNoteInputFocused(false);
                        noteInputRef.current?.blur();
                        setNoteTab('history');
                        Vibration.vibrate(20);
                      } else if (isGroup) {
                        const existingIds = getGroupIdsForVerses(groupVerses!);
                        if (existingIds.length > 1) {
                          // múltiplos grupos → mesclar, depois adicionar nota nova
                          const mergedId = mergeNoteGroups(existingIds, groupVerses!, '');
                          if (noteText.trim()) {
                            const mergedGroup = getNoteGroupsByVerse(activeVerse!.book_id, activeVerse!.chapter, activeVerse!.verse).find(g => g.id === mergedId);
                            const existing = parseGroupNotes(mergedGroup?.content ?? '');
                            if (existing.length >= 3) return;
                            updateNoteGroup(mergedId, JSON.stringify([...existing, noteText.trim()]));
                          }
                        } else if (existingIds.length === 1) {
                          // grupo já existe → adicionar nota ao array
                          const currentGroup = noteGroups.find(g => g.id === existingIds[0]);
                          const existing = parseGroupNotes(currentGroup?.content ?? '');
                          if (existing.length >= 3) return;
                          updateNoteGroup(existingIds[0], JSON.stringify([...existing, noteText.trim()]));
                        } else {
                          addNoteGroup(noteText.trim(), groupVerses!);
                        }
                        dbModifiedRef.modified = true;
                        invalidateVersesCache();
                        setNoteGroups(getNoteGroupsByVerse(activeVerse!.book_id, activeVerse!.chapter, activeVerse!.verse));
                        setChapterGroupCount(countNoteGroupsByChapter(activeVerse!.book_id, activeVerse!.chapter));
                        setNoteText('');
                        setNoteInputFocused(false);
                        noteInputRef.current?.blur();
                        setNoteTab('history');
                        Vibration.vibrate(20);
                      } else {
                        handleSaveNote();
                      }
                    };
                    return (
                      <View style={[styles.notepadCard, { backgroundColor: isDark ? '#1C1A19' : '#FDFBF7', borderColor: noteInputFocused || editingNoteId !== null || editingGroupNoteId !== null ? accentColor : (isDark ? '#2D2927' : '#E6DEC9'), borderLeftWidth: 4, borderLeftColor: accentColor, shadowColor: isDark ? '#000' : '#8A7A5F', marginBottom: Spacing.three }]}>
                        {(isGroup || editingGroupNoteId !== null) && (
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#F59E0B', marginBottom: 4 }}>
                            {isGroup ? `vers. ${buildRangesLabel(groupVerses!).replace('vers. ', '')}` : 'Grupo'}
                          </Text>
                        )}
                        <TextInput
                          ref={noteInputRef}
                          style={[styles.notepadInput, { color: colors.text, fontFamily: 'serif', fontSize: 16, lineHeight: 26 }]}
                          placeholder={isGroup ? `Anotação para vers. ${buildRangesLabel(groupVerses!).replace('vers. ', '')}...` : 'Escreva sua anotação...'}
                          placeholderTextColor={isDark ? '#6E6662' : '#A3998D'}
                          multiline
                          scrollEnabled={false}
                          value={noteText}
                          onChangeText={setNoteText}
                          underlineColorAndroid="transparent"
                          onFocus={() => setNoteInputFocused(true)}
                          onBlur={() => setNoteInputFocused(false)}
                        />
                        <View style={[styles.notebookFooterBar, { borderTopColor: isDark ? '#2D2927' : '#F2ECE0' }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.notebookWordCount, { color: isGroup || (showTypeFilter && noteTypeFilter === 'group') ? '#F59E0B' : colors.textMuted }]}>
                              {editingGroupNoteId !== null ? 'Editando grupo' : editingNoteId !== null ? 'Editando nota' : (isGroup || (showTypeFilter && noteTypeFilter === 'group')) ? `${activeGroupNoteCount}/3 notas` : `${noteHistory.length}/5 notas`}
                            </Text>
                            {editingGroupNoteId === null && editingNoteId === null && (
                              <Pressable onPress={() => setShowLimitInfo(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: isDark ? '#4B4745' : '#C9BFA8', alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 9, fontWeight: '700', color: isDark ? '#6E6662' : '#A3998D', lineHeight: 11 }}>?</Text>
                              </Pressable>
                            )}
                          </View>
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            {noteText.length > 0 && (
                              <Pressable
                                onPress={() => setNoteText('')}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                style={[styles.notepadSaveBtn, { backgroundColor: colors.error, width: 34, height: 34, paddingHorizontal: 0, paddingVertical: 0, borderRadius: 17 }]}
                              >
                                <X size={14} color="#FFF" />
                              </Pressable>
                            )}
                            <Pressable
                              style={[styles.notepadSaveBtn, { backgroundColor: noteText.trim() && !(isGroup && !isMerge && activeGroupNoteCount >= 3 && editingGroupNoteId === null) ? accentColor : colors.backgroundElement }]}
                              onPress={handleSave}
                              disabled={!noteText.trim() || (isGroup && !isMerge && activeGroupNoteCount >= 3 && editingGroupNoteId === null)}
                            >
                              {(editingNoteId !== null || editingGroupNoteId !== null)
                                ? <Check size={14} color={noteText.trim() ? '#FFF' : colors.textMuted} />
                                : <Plus size={14} color={noteText.trim() ? '#FFF' : colors.textMuted} />
                              }
                              <Text style={[styles.notepadSaveBtnText, { color: noteText.trim() ? '#FFF' : colors.textMuted }]}>Salvar</Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    );
                  })()}

                  {/* Barra de alternância: Versículo | Histórico */}
                  <View style={{ flexDirection: 'row', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderRadius: 12, padding: 4, marginBottom: showTypeFilter && noteTab === 'history' ? Spacing.two : Spacing.three, minHeight: 48 }}>
                    {(['verse', 'history'] as const).map(tab => {
                      const active = noteTab === tab;
                      const totalNotes = noteHistory.length + noteGroups.filter(g => parseGroupNotes(g.content ?? '').length > 0).length;
                      const label = tab === 'verse' ? 'Versículo' : `Histórico${totalNotes > 0 ? ` (${totalNotes})` : ''}`;
                      return (
                        <Pressable key={tab} onPress={() => setNoteTab(tab as any)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8, backgroundColor: active ? colors.accent : 'transparent' }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: active ? '#FFF' : colors.textSecondary }}>{label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Filtro de tipo: aparece só quando há notas individuais E de grupo */}
                  {showTypeFilter && noteTab === 'history' && (
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: Spacing.three }}>
                      {(['individual', 'group'] as const).map(type => {
                        const active = noteTypeFilter === type;
                        const count = type === 'individual' ? noteHistory.length : noteGroups.reduce((acc, g) => acc + parseGroupNotes(g.content ?? '').length, 0);
                        const label = type === 'individual' ? `Individual (${count})` : `Grupo (${count})`;
                        const activeColor = type === 'group' ? '#F59E0B' : colors.accent;
                        return (
                          <Pressable
                            key={type}
                            onPress={() => {
                              setNoteTypeFilter(type);
                              setNoteText('');
                              setEditingNoteId(null);
                              setEditingGroupNoteId(null);
                              setEditingGroupNoteIndex(null);
                              if (type === 'individual') {
                                setGroupVerses(null);
                              } else {
                                setGroupVerses(savedGroupVersesRef.current);
                              }
                              Vibration.vibrate(10);
                            }}
                            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: active ? activeColor : (isDark ? '#2D2927' : '#E6DEC9'), backgroundColor: active ? (type === 'group' ? 'rgba(245,158,11,0.1)' : colors.accentSubtle) : 'transparent' }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: '700', color: active ? activeColor : colors.textSecondary }}>{label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}

                  {/* PAINEL: VERSÍCULO */}
                  {noteTab === 'verse' && (() => {
                    const effectiveGroupVerses = groupVerses && groupVerses.length > 1
                      ? groupVerses
                      : (showTypeFilter && noteTypeFilter === 'group' && noteGroups[0]?.verses?.length ? noteGroups[0].verses : null);
                    const isGroupView = !!effectiveGroupVerses;
                    const verseLabel = `${activeStudyVerseRef.bookName} ${activeVerse.chapter}:${isGroupView ? buildRangesLabel(effectiveGroupVerses!).replace('vers. ', '') : activeVerse.verse}`;
                    const firstVerseText = getDisplayedScriptureText();
                    const truncated = firstVerseText.length > 80 ? firstVerseText.slice(0, 80) + '…' : firstVerseText;
                    return (
                      <View style={[styles.studyVerseCard, { backgroundColor: colors.card, borderColor: colors.backgroundElement }]}>
                        <View style={styles.verseTitleRow}>
                          <Text style={[styles.studyVerseHeader, { color: colors.text, fontFamily: 'serif' }]}>{verseLabel}</Text>
                        </View>
                        <View style={[styles.translationSelectorBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                          {(['ARA', 'ARC', 'KJV', 'DBY'] as const).map(tr => {
                            const active = selectedTranslation === tr;
                            return (
                              <Pressable key={`tr_pill_${tr}`} style={[styles.translationPill, active && [styles.translationPillActive, { backgroundColor: isGroupView ? '#F59E0B' : colors.accent }]]} onPress={() => { setSelectedTranslation(tr); Vibration.vibrate(12); }}>
                                <Text style={[styles.translationPillText, active ? { color: '#FFF', fontWeight: 'bold' } : { color: colors.textSecondary }]}>{tr}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                        <View style={[styles.quoteLineIndicator, { backgroundColor: isGroupView ? '#F59E0B' : colors.accent }]} />
                        {isGroupView ? (
                          <Pressable onPress={() => setShowGroupVersesModal(true)} style={{ gap: 4 }}>
                            <Text style={[styles.studyVerseText, { color: colors.text }]}>"{truncated}"</Text>
                            <Text style={{ fontSize: 12, color: '#F59E0B', fontWeight: '600', marginTop: 2 }}>Ver todos os versículos →</Text>
                          </Pressable>
                        ) : (
                          <Text style={[styles.studyVerseText, { color: colors.text }]}>"{firstVerseText}"</Text>
                        )}
                        <View style={[styles.cardCaptionRow, { borderTopColor: colors.backgroundElement }]}>
                          <ArrowLeftRight size={12} color={colors.textMuted} />
                          <Text style={[styles.cardCaptionText, { color: colors.textMuted }]}>Toque nas abas no canto superior direito para alternar a tradução ativa.</Text>
                        </View>
                      </View>
                    );
                  })()}

                  {/* PAINEL: HISTÓRICO */}
                  {noteTab === 'history' && (
                    noteHistory.length === 0 && !noteGroups.some(g => parseGroupNotes(g.content ?? '').length > 0) ? (
                      <View style={{ gap: Spacing.three }}>
                        <View style={[styles.emptyCorrelations, { borderColor: isDark ? '#2D2927' : '#E6DEC9', backgroundColor: isDark ? '#1C1A19' : '#FDFBF7' }]}>
                          <MessageSquare size={28} color={colors.textSecondary} style={{ marginBottom: 8, opacity: 0.6 }} />
                          <Text style={[styles.emptyCorrelationsText, { color: colors.textSecondary }]}>Nenhuma anotação salva ainda.</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={{ gap: Spacing.three }}>
                        {(!showTypeFilter || noteTypeFilter === 'individual') && noteHistory.map((note) => {
                          const isEditing = editingNoteId === note.id;
                          const isHighlighted = highlightedNoteId === note.id;
                          return (
                            <View key={note.id} style={[styles.notepadCard, { backgroundColor: isDark ? '#161413' : '#FFF', borderColor: isEditing ? colors.accent : isHighlighted ? colors.accent : (isDark ? '#2D2927' : '#EBE6DA'), borderWidth: isHighlighted ? 2 : 1, borderLeftWidth: 3, borderLeftColor: colors.accent, padding: Spacing.three }]}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.two }}>
                                <Calendar size={12} color={colors.textMuted} />
                                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted }}>{formatNoteDate(parseSqliteDate(note.updated_at))}</Text>
                              </View>
                              <Text style={{ color: colors.text, fontFamily: 'serif', fontSize: 15, lineHeight: 24, marginBottom: Spacing.three, opacity: isEditing ? 0.45 : 1 }}>{note.content}</Text>
                              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                                {isEditing ? (
                                  <Pressable onPress={() => { setEditingNoteId(null); setNoteText(''); Vibration.vibrate(10); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: isDark ? 'rgba(156,163,175,0.25)' : 'rgba(75,85,99,0.2)', backgroundColor: isDark ? 'rgba(156,163,175,0.06)' : 'rgba(75,85,99,0.04)' }}>
                                    <X size={11} color={colors.textSecondary} strokeWidth={2} />
                                    <Text style={{ fontSize: 11.5, color: colors.textSecondary, fontWeight: '600' }}>Cancelar</Text>
                                  </Pressable>
                                ) : (
                                  <Pressable onPress={() => { setEditingNoteId(note.id); setNoteText(note.content); setHighlightedNoteId(null); Vibration.vibrate(10); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: isDark ? 'rgba(59,130,246,0.25)' : 'rgba(30,64,175,0.2)', backgroundColor: isDark ? 'rgba(59,130,246,0.04)' : 'rgba(30,64,175,0.02)' }}>
                                    <Edit2 size={11} color={colors.accent} strokeWidth={2} />
                                    <Text style={{ fontSize: 11.5, color: colors.accent, fontWeight: '600' }}>Editar</Text>
                                  </Pressable>
                                )}
                                <Pressable onPress={() => handleDeleteNote(note.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: isDark ? 'rgba(239,68,68,0.25)' : 'rgba(185,28,28,0.2)', backgroundColor: isDark ? 'rgba(239,68,68,0.04)' : 'rgba(185,28,28,0.02)' }}>
                                  <Trash2 size={11} color={colors.error} strokeWidth={2} />
                                  <Text style={{ fontSize: 11.5, color: colors.error, fontWeight: '600' }}>Apagar</Text>
                                </Pressable>
                              </View>
                            </View>
                          );
                        })}
                        {(!showTypeFilter || noteTypeFilter === 'group') && hasGroupNotes && (
                          <>
                            {!showTypeFilter && noteHistory.length > 0 && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.one }}>
                                <View style={{ height: 1, flex: 1, backgroundColor: isDark ? '#2D2927' : '#E6DEC9' }} />
                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#F59E0B', letterSpacing: 0.5 }}>GRUPO</Text>
                                <View style={{ height: 1, flex: 1, backgroundColor: isDark ? '#2D2927' : '#E6DEC9' }} />
                              </View>
                            )}
                            {noteGroups.map(g => {
                              const rangeLabel = buildRangesLabel(g.verses ?? []);
                              const isEditing = editingGroupNoteId === g.id;
                              const isHighlighted = highlightedGroupId === g.id;
                              const groupNotes = parseGroupNotes(g.content ?? '');
                              const hasNotes = groupNotes.length > 0;
                              if (!hasNotes) return null;
                              return (
                                <View key={g.id} style={{ gap: Spacing.two }}>
                                  <Text style={{ fontSize: 11, color: '#F59E0B', fontWeight: '700' }}>{rangeLabel}</Text>
                                  {groupNotes.map((note, idx) => {
                                    const isNoteHighlighted = isHighlighted && (highlightedGroupNoteIndex === null || highlightedGroupNoteIndex === idx);
                                    return (<View key={idx} style={[styles.notepadCard, { backgroundColor: isDark ? '#161413' : '#FFF', borderColor: isNoteHighlighted ? '#F59E0B' : (isDark ? '#2D2927' : '#EBE6DA'), borderWidth: isNoteHighlighted ? 2 : 1, borderLeftWidth: 3, borderLeftColor: '#F59E0B', padding: Spacing.three }]}>
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.two }}>
                                        <Calendar size={12} color={colors.textMuted} />
                                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted }}>{formatNoteDate(parseSqliteDate(g.updated_at ?? g.created_at))}</Text>
                                      </View>
                                      <Text style={{ color: colors.text, fontFamily: 'serif', fontSize: 15, lineHeight: 24, marginBottom: Spacing.two, opacity: isEditing ? 0.45 : 1 }}>{note}</Text>
                                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                                        {isEditing ? (
                                          <Pressable onPress={() => { setEditingGroupNoteId(null); setEditingGroupNoteIndex(null); setNoteText(''); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: isDark ? 'rgba(156,163,175,0.25)' : 'rgba(75,85,99,0.2)' }}>
                                            <X size={11} color={colors.textSecondary} />
                                            <Text style={{ fontSize: 11.5, color: colors.textSecondary, fontWeight: '600' }}>Cancelar</Text>
                                          </Pressable>
                                        ) : (
                                          <Pressable onPress={() => { setEditingGroupNoteId(g.id); setEditingGroupNoteIndex(groupNotes.length === 1 ? 0 : idx); setNoteText(note); setHighlightedGroupId(null); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' }}>
                                            <Edit2 size={11} color="#F59E0B" />
                                            <Text style={{ fontSize: 11.5, color: '#F59E0B', fontWeight: '600' }}>Editar</Text>
                                          </Pressable>
                                        )}
                                        <Pressable onPress={() => {
                                          if (groupNotes.length === 1) {
                                            deleteNoteGroup(g.id);
                                          } else {
                                            const updated = groupNotes.filter((_, i) => i !== idx);
                                            updateNoteGroup(g.id, JSON.stringify(updated));
                                          }
                                          dbModifiedRef.modified = true; invalidateVersesCache();
                                          setNoteGroups(getNoteGroupsByVerse(activeVerse!.book_id, activeVerse!.chapter, activeVerse!.verse));
                                          setChapterGroupCount(countNoteGroupsByChapter(activeVerse!.book_id, activeVerse!.chapter));
                                        }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: isDark ? 'rgba(239,68,68,0.25)' : 'rgba(185,28,28,0.2)' }}>
                                          <Trash2 size={11} color={colors.error} />
                                          <Text style={{ fontSize: 11.5, color: colors.error, fontWeight: '600' }}>Apagar</Text>
                                        </Pressable>
                                      </View>
                                    </View>
                                  );})}

                                </View>
                              );
                            })}
                          </>
                        )}
                      </View>
                    )
                  )}

                </>
              )}

              {/* TAB 3: REFERÊNCIAS */}
              {detailMode === 'references' && (() => {
                const hasIndLinks = [...blockLinks, ...incomingLinks].some(l => l.src_verses.length === 1);
                const hasGrpLinks = [...blockLinks, ...incomingLinks].some(l => l.src_verses.length > 1);
                const showLinkFilter = hasIndLinks && hasGrpLinks;
                const filteredOutLinks = showLinkFilter
                  ? blockLinks.filter(l => linkTypeFilter === 'individual' ? l.src_verses.length === 1 : l.src_verses.length > 1)
                  : blockLinks;
                const filteredInLinks = showLinkFilter
                  ? incomingLinks.filter(l => linkTypeFilter === 'individual' ? l.src_verses.length === 1 : l.src_verses.length > 1)
                  : incomingLinks;
                return (
                <View style={{ gap: Spacing.four }}>

                  {showLinkFilter && (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {(['individual', 'group'] as const).map(type => {
                        const active = linkTypeFilter === type;
                        const activeColor = type === 'group' ? '#F59E0B' : colors.accent;
                        const label = type === 'individual' ? 'Individual' : 'Grupo';
                        return (
                          <Pressable key={type} onPress={() => { setLinkTypeFilter(type); Vibration.vibrate(10); }}
                            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: active ? activeColor : (isDark ? '#2D2927' : '#E6DEC9'), backgroundColor: active ? (type === 'group' ? 'rgba(245,158,11,0.1)' : colors.accentSubtle) : 'transparent' }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: active ? activeColor : colors.textSecondary }}>{label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}

                  {/* Outgoing links (Vínculos) */}
                  {filteredOutLinks.length === 0 && filteredInLinks.length === 0 ? (
                    <View style={[styles.emptyCorrelations, { borderColor: isDark ? '#2D2927' : '#E6DEC9', backgroundColor: isDark ? '#1C1A19' : '#FDFBF7' }]}>
                      <Link size={32} color={colors.textMuted} style={{ marginBottom: 12, opacity: 0.5 }} />
                      <Text style={[styles.emptyCorrelationsText, { color: colors.textSecondary }]}>
                        Nenhum vínculo adicionado ainda.
                      </Text>
                      <Pressable
                        style={[styles.notepadSaveBtn, { backgroundColor: colors.accent, marginTop: 16 }]}
                        onPress={() => { setDetailMode('links'); resetPickerForMode(); Vibration.vibrate(10); }}
                      >
                        <Plus size={14} color="#FFF" />
                        <Text style={styles.notepadSaveBtnText}>Adicionar Vínculo</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <>
                    {filteredOutLinks.length > 0 && (
                    <View style={{ gap: Spacing.three }}>
                      {filteredOutLinks.map((link) => {
                        const tgtRange = link.tgt_verses.length === 1
                          ? String(link.tgt_verses[0])
                          : `${Math.min(...link.tgt_verses)}-${Math.max(...link.tgt_verses)}`;
                        const isGroupLink2 = link.src_verses.length > 1;
                        const borderColor = isGroupLink2 ? '#F59E0B' : colors.accent;
                        return (
                          <View key={link.id}>
                            {isGroupLink2 && (
                              <Text style={{ fontSize: 11, color: '#F59E0B', fontWeight: '700', marginBottom: 4 }}>
                                {`Vers. ${Math.min(...link.src_verses)}-${Math.max(...link.src_verses)}`}
                              </Text>
                            )}
                            <View style={[styles.correlationRow, { backgroundColor: isDark ? '#1C1A19' : '#FDFBF7', borderColor, borderLeftWidth: 3, paddingRight: 48 }]}>
                              <Pressable style={{ flex: 1 }} onPress={() => handleGoToVerse(link.tgt_book_id, link.tgt_chapter, link.tgt_verses[0])}>
                                <Text style={[styles.badgeRefText, { color: borderColor }]}>
                                  {link.tgt_book_name} {link.tgt_chapter}:{tgtRange}
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={() => handleRemoveBlockLink(link.id)}
                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                style={[styles.badgeRemoveBtn, { backgroundColor: isDark ? '#2A1A1A' : '#FFF0F0', borderRadius: 8, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', top: undefined, right: 12, position: 'absolute' }]}
                              >
                                <X size={15} color={colors.error} />
                              </Pressable>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* Divider + Incoming links */}
                  {filteredInLinks.length > 0 && (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.three }}>
                        <View style={{ height: 1, flex: 1, backgroundColor: isDark ? '#2D2927' : '#E6DEC9' }} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 }}>REFERENCIADO POR</Text>
                        <View style={{ height: 1, flex: 1, backgroundColor: isDark ? '#2D2927' : '#E6DEC9' }} />
                      </View>
                      <View style={{ gap: Spacing.three }}>
                        {filteredInLinks.map((link) => {
                          const srcRange = link.src_verses.length === 1
                            ? String(link.src_verses[0])
                            : `${Math.min(...link.src_verses)}-${Math.max(...link.src_verses)}`;
                          const isGroupSrc = link.src_verses.length > 1;
                          const borderColor = isGroupSrc ? '#F59E0B' : colors.accent;
                          return (
                            <View key={`incoming_${link.id}`} style={[styles.correlationRow, { backgroundColor: isDark ? '#1C1A19' : '#FDFBF7', borderColor, borderLeftWidth: 3, opacity: 0.85, paddingRight: 12 }]}>
                              <Pressable style={{ flex: 1 }} onPress={() => handleGoToVerse(link.src_book_id, link.src_chapter, link.src_verses[0])}>
                                <Text style={[styles.badgeRefText, { color: borderColor }]}>
                                  {(link as any).src_book_name ?? 'Livro'} {link.src_chapter}:{srcRange}
                                </Text>
                                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>→ referencia este versículo</Text>
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>
                    </>
                  )}
                    </>
                  )}

                </View>
                );
              })()}

            </View>
            <View style={{ height: 32 }} />
              </ScrollView>
            )}

            {/* Welcome screen — visível quando não há versículo selecionado */}
            {!activeVerse && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
                <View style={styles.welcomeContainer}>
                  <View style={[styles.welcomeIconCircle, { backgroundColor: colors.accentSubtle }]}>
                    <BookOpen size={36} color={colors.accent} />
                  </View>
                  <Text style={[styles.welcomeTitle, { color: colors.text, fontFamily: 'serif' }]}>
                    Nenhum versículo selecionado
                  </Text>
                  <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
                    Selecione um versículo na aba Leitura e clique no botão de Anotação/Estudo para iniciar suas investigações teológicas!
                  </Text>
                  <Pressable
                    style={[styles.welcomeButton, { backgroundColor: colors.accent }]}
                    onPress={() => router.navigate('/')}
                  >
                    <Text style={styles.welcomeButtonText}>Ir para a Leitura</Text>
                  </Pressable>
                </View>
              </ScrollView>
            )}
      </KeyboardAvoidingView>

      {/* Modal de versículos do grupo */}
      <Modal visible={showGroupVersesModal} transparent animationType="slide" onRequestClose={() => setShowGroupVersesModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }} onPress={() => setShowGroupVersesModal(false)}>
          <Pressable style={{ backgroundColor: isDark ? '#1C1A19' : '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1.5, borderBottomWidth: 0, borderColor: isDark ? '#2D2927' : '#EAE2D5', padding: 20, maxHeight: '80%' }} onPress={e => e.stopPropagation()}>
            {(() => {
              const effectiveGroupVerses = groupVerses && groupVerses.length > 1
                ? groupVerses
                : (noteGroups[0]?.verses ?? []);
              const versionKey = `text_${selectedTranslation.toLowerCase()}` as any;
              return (
                <>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', fontFamily: 'serif' }}>
                      {activeStudyVerseRef.bookName} {activeVerse?.chapter}:{buildRangesLabel(effectiveGroupVerses).replace('vers. ', '')}
                    </Text>
                    <Pressable onPress={() => setShowGroupVersesModal(false)} hitSlop={8}>
                      <X size={20} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                  {/* Seletor de tradução */}
                  <View style={[styles.translationSelectorBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', marginBottom: 16 }]}>
                    {(['ARA', 'ARC', 'KJV', 'DBY'] as const).map(tr => {
                      const active = selectedTranslation === tr;
                      return (
                        <Pressable key={tr} style={[styles.translationPill, active && [styles.translationPillActive, { backgroundColor: '#F59E0B' }]]} onPress={() => { setSelectedTranslation(tr); Vibration.vibrate(12); }}>
                          <Text style={[styles.translationPillText, active ? { color: '#FFF', fontWeight: 'bold' } : { color: colors.textSecondary }]}>{tr}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
                    <View style={{ gap: 12, paddingBottom: 20 }}>
                      {effectiveGroupVerses.map(gv => {
                        const v = getVerse(gv.book_id, gv.chapter, gv.verse);
                        if (!v) return null;
                        const text = (v as any)[versionKey] ?? v.text_ara;
                        return (
                          <View key={gv.verse} style={{ flexDirection: 'row', gap: 10 }}>
                            <View style={{ width: 3, borderRadius: 2, backgroundColor: '#F59E0B', marginTop: 4 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#F59E0B', marginBottom: 4 }}>{gv.verse}</Text>
                              <Text style={{ color: colors.text, fontSize: 15, lineHeight: 24, fontFamily: 'serif' }}>{text}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de info sobre limites */}
      <Modal visible={showLimitInfo} transparent animationType="fade" onRequestClose={() => setShowLimitInfo(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 }} onPress={() => setShowLimitInfo(false)}>
          <Pressable style={{ width: '100%', maxWidth: 320, backgroundColor: isDark ? '#1C1A19' : '#FFF', borderRadius: 16, borderWidth: 1.5, borderColor: isDark ? '#2D2927' : '#EAE2D5', padding: 24 }} onPress={e => e.stopPropagation()}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 16 }}>Limite de anotações</Text>
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <View style={{ width: 3, borderRadius: 2, backgroundColor: colors.accent, marginTop: 4, alignSelf: 'stretch' }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: 2 }}>Notas individuais</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20 }}>Máximo de 5 notas por versículo.</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <View style={{ width: 3, borderRadius: 2, backgroundColor: '#F59E0B', marginTop: 4, alignSelf: 'stretch' }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: 2 }}>Notas de grupo</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20 }}>Máximo de 3 notas por grupo.</Text>
                </View>
              </View>
            </View>
            <Pressable onPress={() => setShowLimitInfo(false)} style={{ marginTop: 20, paddingVertical: 11, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center' }}>
              <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>Entendi</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Confirmation Modal for Deletion */}
      <Modal
        visible={noteToDelete !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setNoteToDelete(null)}
      >
        <Pressable 
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onPress={() => setNoteToDelete(null)}
        >
          <Pressable
            style={{
              width: '100%',
              maxWidth: 320,
              backgroundColor: isDark ? '#1C1A19' : '#FFF',
              borderRadius: 16,
              borderWidth: 1.5,
              borderColor: isDark ? '#2D2927' : '#EAE2D5',
              padding: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.25,
              shadowRadius: 12,
              elevation: 10,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View 
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(185, 28, 28, 0.08)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}
              >
                <Trash2 size={22} color={colors.error} />
              </View>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
                Apagar anotação?
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 18 }}>
                Esta ação não pode ser desfeita. Você tem certeza que deseja excluir esta anotação?
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setNoteToDelete(null)}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: isDark ? '#2D2927' : '#EAE2D5',
                    alignItems: 'center',
                    backgroundColor: pressed ? (isDark ? '#242120' : '#F7F5F0') : 'transparent',
                  }
                ]}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={confirmDeleteNote}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 10,
                    backgroundColor: colors.error,
                    alignItems: 'center',
                    opacity: pressed ? 0.85 : 1,
                  }
                ]}
              >
                <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>Apagar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  backIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topHeaderTitle: {
    fontSize: 16.5,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  tabSelectorWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    paddingBottom: 4,
    paddingHorizontal: Spacing.four,
  },
  tabSelectorCapsule: {
    flexDirection: 'row',
    width: '100%',
    height: 48,
    borderRadius: 12,
    padding: 4,
  },
  tabPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    gap: 5,
  },
  tabPillActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContainer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  /* Welcome study screen */
  welcomeContainer: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.four,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  welcomeSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.six,
  },
  welcomeButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.six,
    borderRadius: 30,
  },
  welcomeButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  /* Study Workspace */
  studyWorkspace: {
    gap: Spacing.two,
  },
  studyVerseCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: Spacing.four,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: Spacing.two,
  },
  verseTitleRow: {
    marginBottom: Spacing.two,
  },
  studyVerseHeader: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  translationSelectorBar: {
    flexDirection: 'row',
    width: '100%',
    height: 42,
    borderRadius: 21,
    padding: 3,
    marginBottom: Spacing.four,
  },
  translationPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  translationPillActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  translationPillText: {
    fontSize: 12.5,
    fontWeight: 'bold',
  },
  quoteLineIndicator: {
    width: 32,
    height: 3.5,
    borderRadius: 2,
    marginBottom: Spacing.three,
  },
  studyVerseText: {
    fontSize: 16,
    lineHeight: 26,
    fontFamily: 'serif',
    fontStyle: 'italic',
  },
  cardCaptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
  },
  cardCaptionText: {
    fontSize: 11,
    lineHeight: 16,
  },
  /* Notepad / Parchment Card */
  notepadCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: Spacing.four,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  notepadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  notepadIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notepadTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 'auto',
  },
  savedBadgeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: 'bold',
  },
  notepadInput: {
    fontSize: 16,
    lineHeight: 26,
    minHeight: 60,
    textAlignVertical: 'top',
    paddingVertical: Spacing.two,
  },
  notebookFooterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1.5,
    paddingTop: Spacing.three,
    marginTop: Spacing.two,
  },
  notebookWordCount: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  notepadSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 20,
    gap: Spacing.two,
  },
  notepadSaveBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  /* Embedded picker card styling */
  embeddedPickerWrapper: {
    paddingVertical: 0,
  },
  searchAndFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  compactSearchBox: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: Spacing.two,
    height: 46,
    gap: Spacing.one,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 4,
  },
  compactTestamentSelector: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    height: 46,
  },
  compactTestamentBtn: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTestamentBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  pickerStepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: Spacing.two,
    marginBottom: Spacing.three,
    gap: Spacing.one,
  },
  pickerStepTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  pickerStepTabActive: {},
  pickerStepTabText: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  pickerPanelBody: {
    justifyContent: 'flex-start',
  },
  testamentHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.four,
    marginBottom: Spacing.three,
  },
  testamentIndicatorBar: {
    width: 4.5,
    height: 15.5,
    borderRadius: 2,
  },
  testamentHeaderLabel: {
    fontSize: 13.5,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  bookRowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  bookRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  bookAbbrevBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 38,
    alignItems: 'center',
  },
  bookAbbrevText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  bookRowText: {
    fontSize: 15.5,
    fontWeight: '500',
  },
  originBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  originBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  /* PERFECT SYMMETRIC GRID */
  perfectSymmetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 12,
    paddingVertical: Spacing.two,
  },
  perfectCircleBtn: {
    width: '17.5%',
    aspectRatio: 1,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  circleText: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  horizontalPillsContainer: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    gap: 10,
  },
  horizontalCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  horizontalCircleText: {
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  numberWrapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: Spacing.two,
    justifyContent: 'center',
  },
  numberCircleBtn: {
    minWidth: 48,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  numberCircleText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  pickerConfirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
    marginTop: Spacing.two,
    borderTopWidth: 1.5,
    gap: Spacing.two,
  },
  pickerConfirmSummary: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pickerConfirmRef: {
    fontSize: 14,
    marginTop: 2,
  },
  pickerConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: 10,
  },
  pickerConfirmBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  /* Correlations Grid */
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyCorrelations: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: Spacing.four,
    alignItems: 'center',
  },
  emptyCorrelationsText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  correlationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    justifyContent: 'flex-start',
  },
  correlationBadge: {
    width: '47.5%',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: Spacing.three,
    position: 'relative',
    minHeight: 90,
  },
  correlationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: Spacing.three,
    position: 'relative',
  },
  badgeRefText: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: Spacing.one,
    paddingRight: Spacing.four,
  },
  badgeExcerpt: {
    fontSize: 11,
    lineHeight: 16,
  },
  badgeRemoveBtn: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    padding: 2,
  },
  pickerBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.two,
    borderBottomWidth: 1,
  },
  pickerBackLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  pickerConfirmBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderTopWidth: 1,
  },
  fixedBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
  },
  fixedBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
  },
  fixedBottomBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContentCard: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.four,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: Spacing.two,
  },
  modalIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitleText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalSubtitleText: {
    fontSize: 12,
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    gap: Spacing.two,
  },
  linkedRemoveBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
