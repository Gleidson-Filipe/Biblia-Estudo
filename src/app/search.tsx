import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  TextInput,
  Pressable,
  FlatList,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Search, Filter, ChevronDown, X } from 'lucide-react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Colors, Spacing } from '@/constants/theme';
import { searchReference, searchTerms, getBooks, getChaptersCount, Verse, Book } from '@/database/queries';
import { pendingNavigationRef, globalVersionRef, bookName } from '@/components/verse-context-ref';

const PAGE_SIZE = 24;

export default function SearchScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];
  const router = useRouter();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [testamentFilter, setTestamentFilter] = useState<'all' | 'old' | 'new'>('all');
  const [allResults, setAllResults] = useState<Verse[]>([]);
  const [visibleResults, setVisibleResults] = useState<Verse[]>([]);
  const [searchType, setSearchType] = useState<'none' | 'reference' | 'terms'>('none');
  const [searched, setSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Version filter
  const [activeVersion, setActiveVersion] = useState<'ara' | 'arc' | 'kjv' | 'dby'>('ara');
  const [versionModalVisible, setVersionModalVisible] = useState(false);

  // Book/chapter filter
  const [bookFilterVisible, setBookFilterVisible] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [bookPickerStep, setBookPickerStep] = useState<'book' | 'chapter'>('book');
  const books = getBooks();

  const searchedRef = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem('primaryVersion').then(v => {
      if (v === 'ara' || v === 'arc' || v === 'kjv' || v === 'dby') {
        setActiveVersion(v);
        globalVersionRef.current = v;
      }
    });
  }, []);

  useEffect(() => {
    globalVersionRef.current = activeVersion;
  }, [activeVersion]);

  const loadMore = useCallback((all: Verse[], current: Verse[]) => {
    const next = all.slice(0, current.length + PAGE_SIZE);
    setVisibleResults(next);
  }, []);

  const runSearch = useCallback(async (
    query: string,
    tFilter: typeof testamentFilter,
    bBook: Book | null,
    bChapter: number | null,
    versionOverride?: typeof activeVersion
  ) => {
    const q = query.trim();
    if (!q) { setAllResults([]); setVisibleResults([]); setSearchType('none'); return; }

    setIsSearching(true);
    const currentVersion = versionOverride || activeVersion;

    // 1. Try reference search first
    const refResult = searchReference(q);
    if (refResult) {
      let verses = refResult.verses;
      if (bBook) {
        verses = verses.filter(v => v.book_id === bBook.id);
        if (bChapter !== null) verses = verses.filter(v => v.chapter === bChapter);
      }
      setAllResults(verses);
      setVisibleResults(verses.slice(0, PAGE_SIZE));
      setSearchType('reference');
      setIsSearching(false);
      return;
    }

    // 2. FTS5 term search
    const filter = tFilter === 'all' ? undefined : tFilter;
    const bookId = bBook?.id;
    const chapterId = bChapter ?? undefined;
    const termResults = await searchTerms(q, filter, bookId, chapterId, currentVersion);
    setAllResults(termResults);
    setVisibleResults(termResults.slice(0, PAGE_SIZE));
    setSearchType('terms');
    setIsSearching(false);
  }, [activeVersion]);

  const handleSearch = async () => {
    setSearched(true);
    searchedRef.current = true;
    await runSearch(searchQuery, testamentFilter, selectedBook, selectedChapter, activeVersion);
  };

  const navigateToVerse = (item: Verse) => {
    pendingNavigationRef.bookId = item.book_id;
    pendingNavigationRef.chapter = item.chapter;
    pendingNavigationRef.verse = item.verse;
    pendingNavigationRef.version = activeVersion;
    router.navigate('/');
  };

  const clearBookFilter = () => {
    setSelectedBook(null);
    setSelectedChapter(null);
    if (searchedRef.current) runSearch(searchQuery, testamentFilter, null, null, activeVersion);
  };

  const chaptersCount = selectedBook ? getChaptersCount(selectedBook.id) : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* CABEÇALHO DE PESQUISA FIXO NO TOPO */}
      <View style={[styles.fixedHeader, { borderBottomColor: colors.backgroundElement, backgroundColor: colors.background }]}>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.brandTitleCompact, { color: colors.text, fontFamily: 'serif' }]}>Scriptura</Text>
          <Text style={[styles.brandSubtitleCompact, { color: colors.textMuted }]}>Pesquisa de Termos</Text>
        </View>

        {/* Linha de busca compacta */}
        <View style={styles.searchRowCompact}>
          <View style={[styles.searchBoxCompact, { borderColor: colors.backgroundElement, backgroundColor: colors.card }]}>
            <Search size={16} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInputCompact, { color: colors.text }]}
              placeholder="Ex: Mateus 4:3 ou amor"
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={async (text) => { 
                setSearchQuery(text); 
                if (!text.trim()) { 
                  setAllResults([]); 
                  setVisibleResults([]);
                  setSearchType('none'); 
                  setSearched(false); 
                  searchedRef.current = false;
                } else if (searchedRef.current) { 
                  await runSearch(text, testamentFilter, selectedBook, selectedChapter, activeVersion);
                } 
              }}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery ? (
              <Pressable onPress={() => { 
                setSearchQuery(''); 
                setAllResults([]); 
                setVisibleResults([]);
                setSearchType('none'); 
                setSearched(false); 
                searchedRef.current = false;
              }} style={styles.clearBtnCompact}>
                <X size={16} color={colors.textSecondary} />
              </Pressable>
            ) : null}

            {/* Divisor vertical sutil interno */}
            <View style={{ width: 1, height: 18, backgroundColor: colors.backgroundElement, marginHorizontal: 8 }} />

            {/* Seletor de Versão Interno */}
            <Pressable
              style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 4, paddingHorizontal: 2 }}
              onPress={() => setVersionModalVisible(true)}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>
                {activeVersion.toUpperCase()}
              </Text>
              <ChevronDown size={10} color={colors.accent} />
            </Pressable>
          </View>

          <Pressable style={({ pressed }) => [styles.searchButtonCompact, { backgroundColor: colors.accent, opacity: pressed ? 0.75 : 1 }]} onPress={handleSearch}>
            <Text style={styles.searchButtonTextCompact}>Buscar</Text>
          </Pressable>
        </View>

        {/* Filtros */}
        <View style={styles.filterRowCompact}>
          <Filter size={12} color={colors.textMuted} />
          <Text style={[styles.filterLabelCompact, { color: colors.textMuted }]}>Filtrar:</Text>
          {(['all', 'old', 'new'] as const).map(f => (
            <Pressable key={f} style={[styles.filterTabCompact, { backgroundColor: testamentFilter === f ? colors.accentSubtle : 'transparent' }]} onPress={() => {
              setTestamentFilter(f);
              if (searchedRef.current) runSearch(searchQuery, f, selectedBook, selectedChapter, activeVersion);
            }}>
              <Text style={[styles.filterTabTextCompact, { color: testamentFilter === f ? colors.accent : colors.textSecondary }]}>
                {f === 'all' ? 'Ambos' : f === 'old' ? 'A.T.' : 'N.T.'}
              </Text>
            </Pressable>
          ))}

          {/* Divisor vertical sutil */}
          <View style={{ width: 1, height: 14, backgroundColor: colors.backgroundElement, marginHorizontal: 4 }} />

          {/* Botão de Filtro de Livro/Capítulo */}
          <Pressable
            style={[styles.bookFilterBtnCompact, { borderColor: selectedBook ? colors.accent : colors.backgroundElement, backgroundColor: selectedBook ? colors.accentSubtle : 'transparent' }]}
            onPress={() => { setBookPickerStep('book'); setBookFilterVisible(true); }}
          >
            <Text style={[styles.filterTabTextCompact, { color: selectedBook ? colors.accent : colors.textSecondary }]}>
              {selectedBook
                ? (selectedChapter !== null ? `${bookName(selectedBook.name_pt, selectedBook.name_en)} ${selectedChapter}` : bookName(selectedBook.name_pt, selectedBook.name_en))
                : 'Livro/Cap.'}
            </Text>
            <ChevronDown size={10} color={selectedBook ? colors.accent : colors.textSecondary} />
          </Pressable>
          {selectedBook && (
            <Pressable onPress={clearBookFilter} style={styles.clearBookBtnCompact}>
              <X size={12} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* RESULTADOS */}
      <FlatList
        data={visibleResults}
        keyExtractor={item => item.id.toString()}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContentCompact}
        ListFooterComponent={<View style={{ height: 110 }} />}
        onEndReached={() => {
          if (visibleResults.length < allResults.length) {
            loadMore(allResults, visibleResults);
          }
        }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          searched && !isSearching ? (
            <View style={styles.emptyStateContainer}>
              <Svg width={100} height={100} viewBox="0 0 100 100" style={{ alignSelf: 'center', opacity: 0.6, marginBottom: 16 }}>
                <Circle cx="50" cy="45" r="25" fill="none" stroke={colors.textMuted} strokeWidth="1.5" strokeDasharray="3,3" />
                <Path d="M 38,45 Q 45,41 50,45 Q 55,41 62,45 L 62,53 Q 55,49 50,53 Q 45,49 38,53 Z" fill="none" stroke={colors.textMuted} strokeWidth="1.5" />
                <Path d="M 50,45 L 50,53" fill="none" stroke={colors.textMuted} strokeWidth="1.5" />
                <Path d="M 68,63 L 80,75" fill="none" stroke={colors.textMuted} strokeWidth="3" strokeLinecap="round" />
              </Svg>
              <Text style={[styles.emptyStateTitle, { color: colors.text }]}>Nenhum Resultado</Text>
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                Não encontramos versículos para sua busca. Tente palavras alternativas ou simplifique os termos.
              </Text>
            </View>
          ) : !isSearching ? (
            <View style={styles.emptyStateContainer}>
              <Svg width={100} height={100} viewBox="0 0 100 100" style={{ alignSelf: 'center', opacity: 0.8, marginBottom: 16 }}>
                <Circle cx="50" cy="45" r="28" fill="none" stroke={colors.accent} strokeWidth="2" strokeDasharray="3,3" />
                <Path d="M 36,45 Q 45,40 50,45 Q 55,40 64,45 L 64,55 Q 55,50 50,55 Q 45,50 36,55 Z" fill="none" stroke={colors.textSecondary} strokeWidth="2" />
                <Path d="M 50,45 L 50,55" fill="none" stroke={colors.textSecondary} strokeWidth="2" />
                <Path d="M 70,65 L 84,78" fill="none" stroke={colors.accent} strokeWidth="4" strokeLinecap="round" />
                <Circle cx="70" cy="65" r="3" fill={colors.background} stroke={colors.accent} strokeWidth="2" />
              </Svg>
              <Text style={[styles.emptyStateTitle, { color: colors.text }]}>Explorar as Escrituras</Text>
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                Digite um livro e versículo (ex: Gênesis 1:1) ou busque por palavras como "amor", "fé" ou "paz".
              </Text>
            </View>
          ) : null
        }
        ListHeaderComponent={
          searched && visibleResults.length > 0 ? (
            <View style={styles.resultsHeaderRow}>
              <Text style={[styles.resultsTitle, { color: colors.text }]}>
                {searchType === 'reference' ? 'Salto de Referência' : 'Busca de Termos'}
              </Text>
              <Text style={[styles.resultsCount, { color: colors.textMuted }]}>{allResults.length} ocorrências</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable style={[styles.resultItem, { borderBottomColor: colors.backgroundElement }]} onPress={() => navigateToVerse(item)}>
            <View style={styles.resultHeader}>
              <Text style={[styles.resultReference, { color: colors.accent }]}>{bookName(item.book_name ?? '', item.book_name_en)} {item.chapter}:{item.verse}</Text>
              <Text style={[styles.testamentBadge, { color: colors.textMuted, backgroundColor: colors.backgroundElement }]}>{item.book_id <= 39 ? 'VT' : 'NT'}</Text>
            </View>
            <Text style={[styles.resultText, { color: colors.text }]}>{item[`text_${activeVersion}` as keyof typeof item] as string}</Text>
          </Pressable>
        )}
      />

      {/* Version picker modal */}
      <Modal visible={versionModalVisible} transparent animationType="slide" onRequestClose={() => setVersionModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setVersionModalVisible(false)}>
          <Pressable style={[styles.versionModalSheet, { backgroundColor: colors.card }]} onPress={e => e.stopPropagation()}>
            <Text style={[styles.versionModalTitle, { color: colors.text }]}>Versão da Bíblia</Text>
            {([
              { id: 'ara', name: 'ARA', desc: 'Almeida Revisada e Atualizada' },
              { id: 'arc', name: 'ARC', desc: 'Almeida Revisada e Corrigida' },
              { id: 'dby', name: 'DBY', desc: 'Darby Translation (Inglês)' },
              { id: 'kjv', name: 'KJV', desc: 'King James Version (Inglês)' },
            ] as const).map((v, i, arr) => (
              <Pressable
                key={v.id}
                style={[styles.versionOption, { borderBottomColor: i < arr.length - 1 ? colors.backgroundElement : 'transparent' }]}
                onPress={() => {
                  setActiveVersion(v.id);
                  setVersionModalVisible(false);
                  if (searchedRef.current) runSearch(searchQuery, testamentFilter, selectedBook, selectedChapter, v.id);
                }}
              >
                <View>
                  <Text style={[styles.versionOptionName, { color: activeVersion === v.id ? colors.accent : colors.text }]}>{v.name}</Text>
                  <Text style={[styles.versionOptionDesc, { color: colors.textMuted }]}>{v.desc}</Text>
                </View>
                {activeVersion === v.id && <View style={[styles.versionCheckDot, { backgroundColor: colors.accent }]} />}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Book/Chapter picker modal */}
      <Modal visible={bookFilterVisible} transparent animationType="slide" onRequestClose={() => setBookFilterVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setBookFilterVisible(false)}>
          <Pressable style={[styles.pickerSheet, { backgroundColor: colors.card }]} onPress={e => e.stopPropagation()}>
            <View style={[styles.pickerHeader, { borderBottomColor: colors.backgroundElement }]}>
              {bookPickerStep === 'chapter' && (
                <Pressable onPress={() => setBookPickerStep('book')} style={{ marginRight: 8 }}>
                  <Text style={{ color: colors.accent, fontSize: 14 }}>← Voltar</Text>
                </Pressable>
              )}
              <Text style={[styles.pickerTitle, { color: colors.text, flex: 1 }]}>
                {bookPickerStep === 'book' ? 'Selecionar Livro' : `${selectedBook ? bookName(selectedBook.name_pt, selectedBook.name_en) : ''} — Capítulo`}
              </Text>
              <Pressable onPress={() => setBookFilterVisible(false)}>
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            {bookPickerStep === 'book' ? (
              <ScrollView>
                {books.map(b => (
                  <Pressable
                    key={b.id}
                    style={[styles.pickerItem, { borderBottomColor: colors.backgroundElement }, selectedBook?.id === b.id && { backgroundColor: colors.accentSubtle }]}
                    onPress={() => {
                      setSelectedBook(b);
                      setSelectedChapter(null);
                      setBookPickerStep('chapter');
                    }}
                  >
                    <Text style={[styles.pickerItemText, { color: selectedBook?.id === b.id ? colors.accent : colors.text }]}>{bookName(b.name_pt, b.name_en)}</Text>
                    <Text style={[styles.pickerItemBadge, { color: colors.textMuted }]}>{b.testament === 'old' ? 'VT' : 'NT'}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <ScrollView>
                <Pressable
                  style={[styles.pickerItem, { borderBottomColor: colors.backgroundElement }, selectedChapter === null && { backgroundColor: colors.accentSubtle }]}
                  onPress={() => {
                    setSelectedChapter(null);
                    setBookFilterVisible(false);
                    if (searchedRef.current) runSearch(searchQuery, testamentFilter, selectedBook, null, activeVersion);
                  }}
                >
                  <Text style={[styles.pickerItemText, { color: selectedChapter === null ? colors.accent : colors.text }]}>Todos os capítulos</Text>
                </Pressable>
                {Array.from({ length: chaptersCount }, (_, i) => i + 1).map(ch => (
                  <Pressable
                    key={ch}
                    style={[styles.pickerItem, { borderBottomColor: colors.backgroundElement }, selectedChapter === ch && { backgroundColor: colors.accentSubtle }]}
                    onPress={() => {
                      setSelectedChapter(ch);
                      setBookFilterVisible(false);
                      if (searchedRef.current) runSearch(searchQuery, testamentFilter, selectedBook, ch, activeVersion);
                    }}
                  >
                    <Text style={[styles.pickerItemText, { color: selectedChapter === ch ? colors.accent : colors.text }]}>Capítulo {ch}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
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
  fixedHeader: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    borderBottomWidth: 1.5,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: Spacing.two,
  },
  brandTitleCompact: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  brandSubtitleCompact: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  searchRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.two,
  },
  searchBoxCompact: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    height: 42,
  },
  searchInputCompact: {
    flex: 1,
    height: '100%',
    marginLeft: Spacing.one,
    fontSize: 14,
  },
  clearBtnCompact: {
    padding: Spacing.one,
  },
  searchButtonCompact: {
    height: 42,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonTextCompact: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  filterRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.one,
    flexWrap: 'wrap',
  },
  filterLabelCompact: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  filterTabCompact: {
    paddingVertical: Spacing.one / 2,
    paddingHorizontal: Spacing.two,
    borderRadius: 6,
  },
  filterTabTextCompact: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  bookFilterBtnCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.one / 2,
    paddingHorizontal: Spacing.two,
    borderRadius: 6,
    borderWidth: 1.2,
  },
  clearBookBtnCompact: {
    padding: 2,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  scrollContentCompact: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  resultsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  resultsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  resultsCount: {
    fontSize: 12,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: Spacing.four,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: Spacing.two,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  resultItem: {
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
  },
  resultReference: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  testamentBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.half,
    borderRadius: 4,
  },
  resultText: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'serif',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '75%',
    paddingBottom: 24,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.four,
    borderBottomWidth: 1,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.four,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerItemText: {
    fontSize: 15,
  },
  pickerItemBadge: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  versionModalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  versionModalTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  versionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  versionOptionName: {
    fontSize: 15,
    fontWeight: '600',
  },
  versionOptionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  versionCheckDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
