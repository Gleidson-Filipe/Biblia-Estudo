import React, { useState, useCallback, useEffect } from 'react';
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
import { BookOpen, Search, Languages, HelpCircle } from 'lucide-react-native';
import Svg, { Rect, Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { Colors, Spacing } from '@/constants/theme';
import { searchStrongs, StrongEntry } from '@/database/queries';
import { translateToPt } from '@/services/translator';
import { useLocalSearchParams } from 'expo-router';

export default function LexiconScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];

  const params = useLocalSearchParams<{ query?: string }>();

  // State
  const [lexiconQuery, setLexiconQuery] = useState(params.query ?? '');
  const [results, setResults] = useState<StrongEntry[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback((q?: string) => {
    const query = (q ?? lexiconQuery).trim();
    setSearched(true);
    if (!query) { setResults([]); return; }
    setResults(searchStrongs(query));
  }, [lexiconQuery]);

  useEffect(() => {
    if (params.query) handleSearch(params.query);
  }, [params.query]);

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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerComponent}>
            {/* Visual Richness: Archaeological Stone Plate & Lens SVG */}
            <View style={styles.stoneContainer}>
              <Text style={[styles.title, { color: colors.text, fontFamily: 'serif' }]}>
                Léxico de Originais
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Dicionário Teológico Strong Grego & Hebraico
              </Text>
              
              <View style={styles.svgWrapper}>
                <Svg width={180} height={110} viewBox="0 0 100 60">
                  {/* Stone Plate Outline */}
                  <Rect
                    x="5"
                    y="5"
                    width="90"
                    height="50"
                    rx="3"
                    fill="none"
                    stroke={isDark ? '#242120' : '#EAE2D5'}
                    strokeWidth="1"
                  />
                  <Line
                    x1="5"
                    y1="18"
                    x2="95"
                    y2="18"
                    stroke={isDark ? '#242120' : '#EAE2D5'}
                    strokeWidth="0.5"
                  />
                  <Line
                    x1="5"
                    y1="38"
                    x2="95"
                    y2="38"
                    stroke={isDark ? '#242120' : '#EAE2D5'}
                    strokeWidth="0.5"
                  />
                  
                  {/* Faded ancient glyph inscriptions */}
                  <SvgText x="15" y="14" fill={isDark ? '#332E2C' : '#E0D8CC'} fontSize="6" fontFamily="serif">א</SvgText>
                  <SvgText x="35" y="14" fill={isDark ? '#332E2C' : '#E0D8CC'} fontSize="6" fontFamily="serif">β</SvgText>
                  <SvgText x="55" y="14" fill={isDark ? '#332E2C' : '#E0D8CC'} fontSize="6" fontFamily="serif">λ</SvgText>
                  <SvgText x="75" y="14" fill={isDark ? '#332E2C' : '#E0D8CC'} fontSize="6" fontFamily="serif">Ω</SvgText>
                  
                  <SvgText x="15" y="32" fill={isDark ? '#332E2C' : '#E0D8CC'} fontSize="6" fontFamily="serif">χ</SvgText>
                  <SvgText x="35" y="32" fill={isDark ? '#332E2C' : '#E0D8CC'} fontSize="6" fontFamily="serif">ב</SvgText>
                  <SvgText x="55" y="32" fill={isDark ? '#332E2C' : '#E0D8CC'} fontSize="6" fontFamily="serif">δ</SvgText>
                  <SvgText x="75" y="32" fill={isDark ? '#332E2C' : '#E0D8CC'} fontSize="6" fontFamily="serif">π</SvgText>

                  <SvgText x="15" y="50" fill={isDark ? '#332E2C' : '#E0D8CC'} fontSize="6" fontFamily="serif">γ</SvgText>
                  <SvgText x="35" y="50" fill={isDark ? '#332E2C' : '#E0D8CC'} fontSize="6" fontFamily="serif">ע</SvgText>
                  <SvgText x="75" y="50" fill={isDark ? '#332E2C' : '#E0D8CC'} fontSize="6" fontFamily="serif">φ</SvgText>
                  
                  {/* Magnifying Lens focusing on central active glyph 'ש' (Shin - active accent color) */}
                  <Circle
                    cx="55"
                    cy="48"
                    r="8"
                    fill={isDark ? 'rgba(59, 130, 246, 0.05)' : 'rgba(30, 64, 175, 0.03)'}
                    stroke={colors.accent}
                    strokeWidth="1"
                  />
                  <Line
                    x1="60.6"
                    y1="53.6"
                    x2="66"
                    y2="59"
                    stroke={colors.accent}
                    strokeWidth="1.2"
                  />
                  <SvgText x="52" y="51" fill={colors.accent} fontSize="8" fontWeight="bold" fontFamily="serif">ש</SvgText>
                </Svg>
              </View>
            </View>

            {/* Search Box */}
            <View style={[styles.searchBox, { borderColor: colors.backgroundElement, backgroundColor: colors.card }]}>
              <Search size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Busque número Strong (ex: H1, G12) ou termo"
                placeholderTextColor={colors.textMuted}
                value={lexiconQuery}
                onChangeText={setLexiconQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              {lexiconQuery ? (
                <Pressable onPress={() => setLexiconQuery('')} style={styles.clearBtn}>
                  <Text style={{ color: colors.textSecondary, fontSize: 16 }}>×</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Search Trigger */}
            <Pressable style={[styles.searchBtn, { backgroundColor: colors.accent }]} onPress={handleSearch}>
              <Text style={styles.searchBtnText}>Pesquisar Léxico</Text>
            </Pressable>

            {/* Help Prompt */}
            {!searched && (
              <View style={[styles.helpContainer, { backgroundColor: colors.backgroundElement }]}>
                <HelpCircle size={18} color={colors.accent} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.helpTitle, { color: colors.text }]}>Como utilizar:</Text>
                  <Text style={[styles.helpBody, { color: colors.textSecondary }]}>
                    • Digite <Text style={{ fontWeight: 'bold' }}>H1</Text> a <Text style={{ fontWeight: 'bold' }}>H8674</Text> para termos em Hebraico (A.T.).
                  </Text>
                  <Text style={[styles.helpBody, { color: colors.textSecondary }]}>
                    • Digite <Text style={{ fontWeight: 'bold' }}>G1</Text> a <Text style={{ fontWeight: 'bold' }}>G5624</Text> para termos em Grego (N.T.).
                  </Text>
                  <Text style={[styles.helpBody, { color: colors.textSecondary }]}>
                    • Digite termos em inglês, como <Text style={{ fontWeight: 'bold' }}>"father"</Text>, <Text style={{ fontWeight: 'bold' }}>"grace"</Text> ou <Text style={{ fontWeight: 'bold' }}>"love"</Text> para pesquisar definições semanticamente!
                  </Text>
                </View>
              </View>
            )}

            {searched && results.length === 0 && (
              <View style={styles.emptyResults}>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  Nenhum verbete original foi encontrado para "{lexiconQuery}".
                </Text>
              </View>
            )}
          </View>
        }
        renderItem={renderStrongItem}
        ListFooterComponent={<View style={{ height: 110 }} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  headerComponent: {
    marginBottom: Spacing.two,
  },
  stoneContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.two,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
  subtitle: {
    fontSize: 13,
    marginTop: Spacing.one,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.three,
    textAlign: 'center',
  },
  svgWrapper: {
    width: 180,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: 52,
    marginVertical: Spacing.two,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    marginLeft: Spacing.two,
    fontSize: 15,
  },
  clearBtn: {
    padding: Spacing.one,
  },
  searchBtn: {
    height: 48,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  searchBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  helpContainer: {
    flexDirection: 'row',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: Spacing.one,
  },
  helpBody: {
    fontSize: 13,
    lineHeight: 18,
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
});
