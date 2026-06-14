import { useAppTheme } from '@/components/ThemeContext';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
 
  TextInput,
  Pressable,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Languages, X, ChevronUp } from 'lucide-react-native';
import Svg, { Rect, Circle, Path } from 'react-native-svg';
import { Colors, Spacing } from '@/constants/theme';
import { searchStrongs, StrongEntry } from '@/database/queries';
import { translateToPt } from '@/services/translator';
import { useLocalSearchParams } from 'expo-router';

export default function LexiconScreen() {
  const { isDark } = useAppTheme();
  
  const colors = Colors[isDark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{ query?: string; _t?: string }>();

  const PAGE_SIZE = 20;

  // State
  const [lexiconQuery, setLexiconQuery] = useState(params.query ?? '');
  const [allResults, setAllResults] = useState<StrongEntry[]>([]);
  const [visibleResults, setVisibleResults] = useState<StrongEntry[]>([]);
  const [searched, setSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const searchTokenRef = useRef(0);
  const flatListRef = useRef<any>(null);

  const handleSearch = useCallback(async (q?: string) => {
    const query = (q ?? lexiconQuery).trim();
    setSearched(true);
    if (!query) { setAllResults([]); setVisibleResults([]); return; }
    setIsSearching(true);
    const token = ++searchTokenRef.current;
    try {
      const res = await searchStrongs(query);
      if (token === searchTokenRef.current) {
        setAllResults(res);
        setVisibleResults(res.slice(0, PAGE_SIZE));
      }
    } catch (e) {
      console.error('[Lexicon] searchStrongs error:', e);
      if (token === searchTokenRef.current) { setAllResults([]); setVisibleResults([]); }
    } finally {
      if (token === searchTokenRef.current) setIsSearching(false);
    }
  }, [lexiconQuery]);

  useEffect(() => {
    if (params.query) {
      setLexiconQuery(params.query);
      handleSearch(params.query);
    }
  }, [params.query, params._t]);

  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [translating, setTranslating] = useState<Record<number, boolean>>({});

  const handleTranslate = useCallback(async (item: StrongEntry) => {
    if (translations[item.id]) {
      setTranslations(t => { const n = { ...t }; delete n[item.id]; return n; });
      return;
    }
    setTranslating(t => ({ ...t, [item.id]: true }));
    const pt = await translateToPt(item.description);
    setTranslating(t => ({ ...t, [item.id]: false }));
    setTranslations(t => ({ ...t, [item.id]: pt }));
  }, [translations]);

  const renderStrongItem = ({ item }: { item: StrongEntry }) => {
    const isHebrew = item.number.startsWith('H');
    const translated = translations[item.id];
    const isTranslating = translating[item.id];
    return (
      <View style={[styles.lexiconCard, { backgroundColor: colors.card, borderColor: colors.backgroundElement }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.strongNumber, { color: colors.accent }]}>
            {item.number}
          </Text>
          <Text style={[styles.langBadge, { color: isHebrew ? colors.warning : colors.success, backgroundColor: colors.backgroundElement }]}>
            {isHebrew ? 'Hebraico' : 'Grego'}
          </Text>
        </View>

        <View style={styles.lexicalDetails}>
          <View style={styles.detailRow}>
            <Text style={[styles.lemmaText, { color: colors.text }]}>{item.lemma}</Text>
            <Text style={[styles.xlitText, { color: colors.textSecondary }]}>/{item.xlit}/</Text>
          </View>
          <Text style={[styles.pronounceText, { color: colors.textMuted }]}>
            Pronúncia: <Text style={{ fontStyle: 'italic', fontWeight: 'bold' }}>{item.pronounce}</Text>
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.backgroundElement }]} />

        <Text style={[styles.descriptionText, { color: colors.text }]}>
          {translated ?? item.description}
        </Text>

        <Pressable
          onPress={() => handleTranslate(item)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start' }}
        >
          <Languages size={14} color={colors.accent} />
          <Text style={{ fontSize: 13, color: colors.accent }}>
            {isTranslating ? 'Traduzindo...' : translated ? 'Ver original' : 'Traduzir para português'}
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* CABEÇALHO FIXO NO TOPO */}
      <View style={[styles.fixedHeader, { borderBottomColor: colors.backgroundElement, backgroundColor: colors.background }]}>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.brandTitleCompact, { color: colors.text, fontFamily: 'serif' }]}>Léxico de Originais</Text>
          <Text style={[styles.brandSubtitleCompact, { color: colors.textMuted }]}>Strong</Text>
        </View>

        {/* Linha de busca compacta */}
        <View style={styles.searchRowCompact}>
          <View style={[styles.searchBoxCompact, { borderColor: colors.backgroundElement, backgroundColor: colors.card }]}>
            <Search size={16} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInputCompact, { color: colors.text }]}
              placeholder="Strong (ex: H1, G12) ou termo"
              placeholderTextColor={colors.textMuted}
              value={lexiconQuery}
              onChangeText={setLexiconQuery}
              onSubmitEditing={() => handleSearch()}
              returnKeyType="search"
            />
            {lexiconQuery ? (
              <Pressable
                onPress={() => { setLexiconQuery(''); setAllResults([]); setVisibleResults([]); setSearched(false); }}
                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                style={styles.clearBtnCompact}
              >
                <X size={16} color={colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            style={({ pressed }) => [styles.searchButtonCompact, { backgroundColor: colors.accent, opacity: pressed ? 0.75 : 1 }]}
            onPress={() => handleSearch()}
          >
            <Text style={styles.searchButtonTextCompact}>Pesquisar</Text>
          </Pressable>
        </View>

        {/* Dica sutil inline */}
        <Text style={[styles.hintTextCompact, { color: colors.textSecondary }]}>
          Busque H1-H8674 (A.T.), G1-G5624 (N.T.) ou termos em inglês (ex: grace, love).
        </Text>
      </View>

      {/* Botão voltar ao topo */}
      {showScrollTop && (
        <Pressable
          style={[styles.scrollTopBtn, { backgroundColor: colors.card, borderColor: colors.backgroundElement }]}
          onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
        >
          <ChevronUp size={22} color={colors.accent} />
        </Pressable>
      )}

      {/* RESULTADOS */}
      <FlatList
        ref={flatListRef}
        data={visibleResults}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.scrollContentCompact}
        ListFooterComponent={<View style={{ height: 110 }} />}
        showsVerticalScrollIndicator={false}
        onScroll={e => setShowScrollTop(e.nativeEvent.contentOffset.y > 300)}
        scrollEventThrottle={100}
        onEndReached={() => {
          if (visibleResults.length < allResults.length) {
            setVisibleResults(allResults.slice(0, visibleResults.length + PAGE_SIZE));
          }
        }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          searched && !isSearching ? (
            <View style={styles.emptyStateContainer}>
              <Svg width={100} height={100} viewBox="0 0 100 100" style={{ alignSelf: 'center', opacity: 0.6, marginBottom: 16 }}>
                <Path d="M 30,35 L 30,65 Q 40,65 50,65 Q 60,65 70,65 L 70,35 Z" fill="none" stroke={colors.textMuted} strokeWidth="1.5" />
                <Circle cx="55" cy="50" r="10" fill="none" stroke={colors.textMuted} strokeWidth="1.5" />
                <Path d="M 62,57 L 72,67" fill="none" stroke={colors.textMuted} strokeWidth="2.5" strokeLinecap="round" />
              </Svg>
              <Text style={[styles.emptyStateTitle, { color: colors.text }]}>Termo não Encontrado</Text>
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                Nenhum verbete original foi encontrado para "{lexiconQuery}". Verifique o código pesquisado ou busque por outra palavra.
              </Text>
            </View>
          ) : (
            <View style={styles.emptyStateContainer}>
              <Svg width={100} height={100} viewBox="0 0 100 100" style={{ alignSelf: 'center', opacity: 0.8, marginBottom: 16 }}>
                <Path d="M 28,30 C 28,26 36,26 36,30 L 36,68 C 36,72 28,72 28,68 Z" fill="none" stroke={colors.textSecondary} strokeWidth="2" />
                <Path d="M 64,30 C 64,26 72,26 72,30 L 72,68 C 72,72 64,72 64,68 Z" fill="none" stroke={colors.textSecondary} strokeWidth="2" />
                <Rect x="36" y="30" width="28" height="38" fill="none" stroke={colors.textSecondary} strokeWidth="2" />
                <Path d="M 42,38 L 48,38 M 42,46 L 58,46 M 42,54 L 54,54" fill="none" stroke={colors.textMuted} strokeWidth="1.5" strokeLinecap="round" />
                <Circle cx="60" cy="53" r="12" fill={colors.background} stroke={colors.accent} strokeWidth="2" />
                <Path d="M 68,61 L 78,71" fill="none" stroke={colors.accent} strokeWidth="3.5" strokeLinecap="round" />
              </Svg>
              <Text style={[styles.emptyStateTitle, { color: colors.text }]}>Estudo nos Originais</Text>
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                Consulte o significado teológico das palavras em Hebraico e Grego pesquisando o número Strong (ex: H7225, G746) ou um termo em inglês.
              </Text>
            </View>
          )
        }
        renderItem={renderStrongItem}
      />
    </View>
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
    marginBottom: Spacing.one,
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
  hintTextCompact: {
    fontSize: 11,
    marginTop: Spacing.one,
    fontStyle: 'italic',
    lineHeight: 15,
  },
  scrollContentCompact: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  emptyResults: {
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
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
  /* Lexicon Card Styles */
  lexiconCard: {
    borderWidth: 1.5,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.01,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  strongNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  langBadge: {
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 9999,
  },
  lexicalDetails: {
    marginBottom: Spacing.two,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  lemmaText: {
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: 'serif',
  },
  xlitText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  pronounceText: {
    fontSize: 13,
    marginTop: Spacing.half,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.two,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  scrollTopBtn: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 10,
  },
});
