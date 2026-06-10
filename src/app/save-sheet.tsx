import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  Pressable,
  ScrollView,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ChevronLeft } from 'lucide-react-native';
import { Colors, Spacing } from '@/constants/theme';
import { getVerses } from '@/database/queries';
import { saveSheetRef } from '@/components/verse-context-ref';

const COLORS = ['#FCD34D', '#6EE7B7', '#60A5FA', '#FCA5A5'];

export default function SaveSheetScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  const { bookId, chapter, verseNums, version, bookDisplayName } = saveSheetRef;

  const verses = getVerses(bookId, chapter, [version]);

  // Agrupa versículos em ranges: [1,2,3,5,9] → [[1,3],[5,5],[9,9]]
  const buildRanges = (nums: number[]): [number, number][] => {
    if (nums.length === 0) return [];
    const sorted = [...nums].sort((a, b) => a - b);
    const ranges: [number, number][] = [];
    let start = sorted[0], end = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) { end = sorted[i]; }
      else { ranges.push([start, end]); start = sorted[i]; end = sorted[i]; }
    }
    ranges.push([start, end]);
    return ranges;
  };

  const ranges = buildRanges([...new Set(verseNums)].sort((a, b) => a - b));

  const handleBack = () => {
    router.back();
  };

  const handleConfirm = () => {
    saveSheetRef.onConfirm?.(selectedColor);
    router.back();
  };

  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, []));

  const accentBorder = selectedColor ?? colors.accent;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.backgroundElement }]}>
        <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={8}>
          <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Salvar versículos</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Preview — um card por range, mostrando o primeiro verso de cada */}
        {ranges.map(([start, end], i) => {
          const v = verses.find(x => x.verse === start);
          if (!v) return null;
          const text = (v as any)[`text_${version}`] as string ?? v.text_ara;
          const preview = text.length > 120 ? text.slice(0, 120) + '…' : text;
          const rangeLabel = start === end ? String(start) : `${start}–${end}`;
          return (
            <View
              key={start}
              style={[
                styles.versePreview,
                {
                  borderLeftColor: accentBorder,
                  backgroundColor: selectedColor ? `${selectedColor}22` : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                  marginBottom: i < ranges.length - 1 ? Spacing.two : Spacing.four,
                }
              ]}
            >
              <Text style={[styles.verseRef, { color: colors.accent }]}>
                {bookDisplayName} {chapter}:{rangeLabel}
              </Text>
              <Text style={[styles.verseText, { color: colors.text }]}>{preview}{end > start ? ' …' : ''}</Text>
            </View>
          );
        })}

        {/* Seletor de cor */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Cor (opcional)</Text>
        <View style={styles.colorRow}>
          {COLORS.map(color => (
            <Pressable
              key={color}
              onPress={() => setSelectedColor(prev => prev === color ? null : color)}
              style={[
                styles.colorCircle,
                { backgroundColor: color },
                selectedColor === color && styles.colorCircleActive,
                selectedColor === color && { borderColor: colors.text },
              ]}
            />
          ))}
        </View>

        {/* Sem cor = barra lateral azul */}
        {!selectedColor && (
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Sem cor: versículos serão marcados com barra azul lateral
          </Text>
        )}

      </ScrollView>

      {/* Botões */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.two, borderTopColor: colors.backgroundElement }]}>
        <Pressable onPress={handleBack} style={[styles.btnCancel, { borderColor: colors.backgroundElement }]}>
          <Text style={[styles.btnCancelText, { color: colors.textSecondary }]}>Cancelar</Text>
        </Pressable>
        <Pressable onPress={handleConfirm} style={[styles.btnConfirm, { backgroundColor: colors.accent }]}>
          <Text style={styles.btnConfirmText}>Salvar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    gap: Spacing.two,
  },
  backBtn: {
    marginRight: Spacing.one,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  content: {
    padding: Spacing.four,
  },
  versePreview: {
    borderLeftWidth: 3,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
  verseRef: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  verseText: {
    fontSize: 15,
    lineHeight: 22,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: Spacing.two,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: Spacing.two,
  },
  colorCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    opacity: 0.8,
  },
  colorCircleActive: {
    opacity: 1,
    transform: [{ scale: 1.15 }],
    borderWidth: 2,
  },
  hint: {
    fontSize: 12,
    marginTop: Spacing.one,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
  },
  btnCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  btnCancelText: {
    fontWeight: '600',
    fontSize: 15,
  },
  btnConfirm: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnConfirmText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
