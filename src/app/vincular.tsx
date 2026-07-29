import { useAppTheme } from '@/components/ThemeContext';
import React, { useState, useMemo, useRef, useCallback, memo } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView, Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Search, X, ChevronRight, Plus, Link } from 'lucide-react-native';
import { getBooks, getChaptersCount, getVersesCount, Book } from '@/database/queries';
import { linkVerseCallbackRef } from '@/components/verse-context-ref';
import { Colors, Spacing } from '@/constants/theme';

type Step = 'book' | 'chapter' | 'verse';

// ─── BookRow ─────────────────────────────────────────────────────────────────
const BookRow = memo(({ book, accentColor, onPress }: {
  book: Book; accentColor: string; onPress: (b: Book) => void;
}) => {
  const { isDark } = useAppTheme();
  const colors = Colors[isDark ? 'dark' : 'light'];
  return (
    <Pressable
      style={[styles.bookRowLine, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
      onPress={() => onPress(book)}
    >
      <View style={styles.bookRowLeft}>
        <View style={[styles.bookAbbrevBadge, { backgroundColor: colors.badge }]}>
          <Text style={[styles.bookAbbrevText, { color: colors.textSecondary }]}>
            {book.abbrev.toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.bookRowText, { color: colors.text }]}>{book.name_pt}</Text>
      </View>
      <ChevronRight size={16} color={colors.textMuted} />
    </Pressable>
  );
});

// ─── BookPickerList ───────────────────────────────────────────────────────────
const BookPickerList = memo(({ allBooks, accentColor, onSelectBook }: {
  allBooks: Book[]; accentColor: string; onSelectBook: (b: Book) => void;
}) => {
  const { isDark } = useAppTheme();
  const colors = Colors[isDark ? 'dark' : 'light'];
  const [testamentFilter, setTestamentFilter] = useState<'all' | 'old' | 'new'>('all');
  const [bookSearch, setBookSearch] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const filteredOT = useMemo(() => allBooks.filter(b =>
    b.testament === 'old' && (!bookSearch ||
      b.name_pt.toLowerCase().includes(bookSearch.toLowerCase()) ||
      b.abbrev.toLowerCase().includes(bookSearch.toLowerCase()))
  ), [allBooks, bookSearch]);

  const filteredNT = useMemo(() => allBooks.filter(b =>
    b.testament === 'new' && (!bookSearch ||
      b.name_pt.toLowerCase().includes(bookSearch.toLowerCase()) ||
      b.abbrev.toLowerCase().includes(bookSearch.toLowerCase()))
  ), [allBooks, bookSearch]);

  return (
    <>
      <View style={[styles.searchAndFilterRow, { paddingHorizontal: Spacing.four }]}>
        <View style={[styles.compactSearchBox, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
          <Search size={14} color={colors.textMuted} />
          <TextInput
            style={[styles.pickerSearchInput, { color: colors.text }]}
            placeholder="Buscar livro..."
            placeholderTextColor={colors.textMuted}
            value={bookSearch}
            onChangeText={setBookSearch}
            clearButtonMode="never"
          />
          {bookSearch.length > 0 && (
            <Pressable onPress={() => setBookSearch('')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ padding: 4 }}>
              <X size={16} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
        <View style={[styles.compactTestamentSelector, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}>
          {(['all', 'old', 'new'] as const).map(f => (
            <Pressable
              key={f}
              style={[styles.compactTestamentBtn, testamentFilter === f && { backgroundColor: accentColor }]}
              onPress={() => { setTestamentFilter(f); Vibration.vibrate(10); scrollRef.current?.scrollTo({ y: 0, animated: false }); }}
            >
              <Text style={[styles.compactTestamentBtnText, testamentFilter === f ? { color: '#FFF' } : { color: colors.textSecondary }]}>
                {f === 'all' ? 'Todos' : f === 'old' ? 'VT' : 'NT'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: Spacing.four, paddingBottom: 72 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={testamentFilter === 'new' ? { display: 'none' } : undefined}>
          {filteredOT.length > 0 && (
            <>
              <View style={styles.testamentHeaderContainer}>
                <View style={[styles.testamentIndicatorBar, { backgroundColor: accentColor }]} />
                <Text style={[styles.testamentHeaderLabel, { color: colors.text }]}>Antigo Testamento</Text>
              </View>
              {filteredOT.map(book => (
                <BookRow key={book.id} book={book} accentColor={accentColor} onPress={onSelectBook} />
              ))}
            </>
          )}
        </View>
        <View style={testamentFilter === 'old' ? { display: 'none' } : undefined}>
          {filteredNT.length > 0 && (
            <>
              <View style={styles.testamentHeaderContainer}>
                <View style={[styles.testamentIndicatorBar, { backgroundColor: accentColor }]} />
                <Text style={[styles.testamentHeaderLabel, { color: colors.text }]}>Novo Testamento</Text>
              </View>
              {filteredNT.map(book => (
                <BookRow key={book.id} book={book} accentColor={accentColor} onPress={onSelectBook} />
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </>
  );
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function VincularScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useAppTheme();
  const colors = Colors[isDark ? 'dark' : 'light'];
  const accentColor = colors.accent;

  const allBooks = getBooks();

  const [step, setStep] = useState<Step>('book');
  const [selBook, setSelBook] = useState<Book | null>(null);
  const [selChapter, setSelChapter] = useState<number | null>(null);
  const [chaptersList, setChaptersList] = useState<number[]>([]);
  const [versesList, setVersesList] = useState<number[]>([]);
  const [verseStart, setVerseStart] = useState<number | null>(null);
  const [verseEnd, setVerseEnd] = useState<number | null>(null);

  const selectedVerseRange: number[] = useMemo(() => {
    if (verseStart === null) return [];
    if (verseEnd === null) return [verseStart];
    const lo = Math.min(verseStart, verseEnd);
    const hi = Math.max(verseStart, verseEnd);
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  }, [verseStart, verseEnd]);

  const resetToBooks = () => {
    setStep('book');
    setSelBook(null);
    setSelChapter(null);
    setVerseStart(null);
    setVerseEnd(null);
    Vibration.vibrate(10);
  };

  const handleBack = () => {
    if (step === 'verse') {
      setStep('chapter');
      setVerseStart(null);
      setVerseEnd(null);
      return;
    }
    if (step === 'chapter') {
      setStep('book');
      setSelChapter(null);
      setVerseStart(null);
      setVerseEnd(null);
      return;
    }
    linkVerseCallbackRef.current = null;
    router.back();
  };

  const handleSelectBook = useCallback((book: Book) => {
    setSelBook(book);
    const count = getChaptersCount(book.id);
    setChaptersList(Array.from({ length: count }, (_, i) => i + 1));
    setStep('chapter');
    Vibration.vibrate(10);
  }, []);

  const handleSelectChapter = (ch: number) => {
    setSelChapter(ch);
    const count = getVersesCount(selBook!.id, ch);
    setVersesList(Array.from({ length: count }, (_, i) => i + 1));
    setVerseStart(null);
    setVerseEnd(null);
    setStep('verse');
    Vibration.vibrate(10);
  };

  const handleSelectVerse = (verseNum: number) => {
    if (verseStart === null) {
      setVerseStart(verseNum);
      setVerseEnd(null);
    } else if (verseStart === verseNum && verseEnd === null) {
      setVerseStart(null);
    } else if (verseEnd !== null) {
      setVerseStart(verseNum);
      setVerseEnd(null);
    } else {
      const lo = Math.min(verseStart, verseNum);
      const hi = Math.max(verseStart, verseNum);
      if (hi - lo + 1 <= 20) {
        setVerseEnd(verseNum);
      }
    }
    Vibration.vibrate(15);
  };

  const handleAddLink = () => {
    if (!selBook || !selChapter || selectedVerseRange.length === 0) return;
    for (const v of selectedVerseRange) {
      linkVerseCallbackRef.current?.(selBook.id, selChapter, v, selBook.abbrev);
    }
    linkVerseCallbackRef.current = null;
    Vibration.vibrate(20);
    router.back();
  };

  const verseRangeLabel = selectedVerseRange.length === 0 ? '' :
    selectedVerseRange.length === 1
      ? `${selectedVerseRange[0]}`
      : `${Math.min(...selectedVerseRange)}-${Math.max(...selectedVerseRange)}`;

  const headerTitle =
    step === 'book' ? 'Vincular' :
    step === 'chapter' ? `${selBook?.name_pt} — Capítulo` :
    `${selBook?.abbrev} ${selChapter} — Versículo`;

  const pickerBackLabel =
    step === 'verse'
      ? (selectedVerseRange.length > 0
          ? `${selBook?.name_pt} — Cap. ${selChapter} — vers. ${verseRangeLabel}`
          : `${selBook?.name_pt} — Cap. ${selChapter}`)
      : selBook?.name_pt ?? 'Livros';

  const showBottomBar = step !== 'book';

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.topBackHeader}>
        <Pressable
          style={[styles.backIconCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
          onPress={handleBack}
        >
          <ArrowLeft size={18} color={colors.text} />
        </Pressable>
        <Text style={[styles.topHeaderTitle, { color: colors.text, fontFamily: 'serif' }]}>{headerTitle}</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Conteúdo */}
      <View style={{ flex: 1, paddingTop: Spacing.two }}>
        {/* Back breadcrumb quando não está no step livro */}
        {step !== 'book' && (
          <Pressable
            style={[styles.pickerBackRow, { borderBottomColor: colors.border, marginHorizontal: Spacing.four }]}
            onPress={handleBack}
          >
            <ArrowLeft size={15} color={accentColor} />
            <Text style={[styles.pickerBackLabel, { color: accentColor }]}>{pickerBackLabel}</Text>
          </Pressable>
        )}

        {/* STEP: livros */}
        {step === 'book' && (
          <BookPickerList allBooks={allBooks} accentColor={accentColor} onSelectBook={handleSelectBook} />
        )}

        {/* STEP: capítulos */}
        {step === 'chapter' && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: Spacing.four, paddingBottom: 56 }}
          >
            <View style={styles.numberWrapGrid}>
              {chaptersList.map(ch => (
                <Pressable
                  key={ch}
                  style={[styles.numberCircleBtn, { backgroundColor: colors.backgroundElement }]}
                  onPress={() => handleSelectChapter(ch)}
                >
                  <Text style={[styles.numberCircleText, { color: colors.text }]}>{ch}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}

        {/* STEP: versículos */}
        {step === 'verse' && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: Spacing.four, paddingBottom: 56 }}
          >
            <View style={styles.numberWrapGrid}>
              {versesList.map(v => {
                const isStart = verseStart === v;
                const isInRange = selectedVerseRange.includes(v);
                const lo = verseStart !== null ? Math.min(verseStart, v) : v;
                const hi = verseStart !== null ? Math.max(verseStart, v) : v;
                const wouldExceed = verseStart !== null && verseEnd === null && (hi - lo + 1) > 20;
                return (
                  <Pressable
                    key={v}
                    disabled={wouldExceed}
                    style={[
                      styles.numberCircleBtn,
                      isStart ? { backgroundColor: accentColor } :
                      isInRange ? { backgroundColor: `${accentColor}44` } :
                      { backgroundColor: colors.backgroundElement },
                      wouldExceed && { opacity: 0.3 },
                    ]}
                    onPress={() => handleSelectVerse(v)}
                  >
                    <Text style={[
                      styles.numberCircleText,
                      isStart ? { color: '#FFF', fontWeight: 'bold' } :
                      isInRange ? { color: accentColor, fontWeight: '600' } :
                      { color: colors.text },
                    ]}>
                      {v}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>

      {/* Barra de rodapé fixa */}
      {showBottomBar && (
        <View
          style={[
            styles.fixedBottomBar,
            {
              flexDirection: 'column',
              alignItems: 'stretch',
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom: (insets.bottom || 0) + Spacing.three,
              gap: Spacing.two,
            },
          ]}
        >
          {/* Botões "Voltar para livros" + "Fechar" */}
          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            <Pressable
              onPress={resetToBooks}
              style={[styles.fixedBottomBtn, { backgroundColor: colors.border, flex: 1, paddingVertical: Spacing.two }]}
            >
              <Text style={[styles.fixedBottomBtnText, { color: colors.text, fontSize: 13 }]}>Voltar para livros</Text>
            </Pressable>
            <Pressable
              onPress={() => { linkVerseCallbackRef.current = null; router.back(); }}
              style={[styles.fixedBottomBtn, { backgroundColor: colors.border, flex: 1, paddingVertical: Spacing.two }]}
            >
              <Text style={[styles.fixedBottomBtnText, { color: colors.text, fontSize: 13 }]}>Fechar</Text>
            </Pressable>
          </View>

          {/* Divider */}
          {selectedVerseRange.length > 0 && (
            <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: -Spacing.four }} />
          )}

          {/* Botão Vincular */}
          {selectedVerseRange.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pickerConfirmSummary, { color: colors.textMuted }]}>DESTINO SELECIONADO</Text>
                <Text style={[styles.pickerConfirmRef, { color: accentColor, fontWeight: 'bold' }]}>
                  {selBook?.name_pt} {selChapter}:{verseRangeLabel}
                </Text>
              </View>
              <Pressable style={[styles.pickerConfirmBtn, { backgroundColor: accentColor }]} onPress={handleAddLink}>
                <Plus size={16} color="#FFF" />
                <Text style={styles.pickerConfirmBtnText}>Vincular</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  backIconCircle: {
    width: 38, height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topHeaderTitle: {
    fontSize: 16.5,
    fontWeight: 'bold',
    letterSpacing: 0.5,
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
});
