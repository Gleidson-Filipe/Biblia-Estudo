import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  Pressable,
  ScrollView,
  SectionList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Vibration,
  Animated,
  Modal,
  BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BookOpen, MessageSquare, Plus, Save, Check, X, Link, ChevronRight, ArrowLeftRight, Search, ArrowLeft, Calendar, Edit2, Trash2 } from 'lucide-react-native';
import { Colors, Spacing } from '@/constants/theme';
import {
  getCorrelations,
  removeCorrelation,
  addNote,
  updateNote,
  deleteNote,
  getNotesByVerse,
  getBooks,
  getChaptersCount,
  getVersesCount,
  addCorrelation,
  invalidateVersesCache,
  getVerse,
  Book,
  Verse,
  Note,
} from '@/database/queries';
import { activeStudyVerseRef, dbModifiedRef } from '@/components/verse-context-ref';


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

  // Cores suaves para o item "Atual" (livro, capítulo e versículo sob estudo) - Laranja Puro e Vibrante
  const atualColor = isDark ? '#F97316' : '#EA580C';
  const atualBg = isDark ? 'rgba(249, 115, 22, 0.08)' : 'rgba(234, 88, 12, 0.05)';
  const atualBorder = isDark ? '#C2410C' : '#FDBA74';

  // Active study verse context
  const [activeVerse, setActiveVerse] = useState<Verse | null>(activeStudyVerseRef.current);
  const [activeVerseCorrelations, setActiveVerseCorrelations] = useState<Verse[]>([]);
  const [noteText, setNoteText] = useState('');
  const [noteHistory, setNoteHistory] = useState<Note[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<number | null>(null);
  const pendingEditRef = useRef<{ id: number; text: string } | null>(null);

  // Tab State
  const [detailMode, setDetailMode] = useState<'note' | 'links' | 'references'>('note');
  const [noteTab, setNoteTab] = useState<'verse' | 'history'>('verse');

  // Selected translation to display in the main card (ARA, ARC, KJV, DBY)
  const [selectedTranslation, setSelectedTranslation] = useState<'ARA' | 'ARC' | 'KJV' | 'DBY'>('ARA');

  // EMBEDDED TEOLOGICAL LINK PICKER STATE
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [pickerStep, setPickerStep] = useState<'book' | 'chapter' | 'verse'>('book');
  const [selectedLinkBook, setSelectedLinkBook] = useState<Book | null>(null);
  const [selectedLinkChapter, setSelectedLinkChapter] = useState<number | null>(null);
  const [selectedLinkVerse, setSelectedLinkVerse] = useState<number | null>(null);

  // Lists for picking
  const [chaptersList, setChaptersList] = useState<number[]>([]);
  const [versesList, setVersesList] = useState<number[]>([]);

  // Filter books by Testament or Search
  const [testamentFilter, setTestamentFilter] = useState<'all' | 'old' | 'new'>('all');
  const [referencesTestamentFilter, setReferencesTestamentFilter] = useState<'all' | 'old' | 'new'>('all');
  const [bookSearchQuery, setBookSearchQuery] = useState('');

  // Subscribe to changes in active study verse
  useEffect(() => {
    if (activeStudyVerseRef.current) {
      setActiveVerse(activeStudyVerseRef.current);
      setDetailMode(activeStudyVerseRef.mode);
      if (activeStudyVerseRef.editNoteId !== null) {
        pendingEditRef.current = { id: activeStudyVerseRef.editNoteId, text: activeStudyVerseRef.editNoteText };
        activeStudyVerseRef.editNoteId = null;
        activeStudyVerseRef.editNoteText = '';
      }
    }

    const unsubscribe = activeStudyVerseRef.subscribe(() => {
      const current = activeStudyVerseRef.current;
      setActiveVerse(current);
      setDetailMode(activeStudyVerseRef.mode);
      if (activeStudyVerseRef.editNoteId !== null) {
        pendingEditRef.current = { id: activeStudyVerseRef.editNoteId, text: activeStudyVerseRef.editNoteText };
        activeStudyVerseRef.editNoteId = null;
        activeStudyVerseRef.editNoteText = '';
      }
    });

    // Load books
    setAllBooks(getBooks());

    return unsubscribe;
  }, []);

  // Sync active verse content (correlations, note content) when activeVerse updates
  useEffect(() => {
    if (activeVerse) {
      try {
        // Fetch full verse with all translations if any version is missing
        if (!activeVerse.text_arc || !activeVerse.text_kjv) {
          const full = getVerse(activeVerse.book_id, activeVerse.chapter, activeVerse.verse);
          if (full) { setActiveVerse(full); return; }
        }

        const linked = getCorrelations(activeVerse.book_id, activeVerse.chapter, activeVerse.verse);
        setActiveVerseCorrelations(linked);

        setNoteHistory(getNotesByVerse(activeVerse.book_id, activeVerse.chapter, activeVerse.verse));
        if (pendingEditRef.current) {
          const { id, text } = pendingEditRef.current;
          pendingEditRef.current = null;
          setNoteText(text);
          setEditingNoteId(id);
          setNoteTab('history');
        } else {
          setNoteText('');
          setNoteTab('verse');
          setEditingNoteId(null);
        }

        // Pre-load chapters for the active verse's book but always start on book step
        const matchedBook = getBooks().find(b => b.id === activeVerse.book_id);
        if (matchedBook) {
          setSelectedLinkBook(matchedBook);
          setPickerStep('book');

          const chaptersCount = getChaptersCount(matchedBook.id);
          const chapters = Array.from({ length: chaptersCount }, (_, i) => i + 1);
          setChaptersList(chapters);
        }
      } catch (e) {
        console.warn('[study] useEffect error:', e);
      }
    }
  }, [activeVerse]);

  // Interceptar o botão/gesto físico de voltar do Android
  useEffect(() => {
    const handleBackButton = () => {
      if (detailMode === 'references') {
        setDetailMode('links');
        Vibration.vibrate(10);
        return true;
      }
      // Se estivermos na aba "Vincular" e não estivermos no passo inicial (book)
      if (detailMode === 'links' && pickerStep !== 'book') {
        if (pickerStep === 'verse') {
          setPickerStep('chapter');
          setSelectedLinkVerse(null);
        } else {
          setPickerStep('book');
          setSelectedLinkChapter(null);
          setSelectedLinkVerse(null);
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
  const handleSelectBook = (book: Book) => {
    setSelectedLinkBook(book);
    setSelectedLinkChapter(null);
    setSelectedLinkVerse(null);
    
    const chaptersCount = getChaptersCount(book.id);
    const chapters = Array.from({ length: chaptersCount }, (_, i) => i + 1);
    setChaptersList(chapters);
    
    setPickerStep('chapter');
    Vibration.vibrate(15);
  };

  // Handle Chapter Selection in picker
  const handleSelectChapter = (chapterNum: number) => {
    if (!selectedLinkBook) return;
    setSelectedLinkChapter(chapterNum);
    setSelectedLinkVerse(null);

    const versesCount = getVersesCount(selectedLinkBook.id, chapterNum);
    const verses = Array.from({ length: versesCount }, (_, i) => i + 1);
    setVersesList(verses);

    setPickerStep('verse');
    Vibration.vibrate(15);
  };

  // Handle Verse Selection in picker
  const handleSelectVerse = (verseNum: number) => {
    setSelectedLinkVerse(verseNum);
    Vibration.vibrate(15);
  };

  // Confirm Link Addition
  const handleAddLink = () => {
    if (!activeVerse || !selectedLinkBook || !selectedLinkChapter || !selectedLinkVerse) return;
    
    // Prevent self linkage redundance
    if (
      selectedLinkBook.id === activeVerse.book_id &&
      selectedLinkChapter === activeVerse.chapter &&
      selectedLinkVerse === activeVerse.verse
    ) {
      return;
    }

    addCorrelation(
      activeVerse.book_id,
      activeVerse.chapter,
      activeVerse.verse,
      selectedLinkBook.id,
      selectedLinkChapter,
      selectedLinkVerse
    );

    Vibration.vibrate(30);
    dbModifiedRef.modified = true;
    invalidateVersesCache();

    const updated = getCorrelations(activeVerse.book_id, activeVerse.chapter, activeVerse.verse);
    setActiveVerseCorrelations(updated);

    // Reset picker step to verse or chapter for easy sequence additions
    setSelectedLinkVerse(null);
  };

  const refreshNotes = () => {
    if (!activeVerse) return;
    setNoteHistory(getNotesByVerse(activeVerse.book_id, activeVerse.chapter, activeVerse.verse));
    dbModifiedRef.modified = true;
    invalidateVersesCache();
  };

  const handleSaveNote = () => {
    if (!activeVerse || !noteText.trim()) return;
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

  const handleRemoveActiveCorrelation = (linked: Verse) => {
    if (!activeVerse) return;
    removeCorrelation(
      activeVerse.book_id,
      activeVerse.chapter,
      activeVerse.verse,
      linked.book_id,
      linked.chapter,
      linked.verse
    );
    dbModifiedRef.modified = true;
    invalidateVersesCache();
    const updated = getCorrelations(activeVerse.book_id, activeVerse.chapter, activeVerse.verse);
    setActiveVerseCorrelations(updated);
    Vibration.vibrate(15);
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

  const filteredBooks = allBooks.filter(b => {
    const matchesSearch = b.name_pt.toLowerCase().includes(bookSearchQuery.toLowerCase()) || 
                          b.abbrev.toLowerCase().includes(bookSearchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (testamentFilter === 'old') return b.testament === 'old';
    if (testamentFilter === 'new') return b.testament === 'new';
    return true;
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Sleek Minimalist Top Navigation Header */}
      <View style={styles.topBackHeader}>
        <Pressable
          style={[styles.backIconCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
          onPress={() => {
            Vibration.vibrate(10);
            if (detailMode === 'references') {
              setDetailMode('links');
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
        {!activeVerse ? (
          /* Welcome screen */
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
        ) : detailMode === 'links' ? (
          /* TAB VINCULAR: flex layout sem ScrollView externo */
          <View style={{ flex: 1, paddingTop: Spacing.two, position: 'relative' }}>
            {/* Back button when not on book step */}
            {pickerStep !== 'book' && (
              <Pressable
                style={[styles.pickerBackRow, { borderBottomColor: isDark ? '#2B2725' : '#F0EAD9', marginHorizontal: Spacing.four }]}
                onPress={() => {
                  if (pickerStep === 'verse') {
                    setPickerStep('chapter');
                    setSelectedLinkVerse(null);
                  } else {
                    setPickerStep('book');
                    setSelectedLinkChapter(null);
                    setSelectedLinkVerse(null);
                  }
                  Vibration.vibrate(10);
                }}
              >
                <ArrowLeft size={15} color={colors.accent} />
                <Text style={[styles.pickerBackLabel, { color: colors.accent }]}>
                  {pickerStep === 'verse'
                    ? (selectedLinkVerse !== null
                        ? `${selectedLinkBook?.name_pt} — Cap. ${selectedLinkChapter} — vers. ${selectedLinkVerse}`
                        : `${selectedLinkBook?.name_pt} — Cap. ${selectedLinkChapter}`)
                    : selectedLinkBook?.name_pt ?? 'Livros'}
                </Text>
              </Pressable>
            )}

            {/* Search & Testament filter — only on book step */}
            {pickerStep === 'book' && (
              <View style={[styles.searchAndFilterRow, { paddingHorizontal: Spacing.four }]}>
                <View style={[styles.compactSearchBox, { backgroundColor: isDark ? '#1C1A19' : '#FFF', borderColor: isDark ? '#3C3835' : '#E6DEC9' }]}>
                  <Search size={14} color={colors.textMuted} />
                  <TextInput
                    style={[styles.pickerSearchInput, { color: colors.text }]}
                    placeholder="Buscar livro..."
                    placeholderTextColor={isDark ? '#6E6662' : '#A3998D'}
                    value={bookSearchQuery}
                    onChangeText={setBookSearchQuery}
                    clearButtonMode="never"
                  />
                  {bookSearchQuery.length > 0 && (
                    <Pressable onPress={() => setBookSearchQuery('')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ padding: 4 }}>
                      <X size={16} color={colors.textSecondary} />
                    </Pressable>
                  )}
                </View>
                <View style={[styles.compactTestamentSelector, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}>
                  {(['all', 'old', 'new'] as const).map((f) => (
                    <Pressable
                      key={f}
                      style={[styles.compactTestamentBtn, testamentFilter === f && { backgroundColor: colors.accent }]}
                      onPress={() => setTestamentFilter(f)}
                    >
                      <Text style={[styles.compactTestamentBtnText, testamentFilter === f ? { color: '#FFF' } : { color: colors.textSecondary }]}>
                        {f === 'all' ? 'Todos' : f === 'old' ? 'VT' : 'NT'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* BOOK LIST */}
            {pickerStep === 'book' && (
              <SectionList
                sections={[
                  ...(testamentFilter === 'all' || testamentFilter === 'old' ? [{ title: 'Antigo Testamento', data: filteredBooks.filter(b => b.testament === 'old') }] : []),
                  ...(testamentFilter === 'all' || testamentFilter === 'new' ? [{ title: 'Novo Testamento', data: filteredBooks.filter(b => b.testament === 'new') }] : []),
                ]}
                keyExtractor={(item) => `book_${item.id}`}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: Spacing.four, paddingBottom: 72 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={12}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={true}
                renderSectionHeader={({ section }) => (
                  <View style={styles.testamentHeaderContainer}>
                    <View style={[styles.testamentIndicatorBar, { backgroundColor: colors.accent }]} />
                    <Text style={[styles.testamentHeaderLabel, { color: colors.text }]}>{section.title}</Text>
                  </View>
                )}
                renderItem={({ item: book }: { item: Book }) => {
                  const isSelected = selectedLinkBook?.id === book.id;
                  const isActiveBook = activeVerse?.book_id === book.id;
                  return (
                    <Pressable
                      style={[styles.bookRowLine, {
                        backgroundColor: isSelected ? colors.accentSubtle : (isDark ? '#161413' : '#FFFFFF'),
                        borderColor: isSelected ? colors.accent : (isDark ? '#242120' : '#EBE6DA'),
                        borderWidth: isSelected ? 1.5 : 1,
                      }]}
                      onPress={() => handleSelectBook(book)}
                    >
                      <View style={styles.bookRowLeft}>
                        <View style={[styles.bookAbbrevBadge, { backgroundColor: isActiveBook ? atualColor : isSelected ? colors.accent : (isDark ? '#2C2826' : '#F2EDE4') }]}>
                          <Text style={[styles.bookAbbrevText, isSelected ? { color: '#FFF' } : isActiveBook ? { color: '#FFF' } : { color: colors.textSecondary }]}>
                            {book.abbrev.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={[styles.bookRowText, isSelected ? { color: colors.accent, fontWeight: 'bold' } : { color: colors.text }]}>
                          {book.name_pt}
                        </Text>
                        {isActiveBook && (
                          <View style={[styles.originBadge, { backgroundColor: atualBg }]}>
                            <Text style={[styles.originBadgeText, { color: atualColor }]}>Atual</Text>
                          </View>
                        )}
                      </View>
                      <ChevronRight size={16} color={isSelected ? colors.accent : colors.textMuted} />
                    </Pressable>
                  );
                }}
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
                            ? { backgroundColor: colors.accent } 
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
                    const isSelected = selectedLinkVerse === verseNum;
                    const isSelf = activeVerse && selectedLinkBook.id === activeVerse.book_id && selectedLinkChapter === activeVerse.chapter && verseNum === activeVerse.verse;
                    return (
                      <Pressable
                        key={`picker_vs_${verseNum}`}
                        disabled={isSelf}
                        style={[
                          styles.numberCircleBtn, 
                          isSelected 
                            ? { backgroundColor: colors.accent } 
                            : { backgroundColor: colors.backgroundElement }
                        ]}
                        onPress={() => handleSelectVerse(verseNum)}
                      >
                        <Text 
                          style={[
                            styles.numberCircleText, 
                            isSelected 
                              ? { color: '#FFF', fontWeight: 'bold' } 
                              : isSelf 
                                ? { color: atualColor, fontWeight: 'bold', opacity: 0.75 } 
                                : { color: colors.text }
                          ]}
                        >
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
            {pickerStep === 'verse' && selectedLinkBook && selectedLinkChapter && selectedLinkVerse ? (
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
                  <Text style={[styles.pickerConfirmSummary, { color: colors.textMuted }]}>VÍNCULO SELECIONADO</Text>
                  <Text style={[styles.pickerConfirmRef, { color: colors.accent, fontWeight: 'bold' }]}>
                    {selectedLinkBook.name_pt} {selectedLinkChapter}:{selectedLinkVerse}
                  </Text>
                </View>
                <Pressable style={[styles.pickerConfirmBtn, { backgroundColor: colors.accent }]} onPress={handleAddLink}>
                  <Plus size={16} color="#FFF" />
                  <Text style={styles.pickerConfirmBtnText}>Vincular</Text>
                </Pressable>
              </View>
            ) : (
              /* Botão de ver referências vinculado fixo no rodapé */
              activeVerseCorrelations.length > 0 && (
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
                    style={[styles.fixedBottomBtn, { backgroundColor: colors.accent }]}
                  >
                    <Link size={15} color="#FFF" strokeWidth={2.5} />
                    <Text style={styles.fixedBottomBtnText}>
                      Ver Referências ({activeVerseCorrelations.length})
                    </Text>
                  </Pressable>
                </View>
              )
            )}


          </View>
        ) : (
          /* TABS ANOTAÇÃO e VINCULADOS: ScrollView normal */
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
            <View style={styles.studyWorkspace}>
              {/* TAB 1: ANOTAÇÃO */}
              {detailMode === 'note' && (
                <>
                  {/* Caixa de texto */}
                  <View style={[styles.notepadCard, { backgroundColor: isDark ? '#1C1A19' : '#FDFBF7', borderColor: isDark ? '#3C3835' : '#E6DEC9', borderLeftWidth: 4, borderLeftColor: colors.accent, shadowColor: isDark ? '#000' : '#8A7A5F', marginBottom: Spacing.three }]}>
                    <TextInput
                      style={[styles.notepadInput, { color: colors.text, fontFamily: 'serif', fontSize: 16, lineHeight: 26 }]}
                      placeholder="Escreva sua anotação..."
                      placeholderTextColor={isDark ? '#6E6662' : '#A3998D'}
                      multiline
                      scrollEnabled={false}
                      value={noteText}
                      onChangeText={setNoteText}
                      underlineColorAndroid="transparent"
                    />
                    <View style={[styles.notebookFooterBar, { borderTopColor: isDark ? '#2D2927' : '#F2ECE0' }]}>
                      <Text style={[styles.notebookWordCount, { color: colors.textMuted }]}>
                        {editingNoteId !== null ? 'Editando nota' : `${noteHistory.length}/5 notas`}
                      </Text>
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
                        style={[styles.notepadSaveBtn, { backgroundColor: noteText.trim() ? colors.accent : colors.backgroundElement }]}
                        onPress={handleSaveNote}
                        disabled={!noteText.trim()}
                      >
                        {editingNoteId !== null
                          ? <Check size={14} color={noteText.trim() ? '#FFF' : colors.textMuted} />
                          : <Plus size={14} color={noteText.trim() ? '#FFF' : colors.textMuted} />
                        }
                        <Text style={[styles.notepadSaveBtnText, { color: noteText.trim() ? '#FFF' : colors.textMuted }]}>Salvar</Text>
                      </Pressable>
                      </View>
                    </View>
                  </View>

                  {/* Barra de alternância: Versículo | Histórico */}
                  <View style={{ flexDirection: 'row', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderRadius: 12, padding: 4, marginBottom: Spacing.three, minHeight: 48 }}>
                    {(['verse', 'history'] as const).map(tab => {
                      const active = noteTab === tab;
                      const label = tab === 'verse' ? 'Versículo' : `Histórico${noteHistory.length > 0 ? ` (${noteHistory.length})` : ''}`;
                      return (
                        <Pressable key={tab} onPress={() => setNoteTab(tab as any)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8, backgroundColor: active ? colors.accent : 'transparent' }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: active ? '#FFF' : colors.textSecondary }}>{label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* PAINEL: VERSÍCULO */}
                  {noteTab === 'verse' && (
                    <View style={[styles.studyVerseCard, { backgroundColor: colors.card, borderColor: colors.backgroundElement }]}>
                      <View style={styles.verseTitleRow}>
                        <Text style={[styles.studyVerseHeader, { color: colors.text, fontFamily: 'serif' }]}>
                          {activeStudyVerseRef.bookName} {activeVerse.chapter}:{activeVerse.verse}
                        </Text>
                      </View>
                      <View style={[styles.translationSelectorBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                        {(['ARA', 'ARC', 'KJV', 'DBY'] as const).map(tr => {
                          const active = selectedTranslation === tr;
                          return (
                            <Pressable key={`tr_pill_${tr}`} style={[styles.translationPill, active && [styles.translationPillActive, { backgroundColor: colors.accent }]]} onPress={() => { setSelectedTranslation(tr); Vibration.vibrate(12); }}>
                              <Text style={[styles.translationPillText, active ? { color: '#FFF', fontWeight: 'bold' } : { color: colors.textSecondary }]}>{tr}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <View style={[styles.quoteLineIndicator, { backgroundColor: colors.accent }]} />
                      <Text style={[styles.studyVerseText, { color: colors.text }]}>"{getDisplayedScriptureText()}"</Text>
                      <View style={[styles.cardCaptionRow, { borderTopColor: colors.backgroundElement }]}>
                        <ArrowLeftRight size={12} color={colors.textMuted} />
                        <Text style={[styles.cardCaptionText, { color: colors.textMuted }]}>Toque nas abas no canto superior direito para alternar a tradução ativa.</Text>
                      </View>
                    </View>
                  )}

                  {/* PAINEL: HISTÓRICO */}
                  {noteTab === 'history' && (
                    noteHistory.length === 0 ? (
                      <View style={[styles.emptyCorrelations, { borderColor: isDark ? '#2D2927' : '#E6DEC9', backgroundColor: isDark ? '#1C1A19' : '#FDFBF7' }]}>
                        <MessageSquare size={28} color={colors.textSecondary} style={{ marginBottom: 8, opacity: 0.6 }} />
                        <Text style={[styles.emptyCorrelationsText, { color: colors.textSecondary }]}>Nenhuma anotação salva ainda.</Text>
                      </View>
                    ) : (
                      <View style={{ gap: Spacing.three }}>
                        {noteHistory.map((note) => {
                          const isEditing = editingNoteId === note.id;
                          return (
                            <View key={note.id} style={[styles.notepadCard, { backgroundColor: isDark ? '#161413' : '#FFF', borderColor: isEditing ? colors.accent : (isDark ? '#2D2927' : '#EBE6DA'), padding: Spacing.three }]}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.two }}>
                                <Calendar size={12} color={colors.textMuted} />
                                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted }}>{formatNoteDate(parseSqliteDate(note.updated_at))}</Text>
                              </View>
                              <Text style={{ color: colors.text, fontFamily: 'serif', fontSize: 15, lineHeight: 24, marginBottom: Spacing.three, opacity: isEditing ? 0.45 : 1 }}>{note.content}</Text>
                              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                                {isEditing ? (
                                  <Pressable
                                    onPress={() => { setEditingNoteId(null); setNoteText(''); Vibration.vibrate(10); }}
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: isDark ? 'rgba(156,163,175,0.25)' : 'rgba(75,85,99,0.2)', backgroundColor: isDark ? 'rgba(156,163,175,0.06)' : 'rgba(75,85,99,0.04)' }}
                                  >
                                    <X size={11} color={colors.textSecondary} strokeWidth={2} />
                                    <Text style={{ fontSize: 11.5, color: colors.textSecondary, fontWeight: '600' }}>Cancelar</Text>
                                  </Pressable>
                                ) : (
                                  <Pressable
                                    onPress={() => { setEditingNoteId(note.id); setNoteText(note.content); Vibration.vibrate(10); }}
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: isDark ? 'rgba(59,130,246,0.25)' : 'rgba(30,64,175,0.2)', backgroundColor: isDark ? 'rgba(59,130,246,0.04)' : 'rgba(30,64,175,0.02)' }}
                                  >
                                    <Edit2 size={11} color={colors.accent} strokeWidth={2} />
                                    <Text style={{ fontSize: 11.5, color: colors.accent, fontWeight: '600' }}>Editar</Text>
                                  </Pressable>
                                )}
                                <Pressable
                                  onPress={() => handleDeleteNote(note.id)}
                                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: isDark ? 'rgba(239,68,68,0.25)' : 'rgba(185,28,28,0.2)', backgroundColor: isDark ? 'rgba(239,68,68,0.04)' : 'rgba(185,28,28,0.02)' }}
                                >
                                  <Trash2 size={11} color={colors.error} strokeWidth={2} />
                                  <Text style={{ fontSize: 11.5, color: colors.error, fontWeight: '600' }}>Apagar</Text>
                                </Pressable>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )
                  )}
                </>
              )}

              {/* TAB 3: REFERÊNCIAS */}
              {detailMode === 'references' && (
                <View style={{ gap: Spacing.four }}>

                  {/* References List */}
                  {activeVerseCorrelations.length === 0 ? (
                    <View style={[styles.emptyCorrelations, { borderColor: isDark ? '#2D2927' : '#E6DEC9', backgroundColor: isDark ? '#1C1A19' : '#FDFBF7' }]}>
                      <Link size={32} color={colors.textMuted} style={{ marginBottom: 12, opacity: 0.5 }} />
                      <Text style={[styles.emptyCorrelationsText, { color: colors.textSecondary }]}>
                        Nenhuma referência cruzada vinculada a este versículo ainda.
                      </Text>
                      <Pressable 
                        style={[styles.notepadSaveBtn, { backgroundColor: colors.accent, marginTop: 16 }]} 
                        onPress={() => {
                          setDetailMode('links');
                          Vibration.vibrate(10);
                        }}
                      >
                        <Plus size={14} color="#FFF" />
                        <Text style={styles.notepadSaveBtnText}>Adicionar Vínculo</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      {/* Testament Filter Selector */}
                      <View style={{ alignItems: 'center', width: '100%', marginBottom: 10, marginTop: Spacing.one }}>
                        <View style={[styles.compactTestamentSelector, { flex: undefined, width: '100%', maxWidth: 280, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}>
                          {(['all', 'old', 'new'] as const).map((f) => {
                            const active = referencesTestamentFilter === f;
                            const label = f === 'all' ? 'Todos' : f === 'old' ? 'Antigo' : 'Novo';
                            return (
                              <Pressable
                                key={`ref_filter_${f}`}
                                style={[styles.compactTestamentBtn, active && { backgroundColor: colors.accent }]}
                                onPress={() => {
                                  setReferencesTestamentFilter(f);
                                  Vibration.vibrate(10);
                                }}
                              >
                                <Text style={[styles.compactTestamentBtnText, active ? { color: '#FFF' } : { color: colors.textSecondary }]}>
                                  {label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>

                      {(() => {
                        const filteredCorrelations = activeVerseCorrelations.filter(linked => {
                          if (referencesTestamentFilter === 'all') return true;
                          const book = allBooks.find(b => b.id === linked.book_id);
                          return book?.testament === referencesTestamentFilter;
                        });

                        if (filteredCorrelations.length === 0) {
                          return (
                            <View style={[styles.emptyCorrelations, { borderColor: isDark ? '#2D2927' : '#E6DEC9', backgroundColor: isDark ? '#1C1A19' : '#FDFBF7', paddingVertical: Spacing.six }]}>
                              <Text style={[styles.emptyCorrelationsText, { color: colors.textSecondary }]}>
                                Nenhuma referência cruzada no {referencesTestamentFilter === 'old' ? 'Antigo Testamento' : 'Novo Testamento'}.
                              </Text>
                            </View>
                          );
                        }

                        return (
                          <View style={{ gap: Spacing.three }}>
                            {filteredCorrelations.map((linked, idx) => {
                              const bookName = linked.book_name ?? 'Livro';
                              return (
                                <View 
                                  key={`ref_tab_item_${linked.book_id}_${linked.chapter}_${linked.verse}_${idx}`} 
                                  style={[
                                    styles.correlationRow, 
                                    { 
                                      backgroundColor: isDark ? '#1C1A19' : '#FDFBF7',
                                      borderColor: isDark ? '#2D2927' : '#E6DEC9',
                                      paddingRight: 48 
                                    }
                                  ]}
                                >
                                  <Pressable 
                                    style={{ flex: 1 }} 
                                    onPress={() => {
                                      handleGoToVerse(linked.book_id, linked.chapter, linked.verse);
                                    }}
                                  >
                                    <Text style={[styles.badgeRefText, { color: colors.accent }]} numberOfLines={1}>
                                      {bookName} {linked.chapter}:{linked.verse}
                                    </Text>
                                    <Text style={[styles.badgeExcerpt, { color: colors.textSecondary, fontSize: 13, lineHeight: 20 }]} numberOfLines={4}>
                                      {linked.text_ara}
                                    </Text>
                                  </Pressable>
                                  <Pressable 
                                    onPress={() => handleRemoveActiveCorrelation(linked)} 
                                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                    style={[
                                      styles.badgeRemoveBtn, 
                                      { 
                                        backgroundColor: isDark ? '#2A1A1A' : '#FFF0F0',
                                        borderRadius: 8,
                                        width: 32,
                                        height: 32,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        top: undefined, 
                                        right: 12, 
                                        position: 'absolute'
                                      }
                                    ]}
                                  >
                                    <X size={15} color={colors.error} />
                                  </Pressable>
                                </View>
                              );
                            })}
                          </View>
                        );
                      })()}
                    </>
                  )}
                </View>
              )}

            </View>
            <View style={{ height: 32 }} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>

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
    </SafeAreaView>
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
