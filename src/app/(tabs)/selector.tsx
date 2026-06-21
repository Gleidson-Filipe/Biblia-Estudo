import { useAppTheme } from '@/components/ThemeContext';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  ScrollView, TextInput, Dimensions, BackHandler, Modal, Platform, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing } from '@/constants/theme';
import { Search, X, ChevronLeft, Clock, Trash2 } from 'lucide-react-native';
import { getBooks, getChaptersCount, getVerses, getVersesCount, isVersesCached, Book } from '@/database/queries';
import { readerNavigatingRef, pendingNavigationRef, bookName } from '@/components/verse-context-ref';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_SIZE = Math.floor(SCREEN_WIDTH / 6);
const HISTORY_KEY = 'selector_history';
const HISTORY_MAX = 10;
const BOOK_ROW_HEIGHT = 54;

type HistoryEntry = { bookId: number; bookName: string; chapter: number; verse?: number; ts: number };

async function loadHistory(): Promise<HistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveHistory(entries: HistoryEntry[]) {
  try { await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(entries)); } catch {}
}

function addToHistory(entries: HistoryEntry[], bookId: number, bookName: string, chapter: number, verse?: number): HistoryEntry[] {
  const filtered = entries.filter(e => !(e.bookId === bookId && e.chapter === chapter));
  return [{ bookId, bookName, chapter, verse, ts: Date.now() }, ...filtered].slice(0, HISTORY_MAX);
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ontem';
  if (d < 30) return `${d} dias atrás`;
  return 'um mês atrás';
}

