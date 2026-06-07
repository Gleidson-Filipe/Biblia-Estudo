import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  TextInput,
  Pressable,
  FlatList,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Compass, BookOpen, ChevronRight, Filter } from 'lucide-react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Colors, Spacing } from '@/constants/theme';
import { searchReference, searchTerms, Verse } from '@/database/queries';
import { pendingNavigationRef } from '@/components/verse-context-ref';

export default function SearchScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];
  const router = useRouter();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [testamentFilter, setTestamentFilter] = useState<'all' | 'old' | 'new'>('all');
  const [results, setResults] = useState<Verse[]>([]);
  const [searchType, setSearchType] = useState<'none' | 'reference' | 'terms'>('none');
  const [searched, setSearched] = useState(false);

  // Compass needle rotation
  // If we search New Testament, point to the right (+45 deg). If Old, point left (-45 deg). Otherwise center (0).
  const [compassAngle, setCompassAngle] = useState(0);

  const handleSearch = () => {
    setSearched(true);
    const query = searchQuery.trim();
    if (!query) {
      setResults([]);
      setSearchType('none');
      return;
    }

    // 1. Try reference search first
    const refResult = searchReference(query);
    if (refResult) {
      setResults(refResult.verses);
      setSearchType('reference');
      // Set compass angle based on book index
      const bookId = refResult.book.id;
      if (bookId <= 39) {
        setCompassAngle(-45); // Old Testament
      } else {
        setCompassAngle(45); // New Testament
      }
      return;
    }

    // 2. Otherwise do FTS5 term search
    const filter = testamentFilter === 'all' ? undefined : testamentFilter;
    const termResults = searchTerms(query, filter);
    setResults(termResults);
    setSearchType('terms');

    // Calculate majority of results to steer compass
    if (termResults.length > 0) {
      let vtCount = 0;
      let ntCount = 0;
      termResults.forEach(v => {
        if (v.book_id <= 39) vtCount++;
        else ntCount++;
      });
      if (vtCount > ntCount) setCompassAngle(-45);
      else if (ntCount > vtCount) setCompassAngle(45);
      else setCompassAngle(0);
    } else {
      setCompassAngle(0);
    }
  };

  // Render search list items
  const navigateToVerse = (item: Verse) => {
    pendingNavigationRef.bookId = item.book_id;
    pendingNavigationRef.chapter = item.chapter;
    pendingNavigationRef.verse = item.verse;
    router.navigate('/');
  };

  const renderItem = ({ item }: { item: Verse }) => (
    <Pressable
      style={[styles.resultItem, { borderBottomColor: colors.backgroundElement }]}
      onPress={() => navigateToVerse(item)}
    >
      <View style={styles.resultHeader}>
        <Text style={[styles.resultReference, { color: colors.accent }]}>
          {item.book_name} {item.chapter}:{item.verse}
        </Text>
        <Text style={[styles.testamentBadge, { color: colors.textMuted, backgroundColor: colors.backgroundElement }]}>
          {item.book_id <= 39 ? 'VT' : 'NT'}
        </Text>
      </View>
      <Text style={[styles.resultText, { color: colors.text }]}>
        {item.text_ara}
      </Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Visual Richness: The Compass of Hemispheres SVG */}
        <View style={styles.compassContainer}>
          <Text style={[styles.brandTitle, { color: colors.text, fontFamily: 'serif' }]}>
            Scriptura
          </Text>
          <Text style={[styles.brandSubtitle, { color: colors.textSecondary }]}>
            Pesquisa de Hemisférios e Termos
          </Text>

          {/* Compass SVG */}
          <View style={styles.svgWrapper}>
            <Svg width={180} height={180} viewBox="0 0 100 100">
              {/* Compass Body */}
              <Circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke={isDark ? '#242120' : '#EAE2D5'}
                strokeWidth="1.5"
              />
              <Circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={isDark ? '#242120' : '#EAE2D5'}
                strokeWidth="0.5"
                strokeDasharray="1,2"
              />
              
              {/* Vertical divider */}
              <Line
                x1="50"
                y1="8"
                x2="50"
                y2="92"
                stroke={isDark ? '#242120' : '#EAE2D5'}
                strokeWidth="0.5"
              />
              
              {/* VT Label (Left) */}
              <Text style={styles.svgText}>VT</Text>
              
              {/* Old Testament Hemispheric Arc (39 dots on the left) */}
              {Array.from({ length: 15 }).map((_, i) => {
                const angle = 100 + (i * 160) / 14; // Arc from 100deg to 260deg
                const rad = (angle * Math.PI) / 180;
                const cx = 50 + 34 * Math.cos(rad);
                const cy = 50 + 34 * Math.sin(rad);
                return (
                  <Circle
                    key={`vt-${i}`}
                    cx={cx}
                    cy={cy}
                    r="1"
                    fill={colors.textMuted}
                  />
                );
              })}

              {/* New Testament Hemispheric Arc (27 dots on the right, active color) */}
              {Array.from({ length: 12 }).map((_, i) => {
                const angle = -80 + (i * 160) / 11; // Arc from -80deg to 80deg
                const rad = (angle * Math.PI) / 180;
                const cx = 50 + 34 * Math.cos(rad);
                const cy = 50 + 34 * Math.sin(rad);
                return (
                  <Circle
                    key={`nt-${i}`}
                    cx={cx}
                    cy={cy}
                    r="1.2"
                    fill={colors.accent}
                  />
                );
              })}

              {/* Compass Needle (Rotated based on search state) */}
              {/* Upper Needle (North) */}
              <Path
                d="M50,15 L53,50 L47,50 Z"
                fill={colors.accent}
                transform={`rotate(${compassAngle} 50 50)`}
              />
              {/* Lower Needle (South) */}
              <Path
                d="M50,85 L53,50 L47,50 Z"
                fill={colors.textSecondary}
                transform={`rotate(${compassAngle} 50 50)`}
              />
              <Circle cx="50" cy="50" r="3" fill={colors.background} />
              <Circle cx="50" cy="50" r="1.5" fill={colors.accent} />
            </Svg>
          </View>
        </View>

        {/* Search Input Bar */}
        <View style={[styles.searchBox, { borderColor: colors.backgroundElement, backgroundColor: colors.card }]}>
          <Search size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Ex: Mateus 4:3 ou amor misericórdia"
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={(text) => { setSearchQuery(text); if (!text.trim()) { setResults([]); setSearchType('none'); setSearched(false); } else if (searched) { const refResult = searchReference(text.trim()); if (refResult) { setResults(refResult.verses); setSearchType('reference'); } else { const filter = testamentFilter === 'all' ? undefined : testamentFilter; setResults(searchTerms(text.trim(), filter)); setSearchType('terms'); } } }}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchQuery ? (
            <Pressable onPress={() => { setSearchQuery(''); setResults([]); setSearchType('none'); setSearched(false); }} style={styles.clearBtn}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>×</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Filters Row */}
        <View style={styles.filterRow}>
          <Filter size={14} color={colors.textMuted} />
          <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Filtrar:</Text>
          
          <Pressable
            style={[
              styles.filterTab,
              { backgroundColor: testamentFilter === 'all' ? colors.accentSubtle : 'transparent' },
            ]}
            onPress={() => setTestamentFilter('all')}
          >
            <Text style={[styles.filterTabText, { color: testamentFilter === 'all' ? colors.accent : colors.textSecondary }]}>
              Ambos
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.filterTab,
              { backgroundColor: testamentFilter === 'old' ? colors.accentSubtle : 'transparent' },
            ]}
            onPress={() => setTestamentFilter('old')}
          >
            <Text style={[styles.filterTabText, { color: testamentFilter === 'old' ? colors.accent : colors.textSecondary }]}>
              A.T. (39)
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.filterTab,
              { backgroundColor: testamentFilter === 'new' ? colors.accentSubtle : 'transparent' },
            ]}
            onPress={() => setTestamentFilter('new')}
          >
            <Text style={[styles.filterTabText, { color: testamentFilter === 'new' ? colors.accent : colors.textSecondary }]}>
              N.T. (27)
            </Text>
          </Pressable>
        </View>

        {/* Trigger Search Button */}
        <Pressable style={[styles.searchButton, { backgroundColor: colors.accent }]} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>Buscar Referência ou Termos</Text>
        </Pressable>

        {/* Search Results */}
        {searched && (
          <View style={styles.resultsContainer}>
            <View style={styles.resultsHeaderRow}>
              <Text style={[styles.resultsTitle, { color: colors.text }]}>
                {searchType === 'reference' ? 'Salto de Referência' : 'Busca de Termos'}
              </Text>
              <Text style={[styles.resultsCount, { color: colors.textMuted }]}>
                {results.length} ocorrências
              </Text>
            </View>

            {results.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  Nenhum versículo ou livro atendeu aos critérios fornecidos.
                </Text>
              </View>
            ) : (
              results.map(item => (
                <Pressable key={item.id} style={[styles.resultItem, { borderBottomColor: colors.backgroundElement }]} onPress={() => navigateToVerse(item)}>
                  <View style={styles.resultHeader}>
                    <Text style={[styles.resultReference, { color: colors.accent }]}>
                      {item.book_name} {item.chapter}:{item.verse}
                    </Text>
                    <Text style={[styles.testamentBadge, { color: colors.textMuted, backgroundColor: colors.backgroundElement }]}>
                      {item.book_id <= 39 ? 'VT' : 'NT'}
                    </Text>
                  </View>
                  <Text style={[styles.resultText, { color: colors.text }]}>
                    {item.text_ara}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        )}

        {/* Overlay cushion for the bottom tabs */}
        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  compassContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.two,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  brandSubtitle: {
    fontSize: 13,
    marginTop: Spacing.one,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.three,
  },
  svgWrapper: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  svgText: {
    fontSize: 6,
    fontWeight: 'bold',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: 52,
    marginVertical: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    marginLeft: Spacing.two,
    fontSize: 16,
  },
  clearBtn: {
    padding: Spacing.one,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.one,
    marginBottom: Spacing.three,
    gap: Spacing.one,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: Spacing.one,
    textTransform: 'uppercase',
  },
  filterTab: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchButton: {
    height: 48,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.four,
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  resultsContainer: {
    marginTop: Spacing.two,
  },
  resultsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  resultsCount: {
    fontSize: 13,
  },
  emptyContainer: {
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 20,
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
    borderRadius: Spacing.one,
  },
  resultText: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'serif',
  },
  resultSubText: {
    fontSize: 12,
    marginTop: Spacing.one,
    fontStyle: 'italic',
  },
});
