import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, useColorScheme, Pressable,
  ScrollView, TextInput, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing } from '@/constants/theme';
import { Search, X, ChevronLeft, Clock, MoreVertical } from 'lucide-react-native';
import { getBooks, getChaptersCount, getVerses, Book } from '@/database/queries';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_SIZE = Math.floor(SCREEN_WIDTH / 6);

export default function SelectorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookId?: string; chapter?: string }>();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];

  const books = getBooks();
  const initialBook = books.find(b => b.id === Number(params.bookId)) ?? books[0];
  const initialChapter = Number(params.chapter) || 1;

  const [step, setStep] = useState<'book' | 'chapter' | 'verse'>('book');
  const [selBook, setSelBook] = useState<Book>(initialBook);
  const [selChapter, setSelChapter] = useState<number>(initialChapter);
  const [versesCount, setVersesCount] = useState(0);
  const [bookSearch, setBookSearch] = useState('');
  const [testament, setTestament] = useState<'old' | 'new'>(
    initialBook.id > 39 ? 'new' : 'old'
  );
  const bookScrollRef = useRef<ScrollView>(null);
  const bookItemHeightRef = useRef(0);

  useEffect(() => {
    setVersesCount(getVerses(selBook.id, selChapter).length);
  }, [selBook, selChapter]);

  const chaptersCount = getChaptersCount(selBook.id);
  const isSearching = bookSearch.length > 0;
  const filteredBooks = books.filter(b => {
    const match = b.name_pt.toLowerCase().includes(bookSearch.toLowerCase()) ||
      b.abbrev.toLowerCase().includes(bookSearch.toLowerCase());
    if (isSearching) return match;
    return match && (testament === 'old' ? b.id <= 39 : b.id > 39);
  });

  const confirm = (book: Book, chapter: number, verse?: number) => {
    router.back();
    // pequeno delay para o back() processar antes de setar params
    setTimeout(() => {
      router.setParams({
        bookId: String(book.id),
        chapter: String(chapter),
        verse: verse ? String(verse) : undefined,
      });
    }, 50);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
        <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text, flex: 1, marginLeft: Spacing.two }]}>
          {selBook.name_pt}
        </Text>
        <Clock size={22} color={colors.textSecondary} style={{ marginRight: Spacing.three }} />
        <MoreVertical size={22} color={colors.textSecondary} />
      </View>

      {/* Step tabs */}
      <View style={styles.tabHeader}>
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

      <View style={{ flex: 1, position: 'relative' }}>
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
            onLayout={() => {
              const idx = filteredBooks.findIndex(b => b.id === selBook.id);
              if (idx > 0 && bookItemHeightRef.current > 0) {
                bookScrollRef.current?.scrollTo({ y: idx * bookItemHeightRef.current, animated: false });
              }
            }}
          >
            <View style={styles.booksList}>
              {filteredBooks.map(item => (
                <Pressable
                  key={item.id}
                  style={[styles.bookRow, { borderBottomColor: isDark ? '#3A3735' : '#DDD5C8' }]}
                  onLayout={e => { bookItemHeightRef.current = e.nativeEvent.layout.height; }}
                  onPress={() => { setSelBook(item); setStep('chapter'); }}
                >
                  <Text style={[styles.bookRowText, { color: selBook.id === item.id ? colors.accent : colors.text, fontFamily: 'serif', fontWeight: selBook.id === item.id ? 'bold' : 'normal' }]}>
                    {item.name_pt}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          {!isSearching && (
            <View style={[styles.testamentBar, { borderTopColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', backgroundColor: colors.background }]}>
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
          <View style={{ paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[styles.subTitle, { color: colors.text, fontFamily: 'serif' }]}>{selBook.name_pt}</Text>
            <Pressable style={[styles.bypassBtn, { backgroundColor: colors.accentSubtle }]} onPress={() => confirm(selBook, 1)}>
              <Text style={[styles.bypassText, { color: colors.accent }]}>Ver Capítulo Completo</Text>
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={[styles.grid, { borderColor: isDark ? '#3A3735' : '#DDD5C8' }]}>
              {Array.from({ length: chaptersCount }, (_, i) => i + 1).map(chap => {
                const isActive = selChapter === chap;
                return (
                  <Pressable
                    key={chap}
                    style={[styles.gridItem, { width: CELL_SIZE, height: CELL_SIZE, borderColor: isDark ? '#3A3735' : '#DDD5C8', backgroundColor: 'transparent' }]}
                    onPress={() => { setSelChapter(chap); setStep('verse'); }}
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
          <Text style={[styles.subTitle, { color: colors.text, paddingTop: Spacing.three, marginBottom: Spacing.three, fontFamily: 'serif', paddingHorizontal: Spacing.four }]}>
            {selBook.name_pt} {selChapter} — Escolha o Versículo
          </Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={[styles.grid, { borderColor: isDark ? '#3A3735' : '#DDD5C8' }]}>
              {Array.from({ length: versesCount }, (_, i) => i + 1).map(vNum => {
                const isActive = selChapter === initialChapter && selBook.id === initialBook.id && vNum === Number(params.chapter);
                return (
                  <Pressable
                    key={vNum}
                    style={[styles.gridItem, { width: CELL_SIZE, height: CELL_SIZE, borderColor: isDark ? '#3A3735' : '#DDD5C8', backgroundColor: 'transparent' }]}
                    onPress={() => confirm(selBook, selChapter, vNum)}
                  >
                    <Text style={[styles.gridText, { color: isActive ? colors.accent : colors.text, fontFamily: 'serif', fontWeight: 'bold' }]}>{vNum}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
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
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
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
    paddingHorizontal: Spacing.four, paddingVertical: 16,
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
});