export default function SelectorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookId?: string; chapter?: string; verse?: string }>();
  const { isDark } = useAppTheme();
  
  const colors = Colors[isDark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();

  const books = getBooks();
  const initialBook = books.find(b => b.id === Number(params.bookId)) ?? books[0];
  const initialChapter = Number(params.chapter) || 1;
  const initialVerse = Number(params.verse) || undefined;

  const [step, setStep] = useState<'book' | 'chapter' | 'verse' | 'history'>('book');
  const [selBook, setSelBook] = useState<Book>(initialBook);
  const [selChapter, setSelChapter] = useState<number | undefined>(initialChapter);
  const [versesCount, setVersesCount] = useState(0);
  const [bookSearch, setBookSearch] = useState('');
  const [testament, setTestament] = useState<'old' | 'new'>(
    initialBook.id > 39 ? 'new' : 'old'
  );
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selVerse, setSelVerse] = useState<number | undefined>(initialVerse);

  useEffect(() => {
    const book = books.find(b => b.id === Number(params.bookId)) ?? books[0];
    const chapter = Number(params.chapter) || 1;
    const verse = Number(params.verse) || undefined;
    setSelBook(book);
    setSelChapter(chapter);
    setSelVerse(verse);
    setTestament(book.id > 39 ? 'new' : 'old');
  }, [params.bookId, params.chapter, params.verse]);
  const bookScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadHistory().then(setHistory);
  }, []);

  useFocusEffect(useCallback(() => {
    setStep('book');
    setBookSearch('');
  }, []));

  useEffect(() => {
    if (step !== 'history') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setStep('book');
      return true;
    });
    return () => sub.remove();
  }, [step]);

  useEffect(() => {
    setVersesCount(getVersesCount(selBook.id, selChapter ?? 1));
  }, [selBook.id, selChapter]);

  const chaptersCount = getChaptersCount(selBook.id);
  const isSearching = bookSearch.length > 0;
  const filteredBooks = books.filter(b => {
    const match = b.name_pt.toLowerCase().includes(bookSearch.toLowerCase()) ||
      b.name_en.toLowerCase().includes(bookSearch.toLowerCase()) ||
      b.abbrev.toLowerCase().includes(bookSearch.toLowerCase());
    if (isSearching) return match;
    return match && (testament === 'old' ? b.id <= 39 : b.id > 39);
  });

  const confirm = (book: Book, chapter: number, verse?: number) => {
    const newHistory = addToHistory(history, book.id, bookName(book.name_pt, book.name_en), chapter, verse);
    setHistory(newHistory);
    saveHistory(newHistory);
    const alreadyCached = isVersesCached(book.id, chapter);
    readerNavigatingRef.current = !alreadyCached;
    pendingNavigationRef.bookId = book.id;
    pendingNavigationRef.chapter = chapter;
    pendingNavigationRef.verse = verse;
    router.back();
  };

  const getHeaderTitle = () => {
    if (step === 'history') return 'Histórico';
    if (step === 'book') return 'Índice';
    if (step === 'chapter') {
      return `${bookName(selBook.name_pt, selBook.name_en)}${selChapter ? ` ${selChapter}` : ''}`;
    }
    if (step === 'verse') {
      return `${bookName(selBook.name_pt, selBook.name_en)} ${selChapter ?? 1}${selVerse ? `:${selVerse}` : ''}`;
    }
    return 'Índice';
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => step === 'history' ? setStep('book') : router.back()} style={{ padding: 4 }}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text, flex: 1, marginLeft: Spacing.two }]}>
          {getHeaderTitle()}
        </Text>
        {step === 'history' ? (
          history.length > 0 && <Pressable onPress={() => setShowClearConfirm(true)} style={{ padding: 4 }}>
            <Trash2 size={22} color={colors.textSecondary} />
          </Pressable>
        ) : (
          <Pressable onPress={() => setStep('history')} style={{ padding: 4 }}>
            <Clock size={22} color={colors.text} />
          </Pressable>
        )}
      </View>

      {/* Step tabs — oculto no histórico */}
      {step !== 'history' && (
        <View style={[styles.tabHeader, { borderBottomColor: colors.border }]}>
          <Pressable style={[styles.tabItem, step === 'book' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]} onPress={() => setStep('book')}>
            <Text style={[styles.tabText, { color: step === 'book' ? colors.accent : colors.textSecondary, fontFamily: 'serif' }]}>Livros</Text>
          </Pressable>
          <Pressable style={[styles.tabItem, step === 'chapter' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]} onPress={() => setStep('chapter')}>
            <Text style={[styles.tabText, { color: step === 'chapter' ? colors.accent : colors.textSecondary, fontFamily: 'serif' }]}>Capítulos</Text>
          </Pressable>
          <Pressable style={[styles.tabItem, step === 'verse' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]} onPress={() => setStep('verse')}>
            <Text style={[styles.tabText, { color: step === 'verse' ? colors.accent : colors.textSecondary, fontFamily: 'serif' }]}>Versículo</Text>
          </Pressable>
        </View>
      )}

      <View style={{ flex: 1, position: 'relative' }}>
        {/* HISTÓRICO */}
        {step === 'history' && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
            {history.length === 0 && (
              <View style={{ alignItems: 'center', marginTop: 80, paddingHorizontal: Spacing.four }}>
                <Clock size={48} color={colors.border} />
                <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600', fontFamily: 'serif', marginTop: Spacing.three }}>
                  Nenhum histórico
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: Spacing.two, lineHeight: 20 }}>
                  Os capítulos que você acessar aparecerão aqui.
                </Text>
              </View>
            )}
            {history.map((entry, i) => (
              <Pressable
                key={i}
                style={[styles.bookRow, { borderBottomColor: colors.border }]}
                onPress={() => {
                  const book = books.find(b => b.id === entry.bookId);
                  if (book) { setSelBook(book); setSelChapter(entry.chapter); confirm(book, entry.chapter, entry.verse); }
                }}
              >
                <Text style={[styles.bookRowText, { color: colors.text, fontFamily: 'serif', fontWeight: 'bold' }]}>
                  {entry.bookName} {entry.chapter}{entry.verse ? `:${entry.verse}` : ''}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>{timeAgo(entry.ts)}</Text>
              </Pressable>
            ))}
            {history.length > 0 && (
              <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 24, marginBottom: 16, fontSize: 13, paddingHorizontal: Spacing.four }}>
                Os últimos {HISTORY_MAX} capítulos que você leu são recordados aqui.
              </Text>
            )}
          </ScrollView>
        )}

        {/* STEP 1: BOOKS */}
        <View style={[styles.stepView, { opacity: step === 'book' ? 1 : 0, zIndex: step === 'book' ? 1 : 0 }]} pointerEvents={step === 'book' ? 'auto' : 'none'}>
          <View style={{ paddingHorizontal: Spacing.four, marginVertical: Spacing.two }}>
            <View style={[styles.searchContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
              <Search size={16} color={colors.textSecondary} style={{ marginRight: Spacing.two }} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Buscar livro..."
                placeholderTextColor={colors.textSecondary}
                value={bookSearch}
                onChangeText={setBookSearch}
                autoCorrect={false}
              />
              {bookSearch.length > 0 && (
                <Pressable onPress={() => setBookSearch('')} style={{ padding: Spacing.one }}>
                  <X size={16} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>
          </View>
          <ScrollView
            ref={bookScrollRef}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: isSearching ? insets.bottom + BOOK_ROW_HEIGHT : 0 }}
            onLayout={() => {
              const idx = filteredBooks.findIndex(b => b.id === selBook.id);
              if (idx > 0) {
                bookScrollRef.current?.scrollTo({ y: idx * BOOK_ROW_HEIGHT, animated: false });
              }
            }}
          >
            <View style={styles.booksList}>
              {filteredBooks.map(item => (
                <Pressable
                  key={item.id}
                  style={[styles.bookRow, { borderBottomColor: colors.border }]}
                  onPress={() => { setSelBook(item); setSelChapter(undefined); setStep('chapter'); }}
                >
                  <Text style={[styles.bookRowText, { color: selBook.id === item.id ? colors.accent : colors.text, fontFamily: 'serif', fontWeight: selBook.id === item.id ? 'bold' : 'normal' }]}>
                    {bookName(item.name_pt, item.name_en)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          {!isSearching && (
            <View style={[styles.testamentBar, { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: insets.bottom }]}>
              <Pressable style={[styles.testamentTab, testament === 'old' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]} onPress={() => setTestament('old')}>
                <Text style={[styles.testamentText, { color: testament === 'old' ? colors.accent : colors.textSecondary, fontFamily: 'serif' }, testament === 'old' && { fontWeight: 'bold' }]}>Antigo Testamento</Text>
              </Pressable>
              <Pressable style={[styles.testamentTab, testament === 'new' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]} onPress={() => setTestament('new')}>
                <Text style={[styles.testamentText, { color: testament === 'new' ? colors.accent : colors.textSecondary, fontFamily: 'serif' }, testament === 'new' && { fontWeight: 'bold' }]}>Novo Testamento</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* STEP 2: CHAPTERS */}
        <View style={[styles.stepView, { opacity: step === 'chapter' ? 1 : 0, zIndex: step === 'chapter' ? 1 : 0 }]} pointerEvents={step === 'chapter' ? 'auto' : 'none'}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + CELL_SIZE }}>
            <View style={[styles.grid, { borderColor: colors.border }]}>
              {Array.from({ length: chaptersCount }, (_, i) => i + 1).map(chap => {
                const isActive = selChapter === chap;
                return (
                  <Pressable
                    key={chap}
                    style={[styles.gridItem, { width: CELL_SIZE, height: CELL_SIZE, borderColor: colors.border, backgroundColor: 'transparent' }]}
                    onPress={() => { setSelChapter(chap); setSelVerse(undefined); setVersesCount(getVersesCount(selBook.id, chap)); setStep('verse'); }}
                  >
                    <Text style={[styles.gridText, { color: isActive ? colors.accent : colors.text, fontFamily: 'serif', fontWeight: 'bold' }]}>{chap}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* STEP 3: VERSES */}
        <View style={[styles.stepView, { opacity: step === 'verse' ? 1 : 0, zIndex: step === 'verse' ? 1 : 0 }]} pointerEvents={step === 'verse' ? 'auto' : 'none'}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + CELL_SIZE }}>
            <View style={[styles.grid, { borderColor: colors.border }]}>
              {Array.from({ length: versesCount }, (_, i) => i + 1).map(vNum => {
                const isActive = selChapter === initialChapter && selBook.id === initialBook.id && vNum === selVerse;
                return (
                  <Pressable
                    key={vNum}
                    style={[styles.gridItem, { width: CELL_SIZE, height: CELL_SIZE, borderColor: colors.border, backgroundColor: 'transparent' }]}
                    onPress={() => { setSelVerse(vNum); confirm(selBook, selChapter ?? 1, vNum); }}
                  >
                    <Text style={[styles.gridText, { color: isActive ? colors.accent : colors.text, fontFamily: 'serif', fontWeight: 'bold' }]}>{vNum}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
      {/* Modal confirmação limpar histórico */}
      <Modal visible={showClearConfirm} transparent animationType="fade" onRequestClose={() => setShowClearConfirm(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowClearConfirm(false)}>
          <Pressable onPress={() => {}} style={[styles.confirmModal, { backgroundColor: colors.card }]}>
            <Text style={[styles.confirmTitle, { color: colors.text }]}>Limpar histórico</Text>
            <Text style={[styles.confirmBody, { color: colors.textSecondary }]}>Deseja apagar todo o histórico de leitura?</Text>
            <View style={styles.confirmButtons}>
              <Pressable style={[styles.confirmBtn, { borderColor: colors.border }]} onPress={() => setShowClearConfirm(false)}>
                <Text style={[styles.confirmBtnText, { color: colors.textSecondary }]}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.confirmBtn, { backgroundColor: colors.accent, borderColor: colors.accent }]} onPress={() => { setHistory([]); saveHistory([]); setShowClearConfirm(false); }}>
                <Text style={[styles.confirmBtnText, { color: '#fff' }]}>Apagar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.four, paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  title: { fontSize: 20, fontWeight: 'bold', fontFamily: 'serif' },
  tabHeader: {
    flexDirection: 'row', borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.three,
  },
  tabText: { fontSize: 15, fontWeight: '600' },
  stepView: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, paddingHorizontal: Spacing.three, height: 40,
  },
  searchInput: { flex: 1, fontSize: 15, height: 40 },
  booksList: {},
  bookRow: {
    paddingHorizontal: Spacing.four,
    height: BOOK_ROW_HEIGHT,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bookRowText: { fontSize: 17 },
  testamentBar: {
    flexDirection: 'row', borderTopWidth: 1,
  },
  testamentTab: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.three,
  },
  testamentText: { fontSize: 14, fontWeight: '500' },
  subTitle: { fontSize: 17, fontWeight: '600' },
  bypassBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  bypassText: { fontSize: 12, fontWeight: '600' },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    borderTopWidth: 1, borderLeftWidth: 1,
  },
  gridItem: {
    alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 1, borderRightWidth: 1,
  },
  gridText: { fontSize: 16 },
  confirmModal: {
    width: 280, borderRadius: 16, padding: Spacing.four,
  },
  confirmTitle: { fontSize: 17, fontWeight: 'bold', fontFamily: 'serif', marginBottom: Spacing.two },
  confirmBody: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.four },
  confirmButtons: { flexDirection: 'row', gap: Spacing.two },
  confirmBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
  },
  confirmBtnText: { fontSize: 15, fontWeight: '600' },
});
