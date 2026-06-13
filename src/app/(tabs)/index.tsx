import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { FlashList } from '@shopify/flash-list';
import BibleReaderView, { BibleReaderViewRef } from '@/components/BibleReaderView';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { unstable_batchedUpdates } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  TextInput,
  Share,
  Clipboard,
  Dimensions,
  Keyboard,
  TouchableNativeFeedback,
  BackHandler,
  Alert,
  InteractionManager,
  Modal,
  Vibration,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useNavigation, useRouter, useLocalSearchParams, useFocusEffect, useIsFocused } from 'expo-router';
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CornerUpLeft, GripVertical, Heart, MessageSquare, Split, Share2, Search, X, Link, AlignJustify, Languages } from 'lucide-react-native';
import SortableVersionList from '@/components/sortable-version-list';
import { Colors, Spacing, BottomTabInset } from '@/constants/theme';
import Svg, { Line } from 'react-native-svg';
import { verseContextRef, activeStudyVerseRef, tabBarVisibilityRef, selectorNavigationRef, dbModifiedRef, readerNavigatingRef, pendingNavigationRef, globalVersionRef, bookName, saveSheetRef } from '@/components/verse-context-ref';
import { translateToPt, initTranslator } from '@/services/translator';
import { initializeDatabase, getDB } from '@/database/db';
import {
  getBooks,
  getChaptersCount,
  getVersesCount,
  getVerses,
  toggleFavorite,
  invalidateVersesCache,
  saveNote,
  deleteNote,
  getVerse,
  getInterlinearVerse,
  InterlinearWord,
  Book,
  Verse,
  getNotesByVerse,
  getNoteGroupsByVerse,
  getGroupIdsForVerses,
  addNoteGroup,
  mergeNoteGroups,
  deleteNoteGroup,
  getNoteGroupsForChapter,
  Note,
  NoteGroup,
  parseGroupNotes,
  BlockLink,
  getBlockLinkSrcVerseNumsForChapter,
  getBlockLinkGroupSrcVerseNumsForChapter,
  getBlockLinkTgtVerseNumsForChapter,
  getBlockLinksFromVerse,
  getBlockLinksToVerse,
  removeBlockLink,
} from '@/database/queries';

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

type SelectorProps = {
  books: Book[];
  initialBook: Book | null;
  initialChapter: number;
  initialVerse: number | null;
  isDark: boolean;
  colors: any;
  onClose: () => void;
  onConfirm: (book: Book, chapter: number, verse?: number) => void;
  isLinkingMode?: boolean;
  linkingTargetText?: string;
};

const PassageSelector = memo(({ books, initialBook, initialChapter, initialVerse, isDark, colors, onClose, onConfirm, isLinkingMode = false, linkingTargetText = '' }: SelectorProps) => {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'book' | 'chapter' | 'verse'>('book');
  const [selBook, setSelBook] = useState<Book | null>(initialBook);
  const [selChapter, setSelChapter] = useState<number | null>(initialChapter);
  const [versesCount, setVersesCount] = useState(0);
  const [bookSearch, setBookSearch] = useState('');
  const [testament, setTestament] = useState<'old' | 'new'>(
    initialBook && initialBook.id > 39 ? 'new' : 'old'
  );
  const bookScrollRef = useRef<ScrollView>(null);
  const bookItemHeightRef = useRef(0);

  useEffect(() => {
    if (selBook && selChapter) {
      setVersesCount(getVersesCount(selBook.id, selChapter));
    }
  }, [selBook, selChapter]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'verse') { setStep('chapter'); return true; }
      if (step === 'chapter') { setStep('book'); return true; }
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [step, onClose]);

  const chaptersCount = selBook ? getChaptersCount(selBook.id) : 0;

  const isSearching = bookSearch.length > 0;
  const filteredBooks = books.filter(b => {
    const match = b.name_pt.toLowerCase().includes(bookSearch.toLowerCase()) ||
                  b.abbrev.toLowerCase().includes(bookSearch.toLowerCase());
    if (isSearching) return match;
    return match && (testament === 'old' ? b.id <= 39 : b.id > 39);
  });

  return (
    <View style={[styles.selectorFullScreen, { backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : insets.top, paddingBottom: Platform.OS === 'android' ? 0 : insets.bottom }]}>
      <View style={[styles.fullScreenHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
        <Text style={[styles.fullScreenHeaderTitle, { color: colors.text, fontFamily: 'serif' }]}>
          {isLinkingMode ? 'Vincular Versículo' : (step === 'book' ? 'Índice' : (selBook ? bookName(selBook.name_pt, selBook.name_en) : 'Índice'))}
        </Text>
        <Pressable style={[styles.closeIconButton, { backgroundColor: colors.backgroundElement }]} onPress={onClose}>
          <X size={20} color={colors.text} />
        </Pressable>
      </View>

      {isLinkingMode && (
        <View style={{ backgroundColor: colors.accentSubtle, paddingVertical: 10, paddingHorizontal: Spacing.four, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
          <Text style={{ fontSize: 13, color: colors.accent, fontWeight: 'bold', fontFamily: 'serif', textAlign: 'center' }}>
            Selecione o versículo que deseja vincular a: {linkingTargetText}
          </Text>
        </View>
      )}

      <View style={[styles.tabHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
        <Pressable style={[styles.tabHeaderItem, step === 'book' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]} onPress={() => setStep('book')}>
          <Text style={[styles.tabHeaderText, { color: step === 'book' ? colors.accent : colors.textSecondary, fontFamily: 'serif' }]}>Livros</Text>
        </Pressable>
        <Pressable style={[styles.tabHeaderItem, step === 'chapter' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]} disabled={!selBook} onPress={() => setStep('chapter')}>
          <Text style={[styles.tabHeaderText, { color: step === 'chapter' ? colors.accent : selBook ? colors.text : colors.textMuted, fontFamily: 'serif' }]}>Capítulos</Text>
        </Pressable>
        <Pressable style={[styles.tabHeaderItem, step === 'verse' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]} disabled={!selBook} onPress={() => setStep('verse')}>
          <Text style={[styles.tabHeaderText, { color: step === 'verse' ? colors.accent : selBook ? colors.text : colors.textMuted, fontFamily: 'serif' }]}>Versículo</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1, position: 'relative' }}>
        {/* STEP 1: BOOKS */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: step === 'book' ? 1 : 0, zIndex: step === 'book' ? 1 : 0 }} pointerEvents={step === 'book' ? 'auto' : 'none'}>
          <View style={{ paddingHorizontal: Spacing.four, marginVertical: Spacing.two }}>
            <View style={[styles.searchContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
              <Search size={16} color={colors.textSecondary} style={{ marginRight: Spacing.two }} />
              <TextInput style={[styles.searchInput, { color: colors.text }]} placeholder="Buscar livro..." placeholderTextColor={colors.textSecondary} value={bookSearch} onChangeText={setBookSearch} autoCorrect={false} />
              {bookSearch.length > 0 && <Pressable onPress={() => setBookSearch('')} style={{ padding: Spacing.one }}><X size={16} color={colors.textSecondary} /></Pressable>}
            </View>
          </View>
          <ScrollView
            ref={bookScrollRef}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            onLayout={() => {
              if (selBook && bookItemHeightRef.current > 0) {
                const idx = filteredBooks.findIndex(b => b.id === selBook.id);
                if (idx > 0) {
                  bookScrollRef.current?.scrollTo({ y: idx * bookItemHeightRef.current, animated: false });
                }
              }
            }}
          >
            <View style={styles.booksList}>
              {filteredBooks.map((item) => (
                <Pressable
                  key={item.id}
                  style={[styles.bookRowItem, { borderBottomColor: isDark ? '#3A3735' : '#DDD5C8', backgroundColor: 'transparent' }]}
                  onLayout={(e) => { bookItemHeightRef.current = e.nativeEvent.layout.height; }}
                  onPress={() => { setSelBook(item); setSelChapter(null); setStep('chapter'); }}
                >
                  <Text style={[styles.bookRowText, { color: selBook?.id === item.id ? colors.accent : colors.text, fontFamily: 'serif', fontWeight: selBook?.id === item.id ? 'bold' : 'normal' }]}>{bookName(item.name_pt, item.name_en)}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          {!isSearching && (
            <View style={[styles.testamentTabBar, { borderTopColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', backgroundColor: colors.background }]}>
              <Pressable style={[styles.testamentTab, testament === 'old' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]} onPress={() => setTestament('old')}>
                <Text style={[styles.testamentTabText, { color: testament === 'old' ? colors.accent : colors.textSecondary, fontFamily: 'serif' }, testament === 'old' && { fontWeight: 'bold' }]}>Antigo Testamento</Text>
              </Pressable>
              <Pressable style={[styles.testamentTab, testament === 'new' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]} onPress={() => setTestament('new')}>
                <Text style={[styles.testamentTabText, { color: testament === 'new' ? colors.accent : colors.textSecondary, fontFamily: 'serif' }, testament === 'new' && { fontWeight: 'bold' }]}>Novo Testamento</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* STEP 2: CHAPTERS */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: step === 'chapter' ? 1 : 0, zIndex: step === 'chapter' ? 1 : 0 }} pointerEvents={step === 'chapter' ? 'auto' : 'none'}>
          <View style={[styles.chapterHeaderRow, { paddingHorizontal: Spacing.four }]}>
            <Text style={[styles.modalSubTitle, { color: colors.text, fontFamily: 'serif' }]}>{selBook ? bookName(selBook.name_pt, selBook.name_en) : ''}</Text>
            {!isLinkingMode && (
              <Pressable style={[styles.bypassButton, { backgroundColor: colors.accentSubtle }]} onPress={() => { if (selBook) onConfirm(selBook, 1); }}>
                <Text style={[styles.bypassButtonText, { color: colors.accent }]}>Ver Capítulo Completo</Text>
              </Pressable>
            )}
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={[styles.chaptersGrid, { borderColor: isDark ? '#2D2A29' : '#DDD5C8' }]}>
              {Array.from({ length: chaptersCount }, (_, i) => i + 1).map((chap) => {
                const isActive = selChapter === chap;
                return (
                  <Pressable key={chap} style={[styles.chapterGridItem, { borderColor: isDark ? '#2D2A29' : '#DDD5C8', backgroundColor: isActive ? colors.accentSubtle : 'transparent' }]}
                    onPress={() => { setSelChapter(chap); setStep('verse'); }}>
                    <Text style={[styles.chapterItemText, { color: isActive ? colors.accent : colors.text, fontFamily: 'serif', fontWeight: isActive ? 'bold' : 'normal' }]}>{chap}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* STEP 3: VERSES */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: step === 'verse' ? 1 : 0, zIndex: step === 'verse' ? 1 : 0 }} pointerEvents={step === 'verse' ? 'auto' : 'none'}>
          <Text style={[styles.modalSubTitle, { color: colors.text, marginBottom: Spacing.three, fontFamily: 'serif', paddingHorizontal: Spacing.four }]}>
            {selBook ? bookName(selBook.name_pt, selBook.name_en) : ''} {selChapter} — Escolha o Versículo
          </Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={[styles.chaptersGrid, { borderColor: isDark ? '#2D2A29' : '#DDD5C8' }]}>
              {Array.from({ length: versesCount }, (_, i) => i + 1).map((vNum) => {
                const isSelf = isLinkingMode && selChapter === initialChapter && selBook?.id === initialBook?.id && vNum === initialVerse;
                const isActive = !isSelf && initialVerse === vNum && selChapter === initialChapter && selBook?.id === initialBook?.id;
                return (
                  <Pressable
                    key={vNum}
                    disabled={isSelf}
                    style={[
                      styles.chapterGridItem,
                      {
                        borderColor: isDark ? '#2D2A29' : '#DDD5C8',
                        backgroundColor: isActive ? colors.accentSubtle : 'transparent',
                        opacity: isSelf ? 0.25 : 1,
                      }
                    ]}
                    onPress={() => {
                      if (selBook && selChapter) onConfirm(selBook, selChapter, vNum);
                    }}
                  >
                    <Text
                      style={[
                        styles.chapterItemText,
                        {
                          color: isActive ? colors.accent : (isSelf ? colors.textMuted : colors.text),
                          fontFamily: 'serif',
                          fontWeight: isActive ? 'bold' : 'normal',
                          textDecorationLine: isSelf ? 'line-through' : 'none',
                        }
                      ]}
                    >
                      {vNum}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
});

const hexToRgbA = (hex: string, alpha: number) => {
  let c;
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    c = hex.substring(1).split('');
    if (c.length === 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    const num = parseInt(c.join(''), 16);
    return 'rgba(' + [(num >> 16) & 255, (num >> 8) & 255, num & 255].join(',') + ',' + alpha + ')';
  }
  return hex;
};

const SkeletonLine = memo(({ width, opacity }: { width: string; opacity: number }) => {
  const anim = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const animOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [opacity, opacity * 0.4] });
  return <Animated.View style={{ height: 13, width: width as any, borderRadius: 6, backgroundColor: '#888', opacity: animOpacity, marginBottom: 8 }} />;
});

const ReaderSkeleton = memo(({ isDark }: { isDark: boolean }) => {
  const rows: { w1: string; w2: string }[] = [
    { w1: '92%', w2: '78%' },
    { w1: '85%', w2: '60%' },
    { w1: '95%', w2: '72%' },
    { w1: '70%', w2: '55%' },
    { w1: '88%', w2: '66%' },
    { w1: '80%', w2: '50%' },
    { w1: '93%', w2: '74%' },
    { w1: '75%', w2: '58%' },
  ];
  const baseOpacity = isDark ? 0.15 : 0.1;
  return (
    <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 20 }}>
      {rows.map((r, i) => (
        <View key={i} style={{ marginBottom: 18 }}>
          <SkeletonLine width={r.w1} opacity={baseOpacity} />
          <SkeletonLine width={r.w2} opacity={baseOpacity * 0.7} />
        </View>
      ))}
    </View>
  );
});

const DottedText = memo(({ text, isSelected, dotColor, textStyle, textColor }: {
  text: string; isSelected: boolean; dotColor: string; textStyle: any; textColor: string;
}) => {
  const [lines, setLines] = React.useState<{ width: number; y: number }[]>([]);
  const opacity = React.useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  opacity.setValue(isSelected ? 1 : 0);

  return (
    <View>
      <Text
        style={[textStyle, { color: textColor }]}
        onTextLayout={(e) => {
          setLines(e.nativeEvent.lines.map(l => ({ width: l.width, y: l.y + l.height })));
        }}
      >
        {text}
      </Text>
      <Animated.View style={{ opacity, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
        {lines.map((line, i) => (
          <Svg key={i} width={line.width} height="2" style={{ position: 'absolute', top: line.y - 4, left: 0 }}>
            <Line x1="0" y1="1" x2={line.width} y2="1" stroke={dotColor} strokeWidth="1" strokeDasharray="0.8,3" strokeLinecap="round" />
          </Svg>
        ))}
      </Animated.View>
    </View>
  );
});

interface VerseRowProps {
  item: Verse;
  text: string;
  isSelected: boolean;
  isFav: boolean;
  hasNote: boolean;
  hasCorrelations: boolean;
  savedHighlightColor: string | null;
  primaryVersion: string;
  colors: any;
  onPress: (item: Verse) => void;
  onPressCompare: () => void;
  onPressNoteNumber?: () => void;
  onLayout?: (e: any) => void;
  interlinearWords?: InterlinearWord[];
  onInterlinearWordPress?: (word: InterlinearWord) => void;
}

const VerseRow = React.memo(({
  item,
  text,
  isSelected,
  isFav,
  hasNote,
  hasCorrelations,
  savedHighlightColor,
  primaryVersion,
  colors,
  onPress,
  onPressCompare,
  onPressNoteNumber,
  onLayout,
  interlinearWords,
  onInterlinearWordPress,
}: VerseRowProps) => {
  const suppressNextPress = React.useRef(false);
  const numberPressTime = React.useRef(0);

  const viewStyle = [
    styles.verseBlock,
    { borderBottomColor: colors.backgroundElement },
    savedHighlightColor && {
      backgroundColor: hexToRgbA(savedHighlightColor, 0.15),
      borderRadius: 6,
      paddingHorizontal: 6,
    },
  ];

  return (
    <View style={viewStyle}>
    <Pressable
      onLayout={onLayout}
      onPress={() => { if (Date.now() - numberPressTime.current < 400) return; onPress(item); }}
      android_ripple={null}
      unstable_pressDelay={0}
    >
      <View style={styles.verseHeader}>
        <Pressable
          onPressIn={() => { numberPressTime.current = Date.now(); }}
          onPress={() => {
            if ((hasNote || hasCorrelations) && onPressNoteNumber) onPressNoteNumber();
          }}
          disabled={!hasNote && !hasCorrelations}
          style={(hasNote || hasCorrelations) ? [
            styles.highlightedVerseNumberBadge,
            { backgroundColor: colors.accent }
          ] : styles.normalVerseNumberContainer}
        >
          <Text style={[
            styles.verseNumberText,
            (hasNote || hasCorrelations) ? { color: '#FFF', fontWeight: 'bold' } : { color: colors.accent }
          ]}>
            {item.verse}
          </Text>
        </Pressable>

        {/* Lateral Compare Button & Linked Icon */}
        <Pressable
          style={[styles.lateralCompareBtn, { marginLeft: 'auto', opacity: 0.9 }]}
          onPress={() => { suppressNextPress.current = true; setTimeout(() => { suppressNextPress.current = false; }, 500); onPressCompare(); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {hasNote && (
              <MessageSquare size={13} color={colors.accent} />
            )}
            {hasCorrelations && (
              <Link size={13} color={colors.accent} />
            )}
            <BookOpen size={16} color={colors.textSecondary} />
          </View>
        </Pressable>
      </View>
      {interlinearWords == null || interlinearWords.length === 0 ? (
        <DottedText
          text={text}
          isSelected={isSelected}
          dotColor={savedHighlightColor || '#ffffff'}
          textStyle={styles.verseText}
          textColor={colors.text}
        />
      ) : null}
    </Pressable>
    {interlinearWords && interlinearWords.length > 0 && (
      <View style={{ marginTop: 4, paddingHorizontal: 4 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {interlinearWords.map((word, i) => (
            <Pressable key={i} onPress={() => onInterlinearWordPress?.(word)} style={{ alignItems: 'center', minWidth: 30, paddingVertical: 4, paddingHorizontal: 2 }}>
              <Text style={[styles.verseText, { color: word.gloss ? colors.text : colors.textSecondary, lineHeight: 26 }]}>{word.gloss || '—'}</Text>
              <Text style={{ fontSize: 11, color: colors.accent, marginTop: -2 }}>{word.translit}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    )}
    </View>
  );
});

interface SplitVerseRowProps {
  item: Verse;
  textPrimary: string;
  textSecondary: string;
  isSelected: boolean;
  savedHighlightColor: string | null;
  hasNote: boolean;
  hasCorrelations: boolean;
  colors: any;
  onPress: () => void;
  onPressNoteNumber?: () => void;
  onLayout?: (e: any) => void;
}

const SplitVerseRow = React.memo(({
  item,
  textPrimary,
  textSecondary,
  isSelected,
  savedHighlightColor,
  hasNote,
  hasCorrelations,
  colors,
  onPress,
  onPressNoteNumber,
  onLayout,
}: SplitVerseRowProps) => {
  return (
    <Pressable
      onLayout={onLayout}
      style={[
        styles.splitRow,
        { borderBottomColor: colors.backgroundElement },
        savedHighlightColor && {
          backgroundColor: hexToRgbA(savedHighlightColor, 0.12),
          borderRadius: 6,
        },
      ]}
      onPress={onPress}
    >
      <View style={{ flexDirection: 'row', width: '100%' }}>
        {/* Column 1 */}
        <View style={styles.splitCell}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Pressable
              onPress={onPressNoteNumber}
              disabled={!hasNote && !hasCorrelations}
              style={(hasNote || hasCorrelations) ? [
                styles.highlightedVerseNumberBadge,
                { backgroundColor: colors.accent }
              ] : styles.normalVerseNumberContainer}
            >
              <Text style={[
                styles.verseNumberText,
                (hasNote || hasCorrelations) ? { color: '#FFF', fontWeight: 'bold' } : { color: colors.accent }
              ]}>
                {item.verse}
              </Text>
            </Pressable>
            {hasCorrelations && (
              <Link size={14} color={colors.accent} style={{ marginLeft: 4 }} />
            )}
          </View>
          <DottedText text={textPrimary} isSelected={isSelected} dotColor={savedHighlightColor || '#ffffff'} textStyle={styles.splitVerseText} textColor={colors.text} />
        </View>
        {/* Column 2 */}
        <View style={styles.splitCell}>
          <Text style={[styles.splitVerseNumber, { color: colors.textMuted, marginBottom: 4 }]}>
            {item.verse}
          </Text>
          <DottedText text={textSecondary} isSelected={isSelected} dotColor={savedHighlightColor || '#ffffff'} textStyle={styles.splitVerseText} textColor={colors.text} />
        </View>
      </View>
    </Pressable>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.textPrimary === nextProps.textPrimary &&
    prevProps.textSecondary === nextProps.textSecondary &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.savedHighlightColor === nextProps.savedHighlightColor &&
    prevProps.hasNote === nextProps.hasNote &&
    prevProps.hasCorrelations === nextProps.hasCorrelations &&
    prevProps.colors === nextProps.colors
  );
});



function InterlinearWordModal({ word, onClose, onNavigateToLexicon, isDark, colors }: {
  word: InterlinearWord;
  onClose: () => void;
  onNavigateToLexicon: (code: string) => void;
  isDark: boolean;
  colors: any;
}) {
  const strong = word.strong_number ? (() => {
    try { return (getDB() as any).getFirstSync('SELECT * FROM strongs WHERE number = ?', word.strong_number); } catch { return null; }
  })() : null;

  const [glossPtFinal, setGlossPtFinal] = useState<string>(word.gloss_pt || word.gloss || '');
  const [descPt, setDescPt] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    // Translate gloss via ML Kit if static map didn't find a translation
    if (word.gloss && word.gloss_pt === word.gloss) {
      translateToPt(word.gloss).then(r => setGlossPtFinal(r));
    }
    // Translate Strong description
    if (strong?.description) {
      setTranslating(true);
      translateToPt(strong.description)
        .then(r => setDescPt(r))
        .finally(() => setTranslating(false));
    }
  }, [word.gloss, strong?.description]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} onPress={onClose}>
        <Pressable onPress={() => {}} style={{ width: '88%', borderRadius: 16, padding: 20, borderWidth: 1, backgroundColor: colors.card, borderColor: colors.backgroundElement }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 28, color: colors.text, fontFamily: 'serif', marginBottom: 2 }}>{word.orig_word}</Text>
              <Text style={{ fontSize: 14, color: colors.accent }}>{word.translit}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              {word.strong_number && (
                <Pressable
                  onPress={() => { onClose(); onNavigateToLexicon(word.strong_number!); }}
                  style={{ backgroundColor: colors.accentSubtle, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}
                >
                  <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '700' }}>{word.strong_number} ↗</Text>
                </Pressable>
              )}
              <View style={{ backgroundColor: isDark ? '#2A2826' : '#EDE8DF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>
                  {word.language === 'greek' ? 'Grego' : word.language === 'aramaic' ? 'Aramaico' : 'Hebraico'}
                </Text>
              </View>
            </View>
          </View>
          {glossPtFinal ? (
            <Text style={{ fontSize: 17, color: colors.text, fontWeight: '700', marginBottom: 2 }}>{glossPtFinal}</Text>
          ) : null}
          {word.gloss ? (
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12 }}>{word.gloss} (en)</Text>
          ) : (
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12, fontStyle: 'italic' }}>partícula gramatical</Text>
          )}
          {strong && (
            <>
              {strong.lemma && <Text style={{ fontSize: 15, color: colors.text, fontFamily: 'serif', marginBottom: 4 }}>{strong.lemma}</Text>}
              {strong.pronounce && <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8 }}>{strong.pronounce}</Text>}
              {strong.description && (
                <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
                  {translating ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 20 }}>
                      {descPt || strong.description}
                    </Text>
                  )}
                </ScrollView>
              )}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}


export default function BibleReaderScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];
  const navigation = useNavigation();
  const router = useRouter();
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(false);
  isFocusedRef.current = isFocused;
  const params = useLocalSearchParams<{ bookId?: string; chapter?: string; verse?: string; openLinkSelector?: string }>();
  const insets = useSafeAreaInsets();

  const flatListRef = useRef<FlashList<Verse>>(null);
  const splitListRef = useRef<FlatList<Verse>>(null);
  const bibleReaderRef = useRef<BibleReaderViewRef>(null);
  const verseRefsMap = useRef<Record<number, any>>({});
  const itemOffsetsRef = useRef<number[]>([]);
  const pendingScrollVerseRef = useRef<number | null>(null);

  const [highlightedVerse, setHighlightedVerse] = useState<number | null>(null);
  const scrollToVerseRef = useRef<number | null>(null);
  const activeSelectedVerseStateRef = useRef<Verse | null>(null);
  const verseHighlightsRef = useRef<Record<string, string>>({});
  const dbReadyRef = useRef(false);
  const selectedBookRef = useRef<Book | null>(null);
  const selectedChapterRef = useRef(1);

  // State
  const isNavigatingRef = useRef(false);
  const isFromSelectorRef = useRef(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const setIsNavigatingBoth = (v: boolean) => { isNavigatingRef.current = v; setIsNavigating(v); };
  const [dbReady, setDbReady] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [listOpacity, setListOpacity] = useState(1);
  const [useFlashList, setUseFlashList] = useState(false);
  const [initialScrollIndex, setInitialScrollIndex] = useState<number | undefined>(undefined);
  const [chaptersCount, setChaptersCount] = useState(0);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [correlatedVerseNums, setCorrelatedVerseNums] = useState<Set<number>>(new Set());
  const [noteVerseNums, setNoteVerseNums] = useState<Set<number>>(new Set());
  const [groupNoteVerseNums, setGroupNoteVerseNums] = useState<Set<number>>(new Set()); // ALL group verses (for bar/number color)
  const [groupNoteWithNotesVerseNums, setGroupNoteWithNotesVerseNums] = useState<Set<number>>(new Set()); // only groups with actual notes (for note icon)
  const [groupCorrVerseNums, setGroupCorrVerseNums] = useState<Set<number>>(new Set());
  const [tgtVerseNums, setTgtVerseNums] = useState<Set<number>>(new Set());
  const [incomingLinksModal, setIncomingLinksModal] = useState<{ verse: number; links: BlockLink[] } | null>(null);
  const [incomingLinkTypeFilter, setIncomingLinkTypeFilter] = useState<'individual' | 'group'>('individual');

  const runAfterTransition = (callback: () => void) => {
    let called = false;
    const done = () => {
      if (called) return;
      called = true;
      callback();
    };
    const unsubscribe = navigation.addListener('transitionEnd' as any, () => {
      unsubscribe();
      done();
    });
    setTimeout(() => {
      unsubscribe();
      done();
    }, 250);
  };
  
  // Selection / Navigation Sheets (Step-by-step)
  const [showSelector, setShowSelector] = useState(false);
  const [interlinearVerse, setInterlinearVerse] = useState<{ verse: Verse; words: InterlinearWord[] } | null>(null);
  const interlinearVerseRef = useRef<{ verse: Verse; words: InterlinearWord[] } | null>(null);
  const savedVerseBeforeInterlinearRef = useRef<Verse | null>(null);
  const [selectedInterlinearWord, setSelectedInterlinearWord] = useState<InterlinearWord | null>(null);
  const [selectedVerse, setSelectedVerse] = useState<Verse | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [showLinkSelector, setShowLinkSelector] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Dedicated Linking State
  const [isLinkingFromSelector, setIsLinkingFromSelector] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const [expandedVerse, setExpandedVerse] = useState<number | null>(null);
  const [activeSelectedVerse, setActiveSelectedVerse] = useState<Verse | null>(null);
  const activeSelectedVerseRef = useRef<Verse | null>(null);
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [multiSelectedVerses, setMultiSelectedVerses] = useState<number[]>([]);
  const multiSelectedVersesRef = useRef<number[]>([]);
  multiSelectedVersesRef.current = multiSelectedVerses;
  const onSaveActionRef = useRef<(() => void) | null>(null);
  const onRemoveActionRef = useRef<(() => void) | null>(null);
  const [verseHighlights, setVerseHighlights] = useState<Record<string, string>>({});
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [versionOrder, setVersionOrder] = useState<('ara'|'arc'|'kjv'|'dby')[]>(['ara','arc','kjv','dby']);
  useEffect(() => {
    AsyncStorage.getItem('versionOrder').then(val => {
      if (val) {
        try { setVersionOrder(JSON.parse(val)); } catch {}
      }
    });
  }, []);
  const updateVersionOrder = (next: ('ara'|'arc'|'kjv'|'dby')[]) => {
    setVersionOrder(next);
    AsyncStorage.setItem('versionOrder', JSON.stringify(next));
  };
  const [showVersionOrderConfig, setShowVersionOrderConfig] = useState(false);
  const [activeStudyVerse, setActiveStudyVerse] = useState<number | null>(null);
  const [showOptionsSheet, setShowOptionsSheet] = useState(false);
  const [showNoteDetailsModal, setShowNoteDetailsModal] = useState(false);
  const [previewLinkedVerse, setPreviewLinkedVerse] = useState<any>(null);
  const [detailMode, setDetailMode] = useState<'note' | 'links' | 'versions'>('note');

  // Split-Screen & Comparison Layout
  // Layout mode: 'stacked' (all translations in one vertical block) or 'split' (2 translations side-by-side)
  const [layoutMode, setLayoutMode] = useState<'stacked' | 'split'>('stacked');
  const [primaryVersion, setPrimaryVersion] = useState<'ara' | 'arc' | 'kjv' | 'dby'>('ara');
  const [secondaryVersion, setSecondaryVersion] = useState<'ara' | 'arc' | 'kjv' | 'dby'>('kjv');

  const [noteText, setNoteText] = useState('');
  const [selectedVerseNotes, setSelectedVerseNotes] = useState<Note[]>([]);
  const [selectedVerseNoteGroups, setSelectedVerseNoteGroups] = useState<NoteGroup[]>([]);
  const [noteModalTab, setNoteModalTab] = useState<'notes' | 'links'>('notes');
  const [noteCarouselIdx, setNoteCarouselIdx] = useState(0);
  const [groupCarouselIdx, setGroupCarouselIdx] = useState<Record<number, number>>({});
  const [modalNoteTypeFilter, setModalNoteTypeFilter] = useState<'individual' | 'group'>('individual');
  const [modalLinkTypeFilter, setModalLinkTypeFilter] = useState<'individual' | 'group'>('individual');
  const [selectedVerseBlockLinks, setSelectedVerseBlockLinks] = useState<BlockLink[]>([]);
  const [selectedVerseIncomingLinks, setSelectedVerseIncomingLinks] = useState<BlockLink[]>([]);
  const [linkDetailModal, setLinkDetailModal] = useState<{ link: BlockLink; isIncoming: boolean } | null>(null);
  const selectedVerseRef = useRef<Verse | null>(null);
  const showNoteDetailsModalRef = useRef(false);
  const navigatedToStudyRef = useRef(false);
  const navigatedToSaveSheetRef = useRef(false);

  selectedVerseRef.current = selectedVerse;
  showNoteDetailsModalRef.current = showNoteDetailsModal;
  const pendingBadgeUpdateRef = useRef<(() => void) | null>(null);

  const openNoteModal = (item: Verse) => {
    const blockLinks = getBlockLinksFromVerse(item.book_id, item.chapter, item.verse);
    const incomingLinks = getBlockLinksToVerse(item.book_id, item.chapter, item.verse);
    const notes = getNotesByVerse(item.book_id, item.chapter, item.verse);
    const noteGroups = getNoteGroupsByVerse(item.book_id, item.chapter, item.verse);
    setSelectedVerse({ ...item });
    setSelectedVerseNotes(notes);
    setSelectedVerseNoteGroups(noteGroups);
    setSelectedVerseBlockLinks(blockLinks);
    setSelectedVerseIncomingLinks(incomingLinks);
    setNoteCarouselIdx(0);
    setGroupCarouselIdx({});
    setNoteModalTab((notes.length > 0 || noteGroups.some(g => g.content?.trim())) ? 'notes' : (blockLinks.length > 0 ? 'links' : 'notes'));
    const hasIndividual = notes.length > 0;
    const hasGroup = noteGroups.some(g => g.content?.trim());
    setModalNoteTypeFilter(hasGroup && !hasIndividual ? 'group' : 'individual');
    const hasIndLink = [...blockLinks, ...incomingLinks].some(l => l.src_verses.length === 1);
    const hasGrpLink = [...blockLinks, ...incomingLinks].some(l => l.src_verses.length > 1);
    setModalLinkTypeFilter(hasGrpLink && !hasIndLink ? 'group' : 'individual');
    setShowNoteDetailsModal(true);
  };

  // Sync refs for use in stable callbacks
  activeSelectedVerseStateRef.current = activeSelectedVerse;
  verseHighlightsRef.current = verseHighlights;
  const primaryVersionRef = useRef(primaryVersion);
  const secondaryVersionRef = useRef(secondaryVersion);
  const layoutModeRef = useRef(layoutMode);
  const activeColorRef = useRef(activeColor);
  primaryVersionRef.current = primaryVersion;
  globalVersionRef.current = primaryVersion;
  secondaryVersionRef.current = secondaryVersion;
  layoutModeRef.current = layoutMode;
  activeColorRef.current = activeColor;

  const updateVerseContext = useCallback((verse: Verse | null, color: string | null, selectedNumsOverride?: number[]) => {
    if (!verse) { verseContextRef.set(null); return; }

    const doSave = () => {
      const v = activeSelectedVerseRef.current;
      if (!v) return;
      const allNums = [...new Set([...multiSelectedVersesRef.current])].sort((a, b) => a - b);
      const verseNums = allNums;
      saveSheetRef.bookId = v.book_id;
      saveSheetRef.chapter = v.chapter;
      saveSheetRef.verseNums = verseNums;
      saveSheetRef.version = primaryVersionRef.current;
      saveSheetRef.bookDisplayName = selectedBookRef.current ? bookName(selectedBookRef.current.name_pt, selectedBookRef.current.name_en) : '';
      const activeVersForSaveMode = layoutModeRef.current === 'split' ? [primaryVersionRef.current, secondaryVersionRef.current] : [primaryVersionRef.current];
      const currentVersesForSaveMode = selectedBookRef.current ? getVerses(selectedBookRef.current.id, selectedChapterRef.current, activeVersForSaveMode) : [];
      const chapterGroupNums = new Set(getNoteGroupsForChapter(selectedBookRef.current!.id, selectedChapterRef.current).keys());
      const isVerseStored = (n: number) => !!(currentVersesForSaveMode.find(x => x.verse === n)?.is_favorite) || chapterGroupNums.has(n);
      const allSavedCheck = verseNums.length > 0 && verseNums.every(isVerseStored);
      const noneSavedCheck = verseNums.length === 0 || verseNums.every(n => !isVerseStored(n));
      saveSheetRef.saveMode = allSavedCheck ? 'remove' : noneSavedCheck ? 'save' : 'update';
      // detect group merge
      const activeVersForGroup = [primaryVersionRef.current];
      const currentVersesForGroup = getVerses(selectedBookRef.current!.id, selectedChapterRef.current, activeVersForGroup);
      const allGroupVerses = verseNums.map(vn => { const vv = currentVersesForGroup.find(x => x.verse === vn); return vv ? { book_id: vv.book_id, chapter: vv.chapter, verse: vv.verse } : null; }).filter(Boolean) as Array<{ book_id: number; chapter: number; verse: number }>;
      const existingGroupIds = getGroupIdsForVerses(allGroupVerses);
      if (existingGroupIds.length > 0 && allGroupVerses.length > 0) {
        const buildRangeLabel = (nums: number[]) => { const s = nums[0], e = nums[nums.length - 1]; return s === e ? String(s) : `${s}-${e}`; };
        const allExistingGroups = allGroupVerses.flatMap(av => getNoteGroupsByVerse(av.book_id, av.chapter, av.verse));
        const seenIds = new Set<number>();
        const uniqueGroups = allExistingGroups.filter(g => { if (seenIds.has(g.id)) return false; seenIds.add(g.id); return true; });
        const groupLabels = existingGroupIds.map(gid => {
          const grp = uniqueGroups.find(g => g.id === gid);
          const nums = (grp?.verses ?? []).map(vv => vv.verse).sort((a, b) => a - b);
          return nums.length > 0 ? buildRangeLabel(nums) : null;
        }).filter(Boolean);
        const existingLabel = groupLabels.join(' e ');
        const existingGroupVerseSet = new Set(uniqueGroups.flatMap(g => (g.verses ?? []).map(vv => vv.verse)));
        const newVerseNums = verseNums.filter(n => !existingGroupVerseSet.has(n));
        saveSheetRef.groupMergeInfo = { groupIds: existingGroupIds, existingLabel, allVerses: allGroupVerses, newVerseNums };
      } else {
        saveSheetRef.groupMergeInfo = null;
      }
      saveSheetRef.onConfirm = (color: string | null) => {
        const activeVers = layoutModeRef.current === 'split' ? [primaryVersionRef.current, secondaryVersionRef.current] : [primaryVersionRef.current];
        const currentVerses = getVerses(selectedBookRef.current!.id, selectedChapterRef.current, activeVers);
        const mergeInfo = saveSheetRef.groupMergeInfo;
        // versos já pertencentes ao grupo existente não precisam de toggleFavorite/updateSavedNoColor
        const existingGroupVerseNums = mergeInfo
          ? (mergeInfo.allVerses.filter(vv => !verseNums.includes(vv.verse)).map(vv => vv.verse))
          : [];
        verseNums.forEach(verseNum => {
          const vv = currentVerses.find(x => x.verse === verseNum);
          if (!vv) return;
          if (color) {
            const key = `${vv.book_id}_${vv.chapter}_${vv.verse}`;
            saveHighlight(vv.book_id, vv.chapter, vv.verse, color);
            bibleReaderRef.current?.updateVerseHighlight(vv.verse, color);
            setVerseHighlights(prev => ({ ...prev, [key]: color }));
          }
          if (!vv.is_favorite) toggleFavorite(vv.book_id, vv.chapter, vv.verse);
        });
        if (mergeInfo) {
          const { groupIds, allVerses } = mergeInfo;
          mergeNoteGroups(groupIds, allVerses, '');
          saveSheetRef.groupMergeInfo = null;
        } else if (verseNums.length > 1) {
          // new group: create it
          const groupVerseObjs = verseNums.map(vn => {
            const vv = currentVerses.find(x => x.verse === vn);
            return vv ? { book_id: vv.book_id, chapter: vv.chapter, verse: vv.verse } : null;
          }).filter(Boolean) as Array<{ book_id: number; chapter: number; verse: number }>;
          addNoteGroup('', groupVerseObjs);
        }
        dbModifiedRef.modified = true;
        invalidateVersesCache();
        bibleReaderRef.current?.clearMultiSelect();
        multiSelectedVersesRef.current = [];
        setMultiSelectedVerses([]);
        activeSelectedVerseRef.current = null;
        setActiveSelectedVerse(null);
        setActiveColor(null);
        verseContextRef.set(null);
        bibleReaderRef.current?.clearSelection();
        const noColorVerses = verseNums.filter(verseNum => {
          const key = `${selectedBookRef.current!.id}_${selectedChapterRef.current}_${verseNum}`;
          return !color && !verseHighlightsRef.current[key];
        });
        if (noColorVerses.length > 0) {
          bibleReaderRef.current?.updateSavedNoColor(noColorVerses);
        }
      };
      navigatedToSaveSheetRef.current = true;
      router.push('/save-sheet' as any);
    };

    const doRemove = () => {
      const activeVers = layoutModeRef.current === 'split' ? [primaryVersionRef.current, secondaryVersionRef.current] : [primaryVersionRef.current];
      invalidateVersesCache();
      const currentVerses = getVerses(selectedBookRef.current!.id, selectedChapterRef.current, activeVers);
      const allNums = [...new Set([...multiSelectedVersesRef.current])].sort((a, b) => a - b);
      // collect all verse objects for selected nums
      const selectedVerseObjs = allNums.map(n => currentVerses.find(x => x.verse === n)).filter(Boolean) as typeof currentVerses;
      // find groups that contain any selected verse and collect all their member verses
      const groupMemberVerses = new Set<number>();
      const deletedGroupIds = new Set<number>();
      for (const vv of selectedVerseObjs) {
        const groups = getNoteGroupsByVerse(vv.book_id, vv.chapter, vv.verse);
        for (const g of groups) {
          if (deletedGroupIds.has(g.id)) continue;
          deletedGroupIds.add(g.id);
          if (g.verses) g.verses.forEach(gv => groupMemberVerses.add(gv.verse));
          deleteNoteGroup(g.id);
        }
      }
      // all verses to clear: selected + group members
      const allToClear = new Set([...allNums, ...groupMemberVerses]);
      allToClear.forEach(verseNum => {
        const vv = currentVerses.find(x => x.verse === verseNum);
        if (!vv) return;
        if (vv.is_favorite) toggleFavorite(vv.book_id, vv.chapter, vv.verse);
        bibleReaderRef.current?.removeSavedNoColor([vv.verse]);
      });
      invalidateVersesCache();
      // update group state immediately so updateBadges fires and markers are removed
      const rawGroupNoteMap = getNoteGroupsForChapter(selectedBookRef.current!.id, selectedChapterRef.current);
      const newGroupNote = new Set(rawGroupNoteMap.keys());
      const newGroupNoteWithNotes = new Set<number>();
      rawGroupNoteMap.forEach((groups, verse) => { if (groups.some(g => parseGroupNotes(g.content ?? '').length > 0)) newGroupNoteWithNotes.add(verse); });
      setGroupNoteVerseNums(newGroupNote);
      setGroupNoteWithNotesVerseNums(newGroupNoteWithNotes);
      setGroupCorrVerseNums(getBlockLinkGroupSrcVerseNumsForChapter(selectedBookRef.current!.id, selectedChapterRef.current));
      setTgtVerseNums(getBlockLinkTgtVerseNumsForChapter(selectedBookRef.current!.id, selectedChapterRef.current));
      const newNoteNums = new Set(getVerses(selectedBookRef.current!.id, selectedChapterRef.current, activeVers).filter(v => !!v.note_content).map(v => v.verse));
      setNoteVerseNums(newNoteNums);
      dbModifiedRef.modified = false;
      bibleReaderRef.current?.clearMultiSelect();
      multiSelectedVersesRef.current = [];
      setMultiSelectedVerses([]);
      activeSelectedVerseRef.current = null;
      setActiveSelectedVerse(null);
      setActiveColor(null);
      verseContextRef.set(null);
      bibleReaderRef.current?.clearSelection();
    };

    onSaveActionRef.current = doSave;
    onRemoveActionRef.current = doRemove;

    const getFreshContext = (vObj: Verse, col: string | null, selectedNumsOverride?: number[]): any => {
      const activeVersForCtx = layoutModeRef.current === 'split' ? [primaryVersionRef.current, secondaryVersionRef.current] : [primaryVersionRef.current];
      invalidateVersesCache();
      const currentVersesForCtx = selectedBookRef.current ? getVerses(selectedBookRef.current.id, selectedChapterRef.current, activeVersForCtx) : [];
      const selectedNums = selectedNumsOverride ?? multiSelectedVersesRef.current;
      const ctxGroupNums = new Set(getNoteGroupsForChapter(selectedBookRef.current!.id, selectedChapterRef.current).keys());
      const isCtxStored = (n: number) => !!(currentVersesForCtx.find(x => x.verse === n)?.is_favorite) || ctxGroupNums.has(n);
      const allSaved = selectedNums.length > 0 && selectedNums.every(isCtxStored);
      const noneSaved = selectedNums.length === 0 || selectedNums.every(n => !isCtxStored(n));
      const saveMode: 'save' | 'remove' | 'update' = allSaved ? 'remove' : noneSaved ? 'save' : 'update';
      return ({
      label: selectedBookRef.current ? `${bookName(selectedBookRef.current.name_pt, selectedBookRef.current.name_en)} ${vObj.chapter}:${vObj.verse}` : '',
      activeColor: col,
      isFavorite: !!vObj.is_favorite,
      isMultiSelectMode: false,
      multiSelectedCount: multiSelectedVersesRef.current.length,
      saveMode,
      onEnterMultiSelect: () => {},
      onConfirmMultiSelect: () => {},
      onRemove: doRemove,
      onSave: doSave,
      onAnnotation: () => {
        const v = activeSelectedVerseRef.current;
        if (!v) return;
        const selected = multiSelectedVersesRef.current;
        const bName = selectedBookRef.current ? bookName(selectedBookRef.current.name_pt, selectedBookRef.current.name_en) : '';
        const activeVers = layoutModeRef.current === 'split' ? [primaryVersionRef.current, secondaryVersionRef.current] : [primaryVersionRef.current];
        const currentVerses = getVerses(selectedBookRef.current!.id, selectedChapterRef.current, activeVers);
        if (selected.length > 1) {
          const groupVs = selected.map(vn => {
            const vv = currentVerses.find(x => x.verse === vn);
            return vv ? { book_id: vv.book_id, chapter: vv.chapter, verse: vv.verse } : null;
          }).filter(Boolean) as Array<{ book_id: number; chapter: number; verse: number }>;
          activeStudyVerseRef.set(v, bName, primaryVersionRef.current, 'note', null, groupVs);
        } else {
          activeStudyVerseRef.set(v, bName, primaryVersionRef.current, 'note');
        }
        navigatedToStudyRef.current = true; router.navigate('/study');
      },
      onLink: () => {
        const v = activeSelectedVerseRef.current;
        if (!v) return;
        const selected = multiSelectedVersesRef.current;
        const bName = selectedBookRef.current ? bookName(selectedBookRef.current.name_pt, selectedBookRef.current.name_en) : '';
        const activeVers = layoutModeRef.current === 'split' ? [primaryVersionRef.current, secondaryVersionRef.current] : [primaryVersionRef.current];
        const currentVerses = getVerses(selectedBookRef.current!.id, selectedChapterRef.current, activeVers);
        if (selected.length > 1) {
          const groupVs = selected.map(vn => {
            const vv = currentVerses.find(x => x.verse === vn);
            return vv ? { book_id: vv.book_id, chapter: vv.chapter, verse: vv.verse } : null;
          }).filter(Boolean) as Array<{ book_id: number; chapter: number; verse: number }>;
          activeStudyVerseRef.set(v, bName, primaryVersionRef.current, 'links', null, groupVs);
        } else {
          activeStudyVerseRef.set(v, bName, primaryVersionRef.current, 'links');
        }
        navigatedToStudyRef.current = true; router.navigate('/study');
      },
      onCopy: () => {
        const v = activeSelectedVerseRef.current;
        if (!v) return;
        Clipboard.setString(`[${primaryVersionRef.current.toUpperCase()}] ${selectedBookRef.current ? bookName(selectedBookRef.current.name_pt, selectedBookRef.current.name_en) : ''} ${v.chapter}:${v.verse} - "${getVerseText(v, primaryVersionRef.current)}"`);
      },
      onFavoriteToggle: () => {
        const v = activeSelectedVerseRef.current;
        if (!v) return;
        Vibration.vibrate(20);
        toggleFavorite(v.book_id, v.chapter, v.verse);
        dbModifiedRef.modified = true;

        const activeVers = layoutModeRef.current === 'split' ? [primaryVersionRef.current, secondaryVersionRef.current] : [primaryVersionRef.current];
        const loaded = getVerses(selectedBookRef.current!.id, selectedChapterRef.current, activeVers);
        setVerses(loaded);

        const updated = loaded.find(x => x.verse === v.verse);
        if (updated) {
          setActiveSelectedVerse(updated);
          verseContextRef.set(getFreshContext(updated, activeColorRef.current));
        }
      },
      onClose: () => {
        multiSelectedVersesRef.current = [];
        setMultiSelectedVerses([]);
        activeSelectedVerseRef.current = null;
        setActiveSelectedVerse(null);
        setActiveColor(null);
        bibleReaderRef.current?.clearMultiSelect();
        verseContextRef.set(null);
      },
      onColorSelect: (c: string) => {
        const v = activeSelectedVerseRef.current;
        if (!v) return;
        setActiveColor(c);
        const activeVers = layoutModeRef.current === 'split' ? [primaryVersionRef.current, secondaryVersionRef.current] : [primaryVersionRef.current];
        const currentVerses = getVerses(selectedBookRef.current!.id, selectedChapterRef.current, activeVers);
        const allNums = [...new Set(multiSelectedVersesRef.current)];
        const newHighlights: Record<string, string> = {};
        allNums.forEach(verseNum => {
          const vv = currentVerses.find(x => x.verse === verseNum);
          if (!vv) return;
          const key = `${vv.book_id}_${vv.chapter}_${vv.verse}`;
          newHighlights[key] = c;
          saveHighlight(vv.book_id, vv.chapter, vv.verse, c);
          bibleReaderRef.current?.updateVerseHighlight(vv.verse, c);
          bibleReaderRef.current?.removeSavedNoColor([vv.verse]);
          if (!vv.is_favorite) toggleFavorite(vv.book_id, vv.chapter, vv.verse);
        });
        setVerseHighlights(prev => ({ ...prev, ...newHighlights }));
        dbModifiedRef.modified = true;
        const loaded = getVerses(selectedBookRef.current!.id, selectedChapterRef.current, activeVers);
        setVerses(loaded);
        const updated = loaded.find(x => x.verse === v.verse);
        if (updated) {
          setActiveSelectedVerse(updated);
          verseContextRef.set(getFreshContext(updated, c, allNums));
        }
      },
      onColorClear: () => {
        const v = activeSelectedVerseRef.current;
        if (!v) return;
        setActiveColor(null);
        const activeVers = layoutModeRef.current === 'split' ? [primaryVersionRef.current, secondaryVersionRef.current] : [primaryVersionRef.current];
        const currentVerses = getVerses(selectedBookRef.current!.id, selectedChapterRef.current, activeVers);
        const allNums = [...new Set(multiSelectedVersesRef.current)];
        allNums.forEach(verseNum => {
          const vv = currentVerses.find(x => x.verse === verseNum);
          if (!vv) return;
          const key = `${vv.book_id}_${vv.chapter}_${vv.verse}`;
          saveHighlight(vv.book_id, vv.chapter, vv.verse, '');
          bibleReaderRef.current?.updateVerseHighlight(vv.verse, null);
          setVerseHighlights(prev => { const n = { ...prev }; delete n[key]; return n; });
          if (vv.is_favorite && !vv.note_content) {
            toggleFavorite(vv.book_id, vv.chapter, vv.verse);
            bibleReaderRef.current?.removeSavedNoColor([vv.verse]);
          }
        });
        dbModifiedRef.modified = true;
        const loaded = getVerses(selectedBookRef.current!.id, selectedChapterRef.current, activeVers);
        setVerses(loaded);
        const updated = loaded.find(x => x.verse === v.verse);
        if (updated) {
          setActiveSelectedVerse(updated);
          verseContextRef.set(getFreshContext(updated, null, allNums));
        }
      },
    });
  };

  verseContextRef.set(getFreshContext(verse, color, selectedNumsOverride));
}, []);

  const handleVersePress = useCallback((item: Verse) => {
    const highlights = verseHighlightsRef.current;
    const highlightKey = `${item.book_id}_${item.chapter}_${item.verse}`;
    const savedColor = highlights[highlightKey] || null;
    interlinearVerseRef.current = null;
    savedVerseBeforeInterlinearRef.current = null;

    const current = multiSelectedVersesRef.current;
    const alreadyIn = current.includes(item.verse);

    if (alreadyIn) {
      const next = current.filter(v => v !== item.verse);
      multiSelectedVersesRef.current = next;
      setMultiSelectedVerses(next);
      bibleReaderRef.current?.toggleMultiSelect(item.verse);
      if (next.length === 0) {
        activeSelectedVerseRef.current = null;
        setActiveSelectedVerse(null);
        setActiveColor(null);
        verseContextRef.set(null);
      } else {
        const keepVerse = activeSelectedVerseRef.current ?? item;
        const keepColor = activeColorRef.current;
        updateVerseContext(keepVerse, keepColor, next);
      }
    } else {
      const next = [...current, item.verse];
      multiSelectedVersesRef.current = next;
      setMultiSelectedVerses(next);
      bibleReaderRef.current?.toggleMultiSelect(item.verse);
      activeSelectedVerseRef.current = item;
      setActiveSelectedVerse(item);
      setActiveColor(savedColor);
      setHighlightedVerse(null);
      setActiveStudyVerse(null);
      setInterlinearVerse(null);
      updateVerseContext(item, savedColor, next);
    }
  }, [updateVerseContext]);


  useEffect(() => {
    tabBarVisibilityRef.hidden = showDetailSheet;
  }, [showDetailSheet]);

  // Gesto/botão voltar do Android limpa seleção múltipla
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isFocusedRef.current) return false;
      if (activeSelectedVerseRef.current) {
        multiSelectedVersesRef.current = [];
        setMultiSelectedVerses([]);
        activeSelectedVerseRef.current = null;
        setActiveSelectedVerse(null);
        setActiveColor(null);
        bibleReaderRef.current?.clearMultiSelect();
        verseContextRef.set(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  // sempre atualiza o ref primeiro
  activeSelectedVerseRef.current = activeSelectedVerse;

  useEffect(() => {
    updateVerseContext(activeSelectedVerse, activeColor, multiSelectedVersesRef.current.length > 0 ? multiSelectedVersesRef.current : undefined);
  }, [activeSelectedVerse, activeColor, updateVerseContext]);

  // 1. Initialize DB + restore last position (parallelized)
  useEffect(() => {
    async function setup() {
      try {
        const posPath = FileSystem.documentDirectory + 'lastPosition.json';
        const highlightsPath = FileSystem.documentDirectory + 'highlights.json';
        console.log('[Setup] start');
        const t0 = Date.now();
        const [, saved, savedHighlights] = await Promise.all([
          initializeDatabase(),
          FileSystem.readAsStringAsync(posPath).catch(() => null),
          FileSystem.readAsStringAsync(highlightsPath).catch(() => null),
        ]);
        console.log('[Setup] initializeDatabase done in', Date.now() - t0, 'ms');
        const allBooks = getBooks();
        let bookToLoad = allBooks[0];
        let chapterToLoad = 1;
        if (saved) {
          try {
            const { bookId, chapter } = JSON.parse(saved);
            bookToLoad = allBooks.find(b => b.id === bookId) ?? allBooks[0];
            chapterToLoad = chapter ?? 1;
          } catch (_) {}
        }
        if (savedHighlights) {
          try {
            setVerseHighlights(JSON.parse(savedHighlights));
          } catch (_) {}
        }
        setBooks(allBooks);
        setSelectedBook(bookToLoad);
        setSelectedChapter(chapterToLoad);
        setDbReady(true);
      } catch (err) {
        console.error('Error during database initialization:', err);
      }
    }
    setup();
  }, []);

  const scrollToVerseNow = useCallback((verseNum: number) => {
    const el = verseRefsMap.current[verseNum];
    const sv = (flatListRef as any).current;
    if (!el || !sv) return;
    const scrollNode = sv.getNativeScrollRef?.() ?? sv.getInnerViewNode?.() ?? sv;
    el.measureLayout(scrollNode, (_x: number, y: number) => {
      sv.scrollTo({ y, animated: false });
    }, () => {
      el.measure((_fx: number, _fy: number, _w: number, _h: number, _px: number, py: number) => {
        sv.measure((_sfx: number, _sfy: number, _sw: number, _sh: number, _spx: number, spy: number) => {
          const currentOffset = (sv as any)._scrollAnimatedValue?.__getValue?.() ?? 0;
          sv.scrollTo({ y: py - spy + currentOffset, animated: false });
        });
      });
    });
  }, []);

  // Deep linking and direct navigation helper
  const navigateToVerse = (bookId: number, chapter: number, verse: number) => {
    const targetBook = books.find(b => b.id === bookId);
    if (!targetBook) return;

    setSelectedBook(targetBook);
    setSelectedChapter(chapter);

    scrollToVerseRef.current = verse;
    setHighlightedVerse(verse);

    setShowDetailSheet(false);
    setActiveSelectedVerse(null);
  };

  useEffect(() => {
    selectorNavigationRef.navigate = (bookId, chapter, verse) => {
      const targetBook = books.find(b => b.id === bookId);
      if (!targetBook) return;
      const isSameLocation = targetBook.id === selectedBook?.id && chapter === selectedChapter;
      setSelectedBook(targetBook);
      setSelectedChapter(chapter);
      setShowDetailSheet(false);
      setActiveSelectedVerse(null);
      if (verse !== undefined) {
        currentVerseRef.current = verse;
        setHighlightedVerse(verse);
        if (isSameLocation) {
          if (layoutModeRef.current === 'stacked') {
            bibleReaderRef.current?.scrollToVerse(verse);
          } else {
            scrollToVerseNow(verse);
          }
        } else {
          scrollToVerseRef.current = verse;
        }
      } else {
        setHighlightedVerse(null);
        if (isSameLocation) {
          if (layoutModeRef.current === 'stacked') {
            bibleReaderRef.current?.scrollToVerse(1);
          } else {
            (flatListRef as any).current?.scrollTo({ y: 0, animated: false });
          }
        } else {
          scrollToVerseRef.current = 1;
        }
      }
    };
    return () => { selectorNavigationRef.navigate = null; };
  }, [books, selectedBook, selectedChapter]);

  useEffect(() => {
    if (dbReady && books.length > 0 && params.bookId && params.chapter) {
      const bookIdNum = Number(params.bookId);
      const chapterNum = Number(params.chapter);
      const verseNum = params.verse ? Number(params.verse) : undefined;
      const shouldLink = params.openLinkSelector === 'true';
      
      const targetBook = books.find(b => b.id === bookIdNum);
      if (targetBook) {
        const isSameLocation = targetBook.id === selectedBook?.id && chapterNum === selectedChapter;
        if (!isSameLocation) {
          setUseFlashList(false);
          setListOpacity(0);
        }
        setSelectedBook(targetBook);
        setSelectedChapter(chapterNum);
        if (shouldLink && verseNum !== undefined) {
          const verseObj = getVerse(bookIdNum, chapterNum, verseNum);
          if (verseObj) {
            setSelectedVerse(verseObj);
            setIsLinkingFromSelector(true);
            setShowSelector(true);
          }
        } else if (verseNum !== undefined) {
          setHighlightedVerse(verseNum);
          if (chapterNum === selectedChapter && targetBook.id === selectedBook?.id) {
            scrollToVerseNow(verseNum);
          } else {
            scrollToVerseRef.current = verseNum;
          }
        } else {
          setHighlightedVerse(null);
          scrollToVerseRef.current = null;
          (flatListRef as any).current?.scrollTo({ y: 0, animated: false });
        }
        // Clear params to avoid recursive loops
        router.setParams({ bookId: undefined, chapter: undefined, verse: undefined, openLinkSelector: undefined });
      }
    }
  }, [dbReady, books, params]);

  const saveHighlight = async (bookId: number, chapter: number, verse: number, color: string | null) => {
    const key = `${bookId}_${chapter}_${verse}`;
    const newHighlights = { ...verseHighlights };
    if (color) {
      newHighlights[key] = color;
    } else {
      delete newHighlights[key];
    }
    setVerseHighlights(newHighlights);
    const path = FileSystem.documentDirectory + 'highlights.json';
    await FileSystem.writeAsStringAsync(path, JSON.stringify(newHighlights)).catch(() => {});
  };

  // 2. Load Chapters & Verses when book/chapter changes
  useEffect(() => {
    if (!dbReady || !selectedBook) return;

    const count = getChaptersCount(selectedBook.id);
    setChaptersCount(count);

    // Ensure selected chapter is valid
    const chap = Math.min(Math.max(1, selectedChapter), count);
    if (chap !== selectedChapter) {
      setSelectedChapter(chap);
    }

    setExpandedVerse(null);
    itemOffsetsRef.current = [];
    verseRefsMap.current = {};
    pendingScrollVerseRef.current = null;
    setInitialScrollIndex(undefined);
    const activeVers = layoutMode === 'split' ? [primaryVersion, secondaryVersion] : [primaryVersion];
    const loadedVerses = getVerses(selectedBook.id, chap, activeVers);
    setVerses(loadedVerses);
    setCorrelatedVerseNums(getBlockLinkSrcVerseNumsForChapter(selectedBook.id, chap));
    setNoteVerseNums(new Set(loadedVerses.filter(v => !!v.note_content).map(v => v.verse)));
    const rawGroupNotes1 = getNoteGroupsForChapter(selectedBook.id, chap);
    const allGroupNums1 = new Set(rawGroupNotes1.keys());
    const withNotesNums1 = new Set<number>();
    rawGroupNotes1.forEach((groups, verse) => { if (groups.some(g => parseGroupNotes(g.content ?? '').length > 0)) withNotesNums1.add(verse); });
    setGroupNoteVerseNums(allGroupNums1);
    setGroupNoteWithNotesVerseNums(withNotesNums1);
    setGroupCorrVerseNums(getBlockLinkGroupSrcVerseNumsForChapter(selectedBook.id, chap));
    setTgtVerseNums(getBlockLinkTgtVerseNumsForChapter(selectedBook.id, chap));
    FileSystem.writeAsStringAsync(
      FileSystem.documentDirectory + 'lastPosition.json',
      JSON.stringify({ bookId: selectedBook.id, chapter: chap })
    ).catch(() => {});

  }, [dbReady, selectedBook, selectedChapter, primaryVersion, secondaryVersion, layoutMode]);

  const buildChapterHtml = useCallback((versesToRender: Verse[], version: string, highlights: Record<string, string>, correlatedNums: Set<number>, noteVerseNums: Set<number>, groupNoteNums: Set<number> = new Set(), groupCorrNums: Set<number> = new Set(), groupNoteWithNotesNums: Set<number> = new Set(), tgtNums: Set<number> = new Set()) => {
    const bookSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`;
    const noteSvgBlue = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    const noteSvgYellow = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    const linkSvgBlue = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
    const linkSvgYellow = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
    return versesToRender.map((item) => {
      const text = item[`text_${version}` as keyof Verse] as string ?? item.text_ara;
      const key = `${item.book_id}_${item.chapter}_${item.verse}`;
      const color = highlights[key];
      const isGroupVerse = groupNoteNums.has(item.verse) || groupCorrNums.has(item.verse);
      const hasGroupNoteWithNotes = groupNoteWithNotesNums.has(item.verse);
      const isSavedNoColor = (item.is_favorite || hasGroupNoteWithNotes) && !color;
      const barColor = hasGroupNoteWithNotes ? '#F59E0B' : 'var(--accent)';
      const bgStyle = color ? `background-color:${color}33;border-radius:4px;padding:0 4px;` : (isSavedNoColor ? `border-left:3px solid ${barColor};padding-left:8px;` : '');
      const hasNote = noteVerseNums.has(item.verse);
      const hasCorr = correlatedNums.has(item.verse);
      const hasGroupNote = groupNoteWithNotesNums.has(item.verse); // for note icon: only if group has actual notes
      const hasGroupCorr = groupCorrNums.has(item.verse);
      const isGroup = isGroupVerse; // already computed from full groupNoteNums+groupCorrNums
      const hasIndividual = hasNote || hasCorr;
      const isSaved = !!item.is_favorite || isGroup;
      const hasAnnotation = hasNote || hasCorr || isGroup || isSaved;
      const numBg = isGroup ? '#F59E0B' : 'var(--accent)';
      const numClass = hasAnnotation ? 'verse-num verse-num--marked' : 'verse-num';
      const numStyle = hasAnnotation ? ` style="border-radius:4px;min-width:1.6em;height:1.6em;padding:0 4px;line-height:1.6em;background-color:${numBg};color:#fff;text-align:center;display:inline-flex;align-items:center;justify-content:center;"` : '';
      const dotBlue = (isGroup && hasIndividual) ? `<span class="group-dot" style="width:6px;height:6px;border-radius:3px;background-color:${colors.accent};display:inline-block;margin-left:3px;flex-shrink:0;vertical-align:middle;"></span>` : '';
      const numOnClick = hasAnnotation ? ` onclick="event.stopPropagation();onVerseNumClick(${item.verse})"` : '';
      const showNoteIcon = hasNote || hasGroupNote;
      const showCorrIcon = hasCorr || hasGroupCorr;
      const hasTgt = tgtNums.has(item.verse);
      const returnSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>`;
      const badges = (hasTgt ? `<span style="display:inline-flex;align-items:center;padding:2px 3px;" onclick="event.stopPropagation();onReturnIconClick(${item.verse})">${returnSvg}</span>` : '') + (showNoteIcon ? `<span style="display:inline-flex;align-items:center;padding:2px 3px;">${noteSvgBlue}</span>` : '') + (showCorrIcon ? `<span style="display:inline-flex;align-items:center;padding:2px 3px;">${linkSvgBlue}</span>` : '');
      return `<div class="verse" id="v${item.verse}" style="${bgStyle}" onclick="onVerseClick(${item.verse})"><div style="display:flex;flex-direction:row;align-items:center;justify-content:space-between;margin-bottom:4px;"><div style="display:inline-flex;flex-direction:row;align-items:center;"><span class="${numClass}"${numStyle}${numOnClick}>${item.verse}</span>${dotBlue}</div><span style="display:inline-flex;flex-direction:row;align-items:center;"><span class="verse-icons-badges" style="display:inline-flex;flex-direction:row;align-items:center;">${badges}</span><span class="compare-btn" onclick="event.stopPropagation();onVerseCompareClick(${item.verse})">${bookSvg}</span></span></div><div class="verse-text">${text}</div></div>`;
    }).join('');
  }, []);

  const chapterJustLoadedRef = useRef(false);

  useEffect(() => {
    if (verses.length === 0) return;
    isNavigatingRef.current = false;
    chapterJustLoadedRef.current = true;
    if (layoutMode === 'stacked') {
      const targetVerse = scrollToVerseRef.current ?? 1;
      scrollToVerseRef.current = null;
      const currentTgt = selectedBookRef.current
        ? getBlockLinkTgtVerseNumsForChapter(selectedBookRef.current.id, verses[0].chapter)
        : new Set<number>();
      const html = buildChapterHtml(verses, primaryVersion, verseHighlights, correlatedVerseNums, noteVerseNums, groupNoteVerseNums, groupCorrVerseNums, groupNoteWithNotesVerseNums, currentTgt);
      bibleReaderRef.current?.loadChapter(html, targetVerse);
      setListOpacity(1);
    } else {
      if (scrollToVerseRef.current === null) {
        setListOpacity(1);
      } else {
        scrollToVerseRef.current = null;
        setListOpacity(1);
      }
    }
  }, [verses, layoutMode]);

  const refreshBadges = useCallback((newCorrNums?: Set<number>) => {
    if (layoutMode !== 'stacked' || verses.length === 0) return;
    const corrNums = newCorrNums ?? correlatedVerseNums;
    const savedVerseNums = verses.filter(v => v.is_favorite).map(v => v.verse);
    bibleReaderRef.current?.updateBadges(Array.from(noteVerseNums), Array.from(corrNums), Array.from(groupNoteVerseNums), Array.from(groupCorrVerseNums), savedVerseNums, Array.from(groupNoteWithNotesVerseNums), Array.from(tgtVerseNums));
  }, [layoutMode, verses, correlatedVerseNums, noteVerseNums, groupNoteVerseNums, groupCorrVerseNums, groupNoteWithNotesVerseNums, tgtVerseNums]);

  useEffect(() => {
    if (!showNoteDetailsModal && layoutMode === 'stacked' && verses.length > 0) {
      if (pendingBadgeUpdateRef.current) {
        pendingBadgeUpdateRef.current();
        pendingBadgeUpdateRef.current = null;
      } else {
        const savedVerseNums = verses.filter(v => v.is_favorite).map(v => v.verse);
        bibleReaderRef.current?.updateBadges(Array.from(noteVerseNums), Array.from(correlatedVerseNums), Array.from(groupNoteVerseNums), Array.from(groupCorrVerseNums), savedVerseNums, Array.from(groupNoteWithNotesVerseNums), Array.from(tgtVerseNums));
      }
    }
  }, [showNoteDetailsModal]);

  useEffect(() => {
    if (layoutMode !== 'stacked' || verses.length === 0) return;
    if (chapterJustLoadedRef.current) {
      chapterJustLoadedRef.current = false;
      return;
    }
    const savedVerseNums = verses.filter(v => v.is_favorite).map(v => v.verse);
    bibleReaderRef.current?.updateBadges(Array.from(noteVerseNums), Array.from(correlatedVerseNums), Array.from(groupNoteVerseNums), Array.from(groupCorrVerseNums), savedVerseNums, Array.from(groupNoteWithNotesVerseNums), Array.from(tgtVerseNums));
  }, [correlatedVerseNums, noteVerseNums, groupNoteVerseNums, groupCorrVerseNums, groupNoteWithNotesVerseNums, tgtVerseNums]);

  const openSelector = () => router.push({
    pathname: '/selector',
    params: {
      bookId: selectedBook ? String(selectedBook.id) : '1',
      chapter: String(selectedChapter),
      verse: activeSelectedVerse ? String(activeSelectedVerse.verse) : undefined
    },
  });

  // Load note when selected verse changes
  useEffect(() => {
    if (selectedVerse) {
      setNoteText(selectedVerse.note_content || '');
    }
  }, [selectedVerse]);

  dbReadyRef.current = dbReady;
  selectedBookRef.current = selectedBook;
  selectedChapterRef.current = selectedChapter;

  // Reload verses when returning from annotation screen if database has been modified
  useFocusEffect(
    useCallback(() => {
      if (pendingNavigationRef.bookId !== null) {
        const { bookId, chapter, verse, version } = pendingNavigationRef;
        pendingNavigationRef.bookId = null;
        pendingNavigationRef.chapter = null;
        pendingNavigationRef.verse = undefined;
        pendingNavigationRef.version = null;
        readerNavigatingRef.current = false;
        if (version && version !== primaryVersionRef.current) {
          setPrimaryVersion(version);
          AsyncStorage.setItem('primaryVersion', version);
        }
        const isSameLocationPending = bookId === selectedBookRef.current?.id && chapter === selectedChapterRef.current;
        if (!isSameLocationPending) {
          setUseFlashList(false);
          setListOpacity(0);
        }
        selectorNavigationRef.navigate?.(bookId!, chapter!, verse);
        return;
      }
      const fromStudy = navigatedToStudyRef.current;
      const fromSaveSheet = navigatedToSaveSheetRef.current;
      navigatedToStudyRef.current = false;
      navigatedToSaveSheetRef.current = false;
      if (!fromStudy && !fromSaveSheet && !showNoteDetailsModalRef.current) {
        bibleReaderRef.current?.clearSelection();
        bibleReaderRef.current?.clearMultiSelect();
      } else if (fromStudy) {
        if (activeSelectedVerseRef.current) {
          const v = activeSelectedVerseRef.current;
          const col = activeColorRef.current;
          updateVerseContext(v, col);
          const savedNums = multiSelectedVersesRef.current;
          if (savedNums.length > 0) {
            bibleReaderRef.current?.clearMultiSelect();
            savedNums.forEach(n => bibleReaderRef.current?.toggleMultiSelect(n));
          } else {
            setTimeout(() => bibleReaderRef.current?.selectVerse(v.verse), 100);
          }
        }
      }
      if (dbReadyRef.current && selectedBookRef.current && dbModifiedRef.modified) {
        const activeVers = layoutModeRef.current === 'split' ? [primaryVersionRef.current, secondaryVersionRef.current] : [primaryVersionRef.current];
        const reloadedVerses = getVerses(selectedBookRef.current.id, selectedChapterRef.current, activeVers);
        verses.forEach((v, i) => { Object.assign(v, reloadedVerses[i] ?? {}); });
        setCorrelatedVerseNums(getBlockLinkSrcVerseNumsForChapter(selectedBookRef.current.id, selectedChapterRef.current));
        setNoteVerseNums(new Set(reloadedVerses.filter(v => !!v.note_content).map(v => v.verse)));
        const rawGroupNoteMap2 = getNoteGroupsForChapter(selectedBookRef.current.id, selectedChapterRef.current);
        const newGroupNoteNums = new Set(rawGroupNoteMap2.keys());
        const newGroupNoteWithNotesNums = new Set<number>();
        rawGroupNoteMap2.forEach((groups, verse) => { if (groups.some(g => parseGroupNotes(g.content ?? '').length > 0)) newGroupNoteWithNotesNums.add(verse); });
        setGroupNoteWithNotesVerseNums(newGroupNoteWithNotesNums);
        setGroupNoteVerseNums(newGroupNoteNums);
        setGroupCorrVerseNums(getBlockLinkGroupSrcVerseNumsForChapter(selectedBookRef.current.id, selectedChapterRef.current));
        setTgtVerseNums(getBlockLinkTgtVerseNumsForChapter(selectedBookRef.current.id, selectedChapterRef.current));
        dbModifiedRef.modified = false;
        // update sidebar bars: verses in groups or is_favorite without color
        const noColorToAdd = reloadedVerses.filter(v => {
          const key = `${v.book_id}_${v.chapter}_${v.verse}`;
          const hasColor = !!verseHighlightsRef.current[key];
          return !hasColor && (v.is_favorite || newGroupNoteNums.has(v.verse));
        }).map(v => v.verse);
        const noColorToRemove = reloadedVerses.filter(v => {
          const key = `${v.book_id}_${v.chapter}_${v.verse}`;
          const hasColor = !!verseHighlightsRef.current[key];
          return !hasColor && !v.is_favorite && !newGroupNoteNums.has(v.verse);
        }).map(v => v.verse);
        if (noColorToAdd.length > 0) bibleReaderRef.current?.updateSavedNoColor(noColorToAdd);
        if (noColorToRemove.length > 0) bibleReaderRef.current?.removeSavedNoColor(noColorToRemove);
        if (selectedVerseRef.current && showNoteDetailsModalRef.current) {
          setTimeout(() => bibleReaderRef.current?.selectVerse(selectedVerseRef.current!.verse), 300);
        }
      }
      if (selectedVerseRef.current && showNoteDetailsModalRef.current) {
        const notes = getNotesByVerse(selectedVerseRef.current.book_id, selectedVerseRef.current.chapter, selectedVerseRef.current.verse);
        const noteGroups = getNoteGroupsByVerse(selectedVerseRef.current.book_id, selectedVerseRef.current.chapter, selectedVerseRef.current.verse);
        setSelectedVerseNotes(notes);
        setSelectedVerseNoteGroups(noteGroups);
      }
      // Ao voltar do save-sheet sem confirmar, restaura o menu se ainda há versículos selecionados
      if (activeSelectedVerseRef.current && verseContextRef.current === null) {
        const v = activeSelectedVerseRef.current;
        const col = activeColorRef.current;
        updateVerseContext(v, col);
        const ctx = verseContextRef.current;
        if (ctx) verseContextRef.set({ ...(ctx as any), multiSelectedCount: multiSelectedVersesRef.current.length });
        setTimeout(() => bibleReaderRef.current?.selectVerse(v.verse), 50);
      }
    }, [updateVerseContext])
  );

  const isArrowNavigatingRef = useRef(false);
  const arrowJustFiredRef = useRef(false);
  const currentVerseRef = useRef(1);

  const handlePrevChapter = () => {
    if (isArrowNavigatingRef.current) return;
    isArrowNavigatingRef.current = true;
    setTimeout(() => { isArrowNavigatingRef.current = false; }, 300);
    (flatListRef as any).current?.scrollToOffset?.({ offset: 0, animated: false });
    (flatListRef as any).current?.scrollTo?.({ y: 0, animated: false });
    scrollToVerseRef.current = null;
    currentVerseRef.current = 1;
    setActiveSelectedVerse(null);
    bibleReaderRef.current?.clearSelection();
    interlinearVerseRef.current = null;
    setInterlinearVerse(null);
    savedVerseBeforeInterlinearRef.current = null;
    setUseFlashList(true);
    if (selectedChapter > 1) {
      selectedChapterRef.current = selectedChapter - 1;
      setSelectedChapter(selectedChapter - 1);
    } else if (selectedBook && selectedBook.id > 1) {
      const prevBook = books[selectedBook.id - 2];
      selectedBookRef.current = prevBook;
      selectedChapterRef.current = getChaptersCount(prevBook.id);
      setSelectedBook(prevBook);
      setSelectedChapter(selectedChapterRef.current);
    }
  };

  const handleNextChapter = () => {
    if (isArrowNavigatingRef.current) return;
    isArrowNavigatingRef.current = true;
    setTimeout(() => { isArrowNavigatingRef.current = false; }, 300);
    (flatListRef as any).current?.scrollToOffset?.({ offset: 0, animated: false });
    (flatListRef as any).current?.scrollTo?.({ y: 0, animated: false });
    scrollToVerseRef.current = null;
    arrowJustFiredRef.current = true;
    currentVerseRef.current = 1;
    setActiveSelectedVerse(null);
    bibleReaderRef.current?.clearSelection();
    interlinearVerseRef.current = null;
    setInterlinearVerse(null);
    savedVerseBeforeInterlinearRef.current = null;
    setUseFlashList(true);
    if (selectedChapter < chaptersCount) {
      selectedChapterRef.current = selectedChapter + 1;
      setSelectedChapter(selectedChapter + 1);
    } else if (selectedBook && selectedBook.id < 66) {
      const nextBook = books[selectedBook.id];
      selectedBookRef.current = nextBook;
      selectedChapterRef.current = 1;
      setSelectedBook(nextBook);
      setSelectedChapter(1);
    }
  };

  if (!dbReady || !selectedBook) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Preparando as Escrituras Sagradas...
        </Text>
      </View>
    );
  }

  const getVerseText = (verse: Verse, version: 'ara' | 'arc' | 'kjv' | 'dby') => {
    switch (version) {
      case 'ara': return verse.text_ara;
      case 'arc': return verse.text_arc;
      case 'kjv': return verse.text_kjv;
      case 'dby': return verse.text_dby;
    }
  };

  // Agrupa números de versos em ranges compactos: [1,2,3,5,6,9] → [[1,3],[5,6],[9,9]]
  const buildVerseRanges = (verseNums: number[]): [number, number][] => {
    if (verseNums.length === 0) return [];
    const sorted = [...verseNums].sort((a, b) => a - b);
    const ranges: [number, number][] = [];
    let start = sorted[0], end = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) { end = sorted[i]; }
      else { ranges.push([start, end]); start = sorted[i]; end = sorted[i]; }
    }
    ranges.push([start, end]);
    return ranges;
  };

  const handleSaveNote = () => {
    if (!selectedVerse) return;
    if (noteText.trim() === '') {
      deleteNote(selectedVerse.book_id, selectedVerse.chapter, selectedVerse.verse);
      setSelectedVerse({ ...selectedVerse, note_content: undefined });
    } else {
      saveNote(selectedVerse.book_id, selectedVerse.chapter, selectedVerse.verse, noteText.trim());
      setSelectedVerse({ ...selectedVerse, note_content: noteText.trim() });
    }
    const activeVers = layoutMode === 'split' ? [primaryVersion, secondaryVersion] : [primaryVersion];
    setVerses(getVerses(selectedBook.id, selectedChapter, activeVers));
  };


  const renderDottedText = (text: string, isSelected: boolean, savedHighlightColor: string | null, textStyle: any = styles.verseText) => {
    const dotColor = savedHighlightColor || '#ffffff';
    const words = text.split(' ');
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {words.map((word, idx) => (
          <View key={idx} style={{ marginRight: 6, marginBottom: 4 }}>
            <Text style={[textStyle, { color: colors.text }]}>{word}</Text>
            <Svg width="100%" height="2">
              <Line
                x1="0" y1="1" x2="10000" y2="1"
                stroke={dotColor}
                strokeWidth="1"
                strokeDasharray="0.8,3"
                strokeLinecap="round"
                opacity={isSelected ? 1 : 0}
              />
            </Svg>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : insets.top }]}>
      {/* Header / Nav Controls */}
      <View style={[styles.header, { borderBottomColor: colors.backgroundElement }]}>
        {/* Primary Version Selector (Cycles version on tap) */}
        <Pressable
          style={[styles.primaryVersionSelector, { backgroundColor: colors.backgroundElement }]}
          onPress={() => setShowVersionModal(true)}
        >
          <Text style={[styles.primaryVersionText, { color: colors.accent }]}>
            {primaryVersion.toUpperCase()}
          </Text>
        </Pressable>

        <View style={styles.chapterHeading}>
          <Text style={[styles.chapterHeadingBook, { color: colors.textSecondary, fontFamily: 'serif' }]}>
            {bookName(selectedBook.name_pt, selectedBook.name_en)}
          </Text>
          <Text style={[styles.chapterHeadingNumber, { color: colors.text, fontFamily: 'serif' }]}>
            {selectedChapter}
          </Text>
        </View>

        {/* Layout Toggle */}
        <Pressable
          style={[styles.layoutToggle, { backgroundColor: colors.backgroundElement }]}
          onPress={() => setLayoutMode(layoutMode === 'stacked' ? 'split' : 'stacked')}
        >
          <Split size={18} color={colors.text} />
        </Pressable>
      </View>

      {/* Reader Body */}
      <View style={{ flex: 1 }}>
        {(listOpacity === 0 || !dbReady || verses.length === 0) && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}>
            <ReaderSkeleton isDark={isDark} />
          </View>
        )}
        <View style={{ flex: 1, opacity: listOpacity }}>
        {layoutMode === 'stacked' ? (
        <BibleReaderView
          ref={bibleReaderRef}
          style={{ flex: 1 }}
          isDark={isDark}
          onInterlinearDismiss={(verseNum) => {
            const prevVerseNum = interlinearVerseRef.current?.verse.verse;
            if (prevVerseNum != null) {
              bibleReaderRef.current?.clearInterlinear(prevVerseNum);
            }
            interlinearVerseRef.current = null;
            savedVerseBeforeInterlinearRef.current = null;
            bibleReaderRef.current?.selectVerse(verseNum);
            const item = verses.find(v => v.verse === verseNum);
            if (item) handleVersePress(item);
          }}
          onVersePress={(verseNum) => {
            if (verseNum === -1) {
              handleVersePress(activeSelectedVerseStateRef.current ?? verses[0]);
              return;
            }
            const item = verses.find(v => v.verse === verseNum);
            if (item) handleVersePress(item);
          }}
          onVerseNumPress={(verseNum) => {
            const item = verses.find(v => v.verse === verseNum);
            if (item) openNoteModal(item);
          }}
          onVerseComparePress={(verseNum) => {
            const item = verses.find(v => v.verse === verseNum);
            if (!item) return;
            const fullVerse = getVerse(item.book_id, item.chapter, item.verse);
            setSelectedVerse(fullVerse ?? item);
            setTimeout(() => setShowCompareModal(true), 50);
          }}
          onInterlinearWordPress={(indexStr) => {
            const idx = parseInt(indexStr, 10);
            const word = interlinearVerseRef.current?.words[idx] ?? null;
            if (word) setSelectedInterlinearWord(word);
          }}
          onReturnIconPress={(verseNum) => {
            const item = verses.find(v => v.verse === verseNum);
            if (!item) return;
            const links = getBlockLinksToVerse(item.book_id, item.chapter, item.verse);
            const hasIndividual = links.some(l => l.src_verses.length === 1);
            const hasGroup = links.some(l => l.src_verses.length > 1);
            setIncomingLinkTypeFilter(hasIndividual ? 'individual' : 'group');
            setIncomingLinksModal({ verse: verseNum, links });
          }}
        />
      ) : (
        /* Split view: two side-by-side columns */
        <View style={styles.splitGrid}>
          {/* Version Selectors */}
          <View style={[styles.splitHeader, { borderBottomColor: colors.backgroundElement }]}>
            <View style={styles.splitSelectorContainer}>
              <Pressable style={styles.splitSelector} onPress={() => {
                const versions: ('ara'|'arc'|'kjv'|'dby')[] = ['ara', 'arc', 'kjv', 'dby'];
                const nextIdx = (versions.indexOf(primaryVersion) + 1) % 4;
                setPrimaryVersion(versions[nextIdx]);
                AsyncStorage.setItem('primaryVersion', versions[nextIdx]);
              }}>
                <Text style={[styles.splitSelectorText, { color: colors.accent }]}>
                  {primaryVersion.toUpperCase()}
                </Text>
              </Pressable>
            </View>
            <View style={[styles.splitDivider, { backgroundColor: colors.backgroundElement }]} />
            <View style={styles.splitSelectorContainer}>
              <Pressable style={styles.splitSelector} onPress={() => {
                const versions: ('ara'|'arc'|'kjv'|'dby')[] = ['ara', 'arc', 'kjv', 'dby'];
                const nextIdx = (versions.indexOf(secondaryVersion) + 1) % 4;
                setSecondaryVersion(versions[nextIdx]);
              }}>
                <Text style={[styles.splitSelectorText, { color: colors.accent }]}>
                  {secondaryVersion.toUpperCase()}
                </Text>
              </Pressable>
            </View>
          </View>
          
          <FlatList
            ref={splitListRef}
            onScrollToIndexFailed={(info) => {
              splitListRef.current?.scrollToOffset({
                offset: info.index * 90,
                animated: false,
              });
              setTimeout(() => {
                try {
                  splitListRef.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: 0 });
                } catch (e) {}
                setListOpacity(1);
              }, 40);
            }}
            data={verses}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const highlightKey = `${selectedBook.id}_${selectedChapter}_${item.verse}`;
              const savedHighlightColor = verseHighlights[highlightKey];
              const isSelected = activeSelectedVerse?.verse === item.verse;
              
              return (
                <SplitVerseRow
                  item={item}
                  textPrimary={getVerseText(item, primaryVersion)}
                  textSecondary={getVerseText(item, secondaryVersion)}
                  isSelected={isSelected}
                  savedHighlightColor={savedHighlightColor}
                  hasNote={!!item.note_content}
                  hasCorrelations={correlatedVerseNums.has(item.verse)}
                  colors={colors}
                  onPress={() => {
                    setHighlightedVerse(null);
                    if (activeSelectedVerse?.verse === item.verse) {
                      setActiveSelectedVerse(null);
                      setActiveColor(null);
                    } else {
                      setActiveSelectedVerse(item);
                      setActiveColor(savedHighlightColor || null);
                    }
                  }}
                  onPressNoteNumber={() => openNoteModal(item)}
                  onLayout={(e) => {
                    const h = e.nativeEvent.layout.height;
                    itemOffsetsRef.current[item.verse - 1] = h;
                  }}
                />
              );
            }}
          />
        </View>
      )}
      </View>
      </View>

      {/* FLOATING BOTTOM VERSE SELECTION PANEL (MATCHING REFERENCE IMAGE 1) */}

      {/* Navigation Buttons for chapters at the very bottom right/left of container */}
      <View style={styles.chapterArrowsContainer} pointerEvents="box-none">
        <View style={{ alignItems: 'center', gap: 8, justifyContent: 'flex-end' }} pointerEvents="box-none">
          {(activeSelectedVerse || interlinearVerseRef.current) ? (
            <Pressable
              style={[styles.arrowButton, { backgroundColor: interlinearVerseRef.current != null ? colors.accent : colors.backgroundElement, borderColor: isDark ? '#322E2D' : '#EAE2D5' }]}
              onPress={() => {
                if (interlinearVerseRef.current) {
                  const verseNum = interlinearVerseRef.current.verse.verse;
                  bibleReaderRef.current?.clearInterlinear(verseNum);
                  interlinearVerseRef.current = null;
                  setInterlinearVerse(null);
                  const saved = savedVerseBeforeInterlinearRef.current;
                  savedVerseBeforeInterlinearRef.current = null;
                  if (saved) setActiveSelectedVerse(saved);
                } else if (activeSelectedVerse) {
                  savedVerseBeforeInterlinearRef.current = activeSelectedVerse;
                  const words = getInterlinearVerse(activeSelectedVerse.book_id, activeSelectedVerse.chapter, activeSelectedVerse.verse);
                  const val = { verse: activeSelectedVerse, words };
                  interlinearVerseRef.current = val;
                  setInterlinearVerse(val);
                  setActiveSelectedVerse(null);
                  const wordsJson = JSON.stringify(words.map(w => ({ strongs: w.strong_number, gloss: w.gloss, translit: w.translit })));
                  bibleReaderRef.current?.showInterlinear(activeSelectedVerse.verse, wordsJson);
                }
              }}
            >
              <Languages size={18} color={interlinearVerseRef.current != null ? '#fff' : colors.text} />
            </Pressable>
          ) : (
            <View style={{ width: 44, height: 44 }} />
          )}
          <Pressable
            style={[styles.arrowButton, { backgroundColor: colors.backgroundElement, borderColor: isDark ? '#322E2D' : '#EAE2D5' }]}
            onPress={handlePrevChapter}
          >
            <ChevronLeft size={20} color={colors.text} style={{ marginRight: 1.5 }} />
          </Pressable>
        </View>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Pressable
            style={[styles.arrowButton, { backgroundColor: colors.backgroundElement, borderColor: isDark ? '#322E2D' : '#EAE2D5' }]}
            onPress={() => router.push({ pathname: '/selector', params: { bookId: String(selectedBookRef.current?.id ?? 1), chapter: String(selectedChapterRef.current), verse: String(currentVerseRef.current) } })}
          >
            <AlignJustify size={18} color={colors.text} />
          </Pressable>
          <Pressable
            style={[
              styles.arrowButton,
              {
                backgroundColor: colors.backgroundElement,
                borderColor: isDark ? '#322E2D' : '#EAE2D5',
              }
            ]}
            onPress={handleNextChapter}
          >
            <ChevronRight size={20} color={colors.text} style={{ marginLeft: 1.5 }} />
          </Pressable>
        </View>
      </View>

      {/* VERSION SELECTOR MODAL / SHEET */}
      {showVersionModal && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowVersionModal(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowVersionModal(false)}>
          <Pressable onPress={() => {}} style={[styles.versionModalContent, { backgroundColor: colors.card, borderColor: colors.backgroundElement }]}>
            <View style={styles.versionModalHeader}>
              <Text style={[styles.versionModalTitle, { color: colors.text, fontFamily: 'serif' }]}>
                Selecione a Versão
              </Text>
              <Pressable onPress={() => setShowVersionModal(false)} style={styles.closeIconButton}>
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView bounces={false} style={{ maxHeight: 240 }}>
              {[
                { code: 'ara', name: 'Almeida Revista e Atualizada (ARA)' },
                { code: 'arc', name: 'Almeida Revista e Corrigida (ARC)' },
                { code: 'kjv', name: 'King James Version (KJV)' },
                { code: 'dby', name: 'Darby Translation (DBY)' },
              ].map((item) => {
                const isActive = primaryVersion === item.code;
                return (
                  <Pressable
                    key={item.code}
                    style={[
                      styles.versionItem,
                      { borderBottomColor: colors.backgroundElement },
                      isActive && { backgroundColor: colors.backgroundElement }
                    ]}
                    onPress={() => {
                      setPrimaryVersion(item.code as any);
                      AsyncStorage.setItem('primaryVersion', item.code);
                      setShowVersionModal(false);
                    }}
                  >
                    <Text style={[
                      styles.versionItemText,
                      { color: isActive ? colors.accent : colors.text },
                      isActive && { fontWeight: 'bold' }
                    ]}>
                      {item.name}
                    </Text>
                    {isActive && (
                      <Text style={{ color: colors.accent, fontWeight: 'bold' }}>✓</Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
          </Pressable>
        </Modal>
      )}



      {/* INTERLINEAR WORD DETAIL MODAL */}
      {selectedInterlinearWord && (
        <InterlinearWordModal
          word={selectedInterlinearWord}
          onClose={() => setSelectedInterlinearWord(null)}
          onNavigateToLexicon={(code) => {
            setSelectedInterlinearWord(null);
            router.push({ pathname: '/lexicon', params: { query: code } });
          }}
          isDark={isDark}
          colors={colors}
        />
      )}

      {/* PREMIUM STUDY OPTIONS BOTTOM SHEET MENU */}
      {showOptionsSheet && selectedVerse && (
        <Modal
          visible={showOptionsSheet}
          transparent
          animationType="fade"
          onRequestClose={() => setShowOptionsSheet(false)}
        >
          <Pressable
            style={[styles.modalOverlay, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', zIndex: 199 }]}
            onPress={() => setShowOptionsSheet(false)}
          >
            <Pressable
              style={[styles.drawerContent, { backgroundColor: colors.card, borderColor: colors.backgroundElement, borderTopLeftRadius: Spacing.four, borderTopRightRadius: Spacing.four, paddingBottom: BottomTabInset + Spacing.two }]}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Drag Handle indicator */}
              <View style={[styles.dragHandle, { backgroundColor: colors.backgroundElement }]} />
              
              <View style={[styles.drawerHeader, { borderBottomWidth: 0, paddingBottom: Spacing.one }]}>
                <Text style={[styles.drawerTitle, { color: colors.text, fontFamily: 'serif' }]}>
                  {selectedBook ? bookName(selectedBook.name_pt, selectedBook.name_en) : ''} {selectedVerse.chapter}:{selectedVerse.verse}
                </Text>
                <Pressable onPress={() => setShowOptionsSheet(false)} style={styles.drawerClose}>
                  <X size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
              <Text style={{ fontSize: 13, color: colors.textSecondary, paddingHorizontal: Spacing.four, paddingBottom: Spacing.three, borderBottomWidth: 1.5, borderBottomColor: colors.backgroundElement }}>
                Escolha uma ferramenta de estudo teológico para esta passagem:
              </Text>

              <View style={{ paddingVertical: Spacing.two }}>
                {/* 1. Anotação Pessoal */}
                <Pressable
                  style={styles.optionRowItem}
                  onPress={() => {
                    setShowOptionsSheet(false);
                    activeStudyVerseRef.set(selectedVerse, selectedBook ? bookName(selectedBook.name_pt, selectedBook.name_en) : '', primaryVersion, 'note');
                    navigatedToStudyRef.current = true; router.navigate('/study');
                  }}
                >
                  <View style={[styles.optionIconContainer, { backgroundColor: colors.backgroundElement }]}>
                    <MessageSquare size={18} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionRowTitle, { color: colors.text }]}>Anotação</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>Escrever notas e meditações sobre esta passagem</Text>
                  </View>
                </Pressable>

                {/* 2. Vincular */}
                <Pressable
                  style={styles.optionRowItem}
                  onPress={() => {
                    activeStudyVerseRef.set(selectedVerse, selectedBook ? bookName(selectedBook.name_pt, selectedBook.name_en) : '', primaryVersion, 'links');
                    navigatedToStudyRef.current = true;
                    router.navigate('/study');
                    setShowOptionsSheet(false);
                  }}
                >
                  <View style={[styles.optionIconContainer, { backgroundColor: colors.backgroundElement }]}>
                    <Link size={18} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionRowTitle, { color: colors.text }]}>Vincular</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>Conectar passagens relacionadas teologicamente</Text>
                  </View>
                </Pressable>

                {/* 3. Versões */}
                <Pressable
                  style={styles.optionRowItem}
                  onPress={() => {
                    setShowOptionsSheet(false);
                    setShowVersionModal(true);
                  }}
                >
                  <View style={[styles.optionIconContainer, { backgroundColor: colors.backgroundElement }]}>
                    <BookOpen size={18} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionRowTitle, { color: colors.text }]}>Versões</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>Comparar traduções: ARA, ARC, KJV, Darby</Text>
                  </View>
                </Pressable>

                <View style={{ height: 1.5, backgroundColor: colors.backgroundElement, marginVertical: Spacing.two }} />

                {/* 4. Favoritar */}
                <Pressable
                  style={styles.optionRowItem}
                  onPress={() => {
                    setShowOptionsSheet(false);
                    Vibration.vibrate(30);
                    toggleFavorite(selectedVerse.book_id, selectedVerse.chapter, selectedVerse.verse);
                    const activeVers = layoutMode === 'split' ? [primaryVersion, secondaryVersion] : [primaryVersion];
                    setVerses(getVerses(selectedBook!.id, selectedChapter, activeVers));
                  }}
                >
                  <View style={[styles.optionIconContainer, { backgroundColor: colors.backgroundElement }]}>
                    <Heart size={18} color={selectedVerse.is_favorite ? colors.accent : colors.textSecondary} fill={selectedVerse.is_favorite ? colors.accent : 'transparent'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionRowTitle, { color: colors.text }]}>
                      {selectedVerse.is_favorite ? 'Remover dos Favoritos' : 'Salvar nos Favoritos'}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>Salvar esta passagem na sua lista preciosa</Text>
                  </View>
                </Pressable>

              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* DYNAMIC VERSE DETAIL DRAWER / SHEET */}
      {showDetailSheet && selectedVerse && (
        <Modal
          visible={showDetailSheet}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDetailSheet(false)}
        >
          <Pressable
            style={[styles.modalOverlay, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 200 }]}
            onPress={() => { Keyboard.dismiss(); setShowDetailSheet(false); }}
          >
            <Pressable
              style={[styles.drawerContent, { backgroundColor: colors.card, borderColor: colors.backgroundElement, marginBottom: keyboardHeight, height: '70%', borderTopLeftRadius: Spacing.four, borderTopRightRadius: Spacing.four }]}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Drag Handle indicator */}
              <View style={[styles.dragHandle, { backgroundColor: colors.backgroundElement }]} />

              <View style={styles.drawerHeader}>
                <Text style={[styles.drawerTitle, { color: colors.text, fontFamily: 'serif' }]}>
                  {selectedBook ? bookName(selectedBook.name_pt, selectedBook.name_en) : ''} {selectedVerse.chapter}:{selectedVerse.verse}
                </Text>
                <Pressable
                  onPress={() => setShowDetailSheet(false)}
                  style={styles.drawerClose}
                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                >
                  <X size={22} color={colors.textSecondary} />
                </Pressable>
              </View>


              <ScrollView style={styles.drawerScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* 1. Tab Mode: note */}
                {detailMode === 'note' && (
                  <View style={styles.sectionContainer}>
                    <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Spacing.one }]}>Anotação Pessoal</Text>
                    {selectedVerse.note_content ? (
                      <View style={[styles.staticNoteContainer, { backgroundColor: colors.backgroundElement, borderLeftColor: colors.accent }]}>
                        <Text style={[styles.staticNoteText, { color: colors.text }]}>
                          {selectedVerse.note_content}
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.emptyNoteText, { color: colors.textMuted }]}>
                        Nenhuma anotação neste versículo ainda.
                      </Text>
                    )}
                    
                    <Pressable
                      style={[styles.editNoteBtn, { backgroundColor: colors.accent }]}
                      onPress={() => {
                        setShowDetailSheet(false);
                        router.push({
                          pathname: '/annotation',
                          params: {
                            bookId: String(selectedVerse.book_id),
                            bookName: selectedBook ? bookName(selectedBook.name_pt, selectedBook.name_en) : '',
                            chapter: String(selectedVerse.chapter),
                            verse: String(selectedVerse.verse),
                            verseText: getVerseText(selectedVerse, primaryVersion) ?? '',
                            initialNote: selectedVerse.note_content ?? '',
                          },
                        });
                      }}
                    >
                      <Text style={styles.editNoteBtnText}>
                        {selectedVerse.note_content ? 'Editar Anotação' : 'Adicionar Anotação'}
                      </Text>
                    </Pressable>
                  </View>
                )}

                {/* 2. Tab Mode: links */}
                {detailMode === 'links' && (
                  <View style={styles.sectionContainer}>
                    <View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.two }}>
                        <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>
                          Versículos Relacionados
                        </Text>
                        <Pressable
                          style={[styles.addLinkBtn, { borderColor: colors.accent, borderRadius: 20 }]}
                          onPress={() => {
                            setIsLinkingFromSelector(true);
                            setShowDetailSheet(false);
                            setShowSelector(true);
                          }}
                        >
                          <Text style={[styles.addLinkBtnText, { color: colors.accent }]}>+ Vincular Novo</Text>
                        </Pressable>
                      </View>

                      {selectedVerseBlockLinks.length > 0 ? (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: Spacing.one }}>
                          {selectedVerseBlockLinks.map((link) => {
                            const tgtRange = link.tgt_verses.length === 1
                              ? String(link.tgt_verses[0])
                              : `${Math.min(...link.tgt_verses)}-${Math.max(...link.tgt_verses)}`;
                            const bColor = link.src_verses.length > 1 ? '#F59E0B' : colors.accent;
                            return (
                              <View
                                key={`ds_bl_${link.id}`}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  backgroundColor: colors.backgroundElement,
                                  paddingVertical: 6,
                                  paddingHorizontal: 10,
                                  borderRadius: 20,
                                  borderWidth: 1,
                                  borderColor: `${bColor}55`,
                                  maxWidth: '48%',
                                  flexShrink: 1,
                                }}
                              >
                                <Pressable
                                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}
                                  onPress={() => {
                                    setShowDetailSheet(false);
                                    if (link.tgt_verses.length > 0) {
                                      navigateToVerse(link.tgt_book_id, link.tgt_chapter, link.tgt_verses[0]);
                                    }
                                  }}
                                >
                                  <Link size={12} color={bColor} />
                                  <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 13 }}>
                                    {link.tgt_book_name} {link.tgt_chapter}:{tgtRange}
                                  </Text>
                                </Pressable>
                                <Pressable
                                  onPress={() => {
                                    removeBlockLink(link.id);
                                    Vibration.vibrate(20);
                                    dbModifiedRef.modified = true;
                                    const bl = getBlockLinksFromVerse(selectedVerse.book_id, selectedVerse.chapter, selectedVerse.verse);
                                    setSelectedVerseBlockLinks(bl);
                                    setSelectedVerseIncomingLinks(getBlockLinksToVerse(selectedVerse.book_id, selectedVerse.chapter, selectedVerse.verse));
                                    const newCorr = getBlockLinkSrcVerseNumsForChapter(selectedBook!.id, selectedChapter);
                                    const newGroupCorr = getBlockLinkGroupSrcVerseNumsForChapter(selectedBook!.id, selectedChapter);
                                    setCorrelatedVerseNums(newCorr);
                                    setGroupCorrVerseNums(newGroupCorr);
                                    const newTgt = getBlockLinkTgtVerseNumsForChapter(selectedBook!.id, selectedChapter);
                                    setTgtVerseNums(newTgt);
                                    const savedNums = verses.filter(v => v.is_favorite).map(v => v.verse);
                                    const corrArr = Array.from(newCorr);
                                    const groupCorrArr = Array.from(newGroupCorr);
                                    pendingBadgeUpdateRef.current = () => bibleReaderRef.current?.updateBadges(Array.from(noteVerseNums), corrArr, Array.from(groupNoteVerseNums), groupCorrArr, savedNums, Array.from(groupNoteWithNotesVerseNums), Array.from(newTgt));
                                  }}
                                  style={{ marginLeft: 8 }}
                                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                  <X size={13} color="#EF4444" />
                                </Pressable>
                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        <Text style={[styles.emptyNoteText, { color: colors.textMuted }]}>
                          Nenhum versículo vinculado ainda.
                        </Text>
                      )}
                    </View>
                  </View>
                )}

              <View style={{ height: BottomTabInset }} />
            </ScrollView>
          </Pressable>
        </Pressable>
        </Modal>
      )}



      {/* DEDICATED SCROLLABLE VERSIONS COMPARISON BOTTOM SHEET DRAWER */}
      <Modal
        visible={showCompareModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowCompareModal(false); setShowVersionOrderConfig(false); }}
      >
        <GestureHandlerRootView style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={[styles.drawerContent, { backgroundColor: colors.card, borderColor: colors.backgroundElement, marginBottom: keyboardHeight, height: showVersionOrderConfig ? '55%' : '75%', borderTopLeftRadius: Spacing.four, borderTopRightRadius: Spacing.four, paddingTop: Spacing.three, paddingBottom: Spacing.four, zIndex: 1 }]}>
            <View style={[styles.dragHandle, { backgroundColor: colors.backgroundElement }]} />
            <View style={[styles.drawerHeader, { borderBottomWidth: 1.5, borderBottomColor: colors.backgroundElement, paddingBottom: Spacing.three, marginBottom: Spacing.two }]}>
              <View>
                <Text style={[styles.drawerTitle, { color: colors.text, fontFamily: 'serif' }]}>
                  {selectedBook ? bookName(selectedBook.name_pt, selectedBook.name_en) : ''} {selectedVerse?.chapter}:{selectedVerse?.verse}
                </Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                  {showVersionOrderConfig ? 'Reordenar traduções' : 'Comparação de Traduções'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                <Pressable onPress={() => setShowVersionOrderConfig(v => !v)} style={[styles.drawerClose, showVersionOrderConfig && { backgroundColor: colors.accent + '25', borderRadius: 8 }]} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <AlignJustify size={20} color={showVersionOrderConfig ? colors.accent : colors.textSecondary} />
                </Pressable>
                <Pressable onPress={() => { setShowCompareModal(false); setShowVersionOrderConfig(false); }} style={styles.drawerClose} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                  <X size={22} color={colors.textSecondary} />
                </Pressable>
              </View>
            </View>
            {showVersionOrderConfig ? (
              <SortableVersionList
                order={versionOrder}
                onOrderChange={(next) => updateVersionOrder(next as ('ara'|'arc'|'kjv'|'dby')[])}
                versionMeta={{ ara: { label: 'ARA', fullName: 'Almeida Revista e Atualizada' }, arc: { label: 'ARC', fullName: 'Almeida Revista e Corrigida' }, kjv: { label: 'KJV', fullName: 'King James Version', italic: true }, dby: { label: 'DARBY', fullName: "Darby's Translation 1890", italic: true } }}
                colors={colors}
                spacing={{ two: Spacing.two, three: Spacing.three }}
              />
            ) : (
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.four, paddingBottom: Spacing.four }} keyboardShouldPersistTaps="handled">
                {versionOrder.map((key) => {
                  const metas: Record<string, { label: string; fullName: string; italic?: boolean }> = { ara: { label: 'ARA', fullName: 'Almeida Revista e Atualizada' }, arc: { label: 'ARC', fullName: 'Almeida Revista e Corrigida' }, kjv: { label: 'KJV', fullName: 'King James Version', italic: true }, dby: { label: 'DARBY', fullName: "Darby's Translation 1890", italic: true } };
                  const meta = metas[key];
                  const text = selectedVerse ? { ara: selectedVerse.text_ara, arc: selectedVerse.text_arc, kjv: selectedVerse.text_kjv, dby: selectedVerse.text_dby }[key] : undefined;
                  if (!text) return null;
                  return (
                    <View key={key}>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: Spacing.two, paddingHorizontal: 2 }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>{meta.label}</Text>
                        <Text style={{ fontSize: 12, color: colors.textMuted }}>{meta.fullName}</Text>
                      </View>
                      <View style={{ borderRadius: Spacing.two, backgroundColor: colors.backgroundElement, borderLeftWidth: 3, borderLeftColor: colors.accent, padding: Spacing.three }}>
                        <Text style={{ fontSize: 15, color: colors.text, lineHeight: 24, fontStyle: meta.italic ? 'italic' : 'normal' }}>"{text}"</Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: -1 }} onPress={() => { setShowCompareModal(false); setShowVersionOrderConfig(false); }} />
        </GestureHandlerRootView>
      </Modal>

      {/* Note Details and Linked Verses Modal */}
      {(() => {
        if (!selectedVerse || !showNoteDetailsModal) return null;
        return (
          <Modal
            visible={showNoteDetailsModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowNoteDetailsModal(false)}
            onDismiss={() => { if (pendingBadgeUpdateRef.current) { pendingBadgeUpdateRef.current(); pendingBadgeUpdateRef.current = null; } }}
          >
            <GestureHandlerRootView style={{ flex: 1, justifyContent: 'flex-end' }}>
              <View
                style={[
                  styles.drawerContent,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.backgroundElement,
                    borderTopLeftRadius: Spacing.four,
                    borderTopRightRadius: Spacing.four,
                    paddingTop: Spacing.three,
                    paddingBottom: Spacing.four,
                    zIndex: 1,
                    height: '65%',
                    maxHeight: '80%',
                  }
                ]}
              >
                {/* Drag Handle */}
                <View style={[styles.dragHandle, { backgroundColor: colors.backgroundElement }]} />

                {/* Header */}
                <View style={[styles.drawerHeader, { borderBottomWidth: 1.5, borderBottomColor: colors.backgroundElement, paddingBottom: Spacing.three, marginBottom: Spacing.two }]}>
                  <View>
                    <Text style={[styles.drawerTitle, { color: colors.text, fontFamily: 'serif' }]}>
                      {selectedBook ? bookName(selectedBook.name_pt, selectedBook.name_en) : ''} {selectedVerse.chapter}:{selectedVerse.verse}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                      Anotações e Vínculos Teológicos
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setShowNoteDetailsModal(false)}
                    style={styles.drawerClose}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  >
                    <X size={22} color={colors.textSecondary} />
                  </Pressable>
                </View>

                {/* Sub-abas */}
                {(() => {
                  const totalLinks = selectedVerseBlockLinks.length + selectedVerseIncomingLinks.length;
                  const [modalTab, setModalTab] = [noteModalTab, setNoteModalTab];
                  const tabs = [
                    { key: 'notes', label: `Anotações${(selectedVerseNotes.length + selectedVerseNoteGroups.filter(g => g.content?.trim()).length) > 0 ? ` (${selectedVerseNotes.length + selectedVerseNoteGroups.filter(g => g.content?.trim()).length})` : ''}` },
                    { key: 'links', label: `Vínculos${totalLinks > 0 ? ` (${totalLinks})` : ''}` },
                  ] as const;
                  return (
                    <View style={{ flexDirection: 'row', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderRadius: 12, padding: 4, width: '90%', alignSelf: 'center', marginBottom: Spacing.three }}>
                      {tabs.map(t => (
                        <Pressable key={t.key} onPress={() => setModalTab(t.key)} style={{ flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 9, backgroundColor: modalTab === t.key ? colors.accent : 'transparent' }}>
                          <Text style={{ fontSize: 14, fontWeight: 'bold', color: modalTab === t.key ? '#FFF' : colors.textSecondary }}>{t.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  );
                })()}

                <ScrollView style={styles.drawerScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {/* ABA: ANOTAÇÕES */}
                  {noteModalTab === 'notes' && (() => {
                    const hasInd = selectedVerseNotes.length > 0;
                    const hasGrp = selectedVerseNoteGroups.some(g => parseGroupNotes(g.content ?? '').length > 0);
                    const showFilter = hasInd && hasGrp;
                    const showInd = !showFilter || modalNoteTypeFilter === 'individual';
                    const showGrp = !showFilter || modalNoteTypeFilter === 'group';
                    return (
                      <View style={styles.sectionContainer}>
                        {/* Seletor Individual / Grupo */}
                        {showFilter && (
                          <View style={{ flexDirection: 'row', gap: 8, marginBottom: Spacing.three }}>
                            {(['individual', 'group'] as const).map(type => {
                              const active = modalNoteTypeFilter === type;
                              const count = type === 'individual' ? selectedVerseNotes.length : selectedVerseNoteGroups.reduce((acc, g) => acc + parseGroupNotes(g.content ?? '').length, 0);
                              const label = type === 'individual' ? `Individual (${count})` : `Grupo (${count})`;
                              const activeColor = type === 'group' ? '#F59E0B' : colors.accent;
                              return (
                                <Pressable key={type} onPress={() => { setModalNoteTypeFilter(type); Vibration.vibrate(10); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: active ? activeColor : (isDark ? '#2D2927' : '#E6DEC9'), backgroundColor: active ? (type === 'group' ? 'rgba(245,158,11,0.1)' : colors.accentSubtle) : 'transparent' }}>
                                  <Text style={{ fontSize: 13, fontWeight: '700', color: active ? activeColor : colors.textSecondary }}>{label}</Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        )}

                        {/* Notas individuais */}
                        {showInd && hasInd && (() => {
                          const note = selectedVerseNotes[noteCarouselIdx] ?? selectedVerseNotes[0];
                          return (
                            <View>
                              <View style={{ backgroundColor: isDark ? '#1C1A19' : '#FAF6EE', borderColor: isDark ? '#2D2927' : '#E6DEC9', borderWidth: 1.5, borderLeftWidth: 4, borderLeftColor: colors.accent, padding: 14, borderRadius: 8 }}>
                                <Text style={{ color: colors.text, fontSize: 14, lineHeight: 22, fontFamily: 'serif' }}>{note.content}</Text>
                                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8, alignSelf: 'flex-end' }}>{formatNoteDate(parseSqliteDate(note.created_at))}</Text>
                              </View>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.two }}>
                                {selectedVerseNotes.length > 1 ? (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Pressable onPress={() => { Vibration.vibrate(10); setNoteCarouselIdx(i => Math.max(0, i - 1)); }} disabled={noteCarouselIdx === 0} style={{ padding: 8, borderRadius: 8, backgroundColor: colors.backgroundElement, opacity: noteCarouselIdx === 0 ? 0.3 : 1 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                      <ChevronLeft size={16} color={colors.accent} />
                                    </Pressable>
                                    <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600', minWidth: 40, textAlign: 'center' }}>{noteCarouselIdx + 1} / {selectedVerseNotes.length}</Text>
                                    <Pressable onPress={() => { Vibration.vibrate(10); setNoteCarouselIdx(i => Math.min(selectedVerseNotes.length - 1, i + 1)); }} disabled={noteCarouselIdx === selectedVerseNotes.length - 1} style={{ padding: 8, borderRadius: 8, backgroundColor: colors.backgroundElement, opacity: noteCarouselIdx === selectedVerseNotes.length - 1 ? 0.3 : 1 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                      <ChevronRight size={16} color={colors.accent} />
                                    </Pressable>
                                  </View>
                                ) : <View />}
                                <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: colors.backgroundElement }} onPress={() => { setShowNoteDetailsModal(false); activeStudyVerseRef.set(selectedVerse, selectedBook?.name_pt ?? '', primaryVersion, 'note', note.id); navigatedToStudyRef.current = true; router.navigate('/study'); }}>
                                  <MessageSquare size={14} color={colors.accent} />
                                  <Text style={{ color: colors.accent, fontSize: 13, fontWeight: 'bold' }}>Editar</Text>
                                </Pressable>
                              </View>
                            </View>
                          );
                        })()}

                        {/* Notas de grupo */}
                        {showGrp && hasGrp && (
                          <View style={{ gap: 10, marginTop: showInd && hasInd ? 12 : 0 }}>
                            {selectedVerseNoteGroups.map(g => {
                              const sortedVerses = (g.verses ?? []).map(v => v.verse).sort((a, b) => a - b);
                              const bookLabel = selectedBook ? bookName(selectedBook.name_pt, selectedBook.name_en) : '';
                              const chap = selectedVerse?.chapter ?? '';
                              const versesRangeLabel = (() => {
                                if (sortedVerses.length === 0) return '';
                                const ranges: string[] = [];
                                let start = sortedVerses[0], end = sortedVerses[0];
                                for (let i = 1; i < sortedVerses.length; i++) {
                                  if (sortedVerses[i] === end + 1) { end = sortedVerses[i]; }
                                  else { ranges.push(start === end ? `${start}` : `${start}-${end}`); start = end = sortedVerses[i]; }
                                }
                                ranges.push(start === end ? `${start}` : `${start}-${end}`);
                                return ranges.join(', ');
                              })();
                              const verseLabel = sortedVerses.length > 0 ? `${bookLabel} ${chap}:${versesRangeLabel}` : 'Grupo';
                              const groupNoteItems = parseGroupNotes(g.content ?? '');
                              if (groupNoteItems.length === 0) return null;
                              const groupAccent = '#F59E0B';
                              const gIdx = groupCarouselIdx[g.id] ?? 0;
                              const currentNote = groupNoteItems[gIdx];
                              const navigateToGroup = () => { setShowNoteDetailsModal(false); activeStudyVerseRef.set(selectedVerse!, bookLabel, primaryVersion, 'note', null, g.verses ?? [], g.id, gIdx); navigatedToStudyRef.current = true; router.navigate('/study'); };
                              return (
                                <View key={g.id}>
                                  <View style={{ backgroundColor: isDark ? '#1C1A19' : '#FAF6EE', borderColor: isDark ? '#2D2927' : '#E6DEC9', borderWidth: 1.5, borderLeftWidth: 4, borderLeftColor: groupAccent, padding: 14, borderRadius: 8 }}>
                                    <Text style={{ fontSize: 10, color: groupAccent, fontWeight: '700', marginBottom: 6 }}>{verseLabel}</Text>
                                    <Text style={{ color: colors.text, fontSize: 14, lineHeight: 22, fontFamily: 'serif' }}>{currentNote}</Text>
                                    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8, alignSelf: 'flex-end' }}>{formatNoteDate(parseSqliteDate(g.updated_at))}</Text>
                                  </View>
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.two }}>
                                    {groupNoteItems.length > 1 ? (
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Pressable onPress={() => { Vibration.vibrate(10); setGroupCarouselIdx(prev => ({ ...prev, [g.id]: Math.max(0, gIdx - 1) })); }} disabled={gIdx === 0} style={{ padding: 8, borderRadius: 8, backgroundColor: colors.backgroundElement, opacity: gIdx === 0 ? 0.3 : 1 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                          <ChevronLeft size={16} color={groupAccent} />
                                        </Pressable>
                                        <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600', minWidth: 40, textAlign: 'center' }}>{gIdx + 1} / {groupNoteItems.length}</Text>
                                        <Pressable onPress={() => { Vibration.vibrate(10); setGroupCarouselIdx(prev => ({ ...prev, [g.id]: Math.min(groupNoteItems.length - 1, gIdx + 1) })); }} disabled={gIdx === groupNoteItems.length - 1} style={{ padding: 8, borderRadius: 8, backgroundColor: colors.backgroundElement, opacity: gIdx === groupNoteItems.length - 1 ? 0.3 : 1 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                          <ChevronRight size={16} color={groupAccent} />
                                        </Pressable>
                                      </View>
                                    ) : <View />}
                                    <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: colors.backgroundElement }} onPress={navigateToGroup}>
                                      <MessageSquare size={14} color={groupAccent} />
                                      <Text style={{ color: groupAccent, fontSize: 13, fontWeight: 'bold' }}>Editar</Text>
                                    </Pressable>
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        )}

                        {/* Empty state: nenhum dos dois */}
                        {!hasInd && !hasGrp && (
                          <View style={{ backgroundColor: isDark ? '#1C1A19' : '#FDFBF7', borderColor: isDark ? '#2D2927' : '#E6DEC9', borderWidth: 1.5, borderStyle: 'dashed', padding: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                            <Text style={{ color: colors.textMuted, fontStyle: 'italic', fontSize: 13 }}>Nenhuma anotação ainda.</Text>
                            <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: colors.backgroundElement }} onPress={() => { setShowNoteDetailsModal(false); activeStudyVerseRef.set(selectedVerse, selectedBook ? bookName(selectedBook.name_pt, selectedBook.name_en) : '', primaryVersion, 'note'); navigatedToStudyRef.current = true; router.navigate('/study'); }}>
                              <MessageSquare size={14} color={colors.accent} />
                              <Text style={{ color: colors.accent, fontSize: 13, fontWeight: 'bold' }}>Adicionar Nota</Text>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    );
                  })()}

                  {/* ABA: VÍNCULOS */}
                  {noteModalTab === 'links' && (() => {
                    const hasIndLinks = [...selectedVerseBlockLinks, ...selectedVerseIncomingLinks].some(l => l.src_verses.length === 1);
                    const hasGrpLinks = [...selectedVerseBlockLinks, ...selectedVerseIncomingLinks].some(l => l.src_verses.length > 1);
                    const showLinkFilter = hasIndLinks && hasGrpLinks;
                    const filteredOutLinks = showLinkFilter
                      ? selectedVerseBlockLinks.filter(l => modalLinkTypeFilter === 'individual' ? l.src_verses.length === 1 : l.src_verses.length > 1)
                      : selectedVerseBlockLinks;
                    const filteredInLinks = showLinkFilter
                      ? selectedVerseIncomingLinks.filter(l => modalLinkTypeFilter === 'individual' ? l.src_verses.length === 1 : l.src_verses.length > 1)
                      : selectedVerseIncomingLinks;
                    return (
                      <View style={styles.sectionContainer}>
                        {showLinkFilter && (
                          <View style={{ flexDirection: 'row', gap: 8, marginBottom: Spacing.three }}>
                            {(['individual', 'group'] as const).map(type => {
                              const active = modalLinkTypeFilter === type;
                              const activeColor = type === 'group' ? '#F59E0B' : colors.accent;
                              const label = type === 'individual' ? 'Individual' : 'Grupo';
                              return (
                                <Pressable key={type} onPress={() => { setModalLinkTypeFilter(type); Vibration.vibrate(10); }}
                                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderRadius: 10, borderWidth: 1.5, borderColor: active ? activeColor : (isDark ? '#2D2927' : '#E6DEC9'), backgroundColor: active ? (type === 'group' ? 'rgba(245,158,11,0.1)' : colors.accentSubtle) : 'transparent' }}>
                                  <Text style={{ fontSize: 13, fontWeight: '700', color: active ? activeColor : colors.textSecondary }}>{label}</Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        )}
                        {filteredOutLinks.length === 0 && filteredInLinks.length === 0 ? (
                          <View style={{ backgroundColor: isDark ? '#1C1A19' : '#FDFBF7', borderColor: isDark ? '#2D2927' : '#E6DEC9', borderWidth: 1.5, borderStyle: 'dashed', padding: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: colors.textMuted, fontStyle: 'italic', fontSize: 13 }}>Nenhum vínculo neste versículo.</Text>
                          </View>
                        ) : (
                          <>
                            {/* Vínculos de saída */}
                            {filteredOutLinks.length > 0 && (
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                {filteredOutLinks.map((link) => {
                                  const tgtRange = link.tgt_verses.length === 1
                                    ? String(link.tgt_verses[0])
                                    : `${Math.min(...link.tgt_verses)}-${Math.max(...link.tgt_verses)}`;
                                  const isGroup = link.src_verses.length > 1;
                                  const bColor = isGroup ? '#F59E0B' : colors.accent;
                                  return (
                                    <Pressable
                                      key={`bl_${link.id}`}
                                      onPress={() => { setLinkDetailModal({ link, isIncoming: false }); Vibration.vibrate(10); }}
                                      style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        backgroundColor: isDark ? '#1C1A19' : '#FFF',
                                        borderRadius: 8,
                                        borderWidth: 1.5,
                                        borderColor: isDark ? '#2D2927' : '#E6DEC9',
                                        borderLeftColor: bColor,
                                        borderLeftWidth: 3,
                                        paddingVertical: 8,
                                        paddingLeft: 10,
                                        paddingRight: 6,
                                        justifyContent: 'space-between',
                                        width: '48%',
                                      }}
                                    >
                                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <Link size={12} color={bColor} />
                                        <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: bColor, fontWeight: '700', fontSize: 13, flex: 1 }}>
                                          {link.tgt_book_name} {link.tgt_chapter}:{tgtRange}
                                        </Text>
                                      </View>
                                      <Pressable
                                        onPress={(e) => {
                                          e.stopPropagation();
                                          removeBlockLink(link.id);
                                          Vibration.vibrate(20);
                                          dbModifiedRef.modified = true;
                                          const bl = getBlockLinksFromVerse(selectedVerse!.book_id, selectedVerse!.chapter, selectedVerse!.verse);
                                          setSelectedVerseBlockLinks(bl);
                                          setSelectedVerseIncomingLinks(getBlockLinksToVerse(selectedVerse!.book_id, selectedVerse!.chapter, selectedVerse!.verse));
                                          const newCorr = getBlockLinkSrcVerseNumsForChapter(selectedBook!.id, selectedChapter);
                                          const newGroupCorr = getBlockLinkGroupSrcVerseNumsForChapter(selectedBook!.id, selectedChapter);
                                          setCorrelatedVerseNums(newCorr);
                                          setGroupCorrVerseNums(newGroupCorr);
                                          const newTgt2 = getBlockLinkTgtVerseNumsForChapter(selectedBook!.id, selectedChapter);
                                          setTgtVerseNums(newTgt2);
                                          const savedNums = verses.filter(v => v.is_favorite).map(v => v.verse);
                                          const corrArr = Array.from(newCorr);
                                          const groupCorrArr = Array.from(newGroupCorr);
                                          pendingBadgeUpdateRef.current = () => bibleReaderRef.current?.updateBadges(Array.from(noteVerseNums), corrArr, Array.from(groupNoteVerseNums), groupCorrArr, savedNums, Array.from(groupNoteWithNotesVerseNums), Array.from(newTgt2));
                                        }}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        style={{ padding: 2, marginLeft: 4 }}
                                      >
                                        <X size={13} color={colors.error} />
                                      </Pressable>
                                    </Pressable>
                                  );
                                })}
                              </View>
                            )}

                            {/* Links de entrada (referenciado por) */}
                            {filteredInLinks.length > 0 && (
                              <>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: filteredOutLinks.length > 0 ? 16 : 0, marginBottom: 8 }}>
                                  <View style={{ flex: 1, height: 1, backgroundColor: isDark ? '#2D2927' : '#E6DEC9' }} />
                                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 1 }}>REFERENCIADO POR</Text>
                                  <View style={{ flex: 1, height: 1, backgroundColor: isDark ? '#2D2927' : '#E6DEC9' }} />
                                </View>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                  {filteredInLinks.map((link) => {
                                    const srcRange = link.src_verses.length === 1
                                      ? String(link.src_verses[0])
                                      : `${Math.min(...link.src_verses)}-${Math.max(...link.src_verses)}`;
                                    const isGroup = link.src_verses.length > 1;
                                    const bColor = isGroup ? '#F59E0B' : colors.accent;
                                    return (
                                      <Pressable
                                        key={`il_${link.id}`}
                                        onPress={() => { setLinkDetailModal({ link, isIncoming: true }); Vibration.vibrate(10); }}
                                        style={{
                                          flexDirection: 'row',
                                          alignItems: 'center',
                                          backgroundColor: isDark ? '#1C1A19' : '#FFF',
                                          borderRadius: 8,
                                          borderWidth: 1.5,
                                          borderColor: isDark ? '#2D2927' : '#E6DEC9',
                                          borderLeftColor: bColor,
                                          borderLeftWidth: 3,
                                          paddingVertical: 8,
                                          paddingLeft: 10,
                                          paddingRight: 6,
                                          opacity: 0.85,
                                          width: '48%',
                                        }}
                                      >
                                        <Link size={12} color={bColor} style={{ marginRight: 4 }} />
                                        <View style={{ flex: 1 }}>
                                          <Text style={{ color: bColor, fontSize: 13, fontWeight: '700' }}>
                                            {link.src_book_name ?? 'Livro'} {link.src_chapter}:{srcRange}
                                          </Text>
                                          <Text style={{ fontSize: 11, color: colors.textMuted }}>→ referencia este versículo</Text>
                                        </View>
                                      </Pressable>
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

                  <View style={{ height: Spacing.four }} />
                </ScrollView>
              </View>
              <Pressable
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: -1 }}
                onPress={() => setShowNoteDetailsModal(false)}
              />
            </GestureHandlerRootView>
          </Modal>
        );
      })()}

      {/* MODAL DE DETALHE DO VÍNCULO */}
      {linkDetailModal && (() => {
        const { link, isIncoming } = linkDetailModal;
        const bookId = isIncoming ? link.src_book_id : link.tgt_book_id;
        const chapter = isIncoming ? link.src_chapter : link.tgt_chapter;
        const verseNums = isIncoming ? link.src_verses : link.tgt_verses;
        const bookDisplayName = isIncoming ? (link.src_book_name ?? '') : (link.tgt_book_name ?? '');
        const verseRange = verseNums.length === 1
          ? String(verseNums[0])
          : `${Math.min(...verseNums)}-${Math.max(...verseNums)}`;
        const verseTexts = getVerses(bookId, chapter, [primaryVersion]).filter(v => verseNums.includes(v.verse));
        const bColor = link.src_verses.length > 1 ? '#F59E0B' : colors.accent;
        return (
          <Modal visible transparent animationType="fade" onRequestClose={() => setLinkDetailModal(null)}>
            <View style={{ flex: 1 }}>
              <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]} onPress={() => setLinkDetailModal(null)} />
              <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', padding: Spacing.four }]} pointerEvents="box-none">
              <View
                style={{ width: '100%', maxHeight: Dimensions.get('window').height * 0.75, backgroundColor: colors.card, borderRadius: 20, overflow: 'hidden' }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.four, borderBottomWidth: 1, borderBottomColor: isDark ? '#2D2927' : '#E6DEC9' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Link size={16} color={bColor} />
                    <Text style={{ color: bColor, fontWeight: 'bold', fontSize: 16, fontFamily: 'serif' }}>
                      {bookDisplayName} {chapter}:{verseRange}
                    </Text>
                  </View>
                  <Pressable onPress={() => setLinkDetailModal(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <X size={20} color={colors.textMuted} />
                  </Pressable>
                </View>
                <ScrollView bounces={false} style={{ flexGrow: 0 }} contentContainerStyle={{ padding: Spacing.four, gap: 12 }}>
                  {verseTexts.map(v => (
                    <View key={v.verse}>
                      <Text style={{ color: bColor, fontWeight: '700', fontSize: 13, marginBottom: 4 }}>{v.verse}</Text>
                      <Text style={{ color: colors.text, fontSize: 16, lineHeight: 26, fontFamily: 'serif', fontStyle: 'italic' }}>"{getVerseText(v, primaryVersion) ?? ''}"</Text>
                    </View>
                  ))}
                </ScrollView>
                <View style={{ padding: Spacing.four, borderTopWidth: 1, borderTopColor: isDark ? '#2D2927' : '#E6DEC9' }}>
                  <Pressable
                    style={{ backgroundColor: bColor, borderRadius: 12, paddingVertical: Spacing.three, alignItems: 'center' }}
                    onPress={() => {
                      setLinkDetailModal(null);
                      setShowNoteDetailsModal(false);
                      navigateToVerse(bookId, chapter, verseNums[0]);
                    }}
                  >
                    <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 14 }}>Ver capítulo</Text>
                  </Pressable>
                </View>
              </View>
              </View>
            </View>
          </Modal>
        );
      })()}

      {/* MODAL DE VÍNCULOS DE ENTRADA (ícone return) */}
      {incomingLinksModal && (() => {
        const { verse, links } = incomingLinksModal;
        const individualLinks = links.filter(l => l.src_verses.length === 1);
        const groupLinks = links.filter(l => l.src_verses.length > 1);
        const hasIndividual = individualLinks.length > 0;
        const hasGroup = groupLinks.length > 0;
        const showBoth = hasIndividual && hasGroup;
        const displayLinks = showBoth
          ? (incomingLinkTypeFilter === 'individual' ? individualLinks : groupLinks)
          : links;
        return (
          <Modal visible transparent animationType="fade" onRequestClose={() => setIncomingLinksModal(null)}>
            <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }} onPress={() => setIncomingLinksModal(null)}>
              <Pressable style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: insets.bottom + Spacing.two }} onPress={() => {}}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.backgroundElement, alignSelf: 'center', marginTop: Spacing.three, marginBottom: Spacing.two }} />
                <View style={{ paddingHorizontal: Spacing.four, paddingBottom: Spacing.two, borderBottomWidth: 1, borderBottomColor: colors.backgroundElement }}>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', fontFamily: 'serif' }}>
                    Vínculos para {selectedBook ? bookName(selectedBook.name_pt, selectedBook.name_en) : ''} {selectedChapter}:{verse}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                    {links.length} {links.length === 1 ? 'passagem vinculada' : 'passagens vinculadas'}
                  </Text>
                </View>
                {showBoth && (
                  <View style={{ flexDirection: 'row', marginHorizontal: Spacing.four, marginTop: Spacing.three, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderRadius: 10, padding: 3 }}>
                    <Pressable onPress={() => setIncomingLinkTypeFilter('individual')} style={{ flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8, backgroundColor: incomingLinkTypeFilter === 'individual' ? colors.accent : 'transparent' }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: incomingLinkTypeFilter === 'individual' ? '#FFF' : colors.textSecondary }}>Individual</Text>
                    </Pressable>
                    <Pressable onPress={() => setIncomingLinkTypeFilter('group')} style={{ flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8, backgroundColor: incomingLinkTypeFilter === 'group' ? '#F59E0B' : 'transparent' }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: incomingLinkTypeFilter === 'group' ? '#FFF' : colors.textSecondary }}>Grupo</Text>
                    </Pressable>
                  </View>
                )}
                <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ padding: Spacing.four }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
                    {displayLinks.map(link => {
                      const isGroup = link.src_verses.length > 1;
                      const bColor = isGroup ? '#F59E0B' : colors.accent;
                      const verseRange = isGroup
                        ? `${Math.min(...link.src_verses)}-${Math.max(...link.src_verses)}`
                        : String(link.src_verses[0]);
                      return (
                        <Pressable
                          key={link.id}
                          style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, borderColor: isDark ? '#2D2D2D' : '#E0D8C8', borderLeftWidth: 3, borderLeftColor: bColor, backgroundColor: isDark ? '#1C1A19' : '#FDFBF7', gap: 6 }}
                          onPress={() => {
                            setIncomingLinksModal(null);
                            if (isGroup) {
                              setLinkDetailModal({ link, isIncoming: true });
                            } else {
                              const srcVerse = getVerse(link.src_book_id, link.src_chapter, link.src_verses[0]);
                              if (!srcVerse) return;
                              setPreviewLinkedVerse({ ...srcVerse, book_name: link.src_book_name, _navigateBookId: link.src_book_id, _navigateChapter: link.src_chapter, _navigateVerse: link.src_verses[0] });
                            }
                          }}
                        >
                          <CornerUpLeft size={12} color={bColor} />
                          <Text style={{ fontSize: 13, fontWeight: 'bold', color: bColor }}>
                            {link.src_book_name ?? link.src_book_abbrev} {link.src_chapter}:{verseRange}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>
        );
      })()}

      {/* MODAL DE PRÉVIA DO VERSÍCULO VINCULADO */}
      {previewLinkedVerse && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPreviewLinkedVerse(null)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: Spacing.four }} onPress={() => setPreviewLinkedVerse(null)}>
            <Pressable style={{ width: '100%', backgroundColor: colors.card, borderRadius: 20, padding: Spacing.four, gap: Spacing.three }} onPress={() => {}}>
              <Text style={{ color: colors.accent, fontWeight: 'bold', fontSize: 15, fontFamily: 'serif' }}>
                {previewLinkedVerse.book_name ?? bookName(previewLinkedVerse.book_name ?? '', previewLinkedVerse.book_name_en)} {previewLinkedVerse.chapter}:{previewLinkedVerse.verse}
              </Text>
              <Text style={{ color: colors.text, fontSize: 16, lineHeight: 26, fontFamily: 'serif', fontStyle: 'italic' }}>
                "{previewLinkedVerse.text_ara}"
              </Text>
              <Pressable
                style={{ backgroundColor: colors.accent, borderRadius: 12, paddingVertical: Spacing.three, alignItems: 'center' }}
                onPress={() => {
                  const navBookId = previewLinkedVerse._navigateBookId ?? previewLinkedVerse.book_id;
                  const navChapter = previewLinkedVerse._navigateChapter ?? previewLinkedVerse.chapter;
                  const navVerse = previewLinkedVerse._navigateVerse ?? previewLinkedVerse.verse;
                  setPreviewLinkedVerse(null);
                  setShowNoteDetailsModal(false);
                  navigateToVerse(navBookId, navChapter, navVerse);
                }}
              >
                <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 14 }}>Ver capítulo</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  loadingText: {
    marginTop: Spacing.three,
    fontSize: 16,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    position: 'relative',
  },
  chapterHeading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterHeadingBook: {
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: Spacing.half,
  },
  chapterHeadingNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    lineHeight: 48,
  },
  primaryVersionSelector: {
    position: 'absolute',
    left: Spacing.three,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
  },
  primaryVersionText: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
  layoutToggle: {
    position: 'absolute',
    right: Spacing.three,
    padding: Spacing.two,
    borderRadius: Spacing.two,
  },
  inlineDivider: {
    height: 1,
    marginVertical: Spacing.two,
  },
  inlineActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.two,
    gap: Spacing.two,
  },
  inlineActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 6,
  },
  inlineActionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: 150,
  },
  verseBlock: {
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  verseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  verseNumber: {
    fontSize: 13,
    fontWeight: 'bold',
    marginRight: Spacing.two,
  },
  verseBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  verseText: {
    fontSize: 18,
    lineHeight: 28,
    fontFamily: 'serif',
  },
  comparisonContainer: {
    marginTop: Spacing.two,
    paddingLeft: Spacing.two,
    borderLeftWidth: 1.5,
    borderLeftColor: 'rgba(30, 64, 175, 0.2)',
    gap: Spacing.half,
  },
  comparisonText: {
    fontSize: 13,
    lineHeight: 18,
  },
  comparisonLabel: {
    fontWeight: 'bold',
  },
  /* Split View styles */
  splitGrid: {
    flex: 1,
  },
  splitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    height: 40,
  },
  splitSelectorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitSelector: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  splitSelectorText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  splitDivider: {
    width: 1,
    height: '100%',
  },
  splitRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    paddingVertical: Spacing.three,
  },
  splitCell: {
    flex: 1,
    paddingHorizontal: Spacing.two,
  },
  splitVerseNumber: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: Spacing.half,
  },
  splitVerseText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'serif',
  },
  chapterArrowsContainer: {
    position: 'absolute',
    bottom: 95,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 90,
  },
  arrowButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  /* Modal Styles */
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 200,
  },
  modalContent: {
    width: '90%',
    maxHeight: '75%',
    borderRadius: Spacing.three,
    padding: Spacing.four,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: Spacing.three,
  },
  selectorFullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 300,
  },
  fullScreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  fullScreenHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    height: 40,
    borderRadius: 20,
    borderWidth: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  tabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    paddingBottom: Spacing.two,
    marginVertical: Spacing.three,
  },
  tabHeaderItem: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  tabHeaderText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  testamentHeaderTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginVertical: Spacing.three,
  },
  booksList: {
    paddingHorizontal: 0,
  },
  bookRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bookRowText: {
    fontSize: 18,
  },
  bookRowProgress: {
    fontSize: 14,
  },
  testamentTabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    height: 54,
  },
  testamentTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testamentTabText: {
    fontSize: 15,
  },
  chapterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  modalSubTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  bypassButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.one,
  },
  bypassButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  closeButton: {
    marginTop: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  closeButtonText: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  chaptersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  chapterGridItem: {
    width: Math.floor(Dimensions.get('window').width / 6),
    height: Math.floor(Dimensions.get('window').width / 6),
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  chapterItemText: {
    fontSize: 16,
    lineHeight: 14,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginTop: -Spacing.one,
    marginBottom: Spacing.two,
    opacity: 0.25,
  },
  optionRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  optionIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionRowTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  drawerTabsBar: {
    flexDirection: 'row',
    width: '100%',
    borderBottomWidth: 1.5,
  },
  drawerTabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.three,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  drawerTabButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  /* Drawer Detail Sheet */
  drawerContent: {
    width: '100%',
    maxHeight: '85%',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    borderTopWidth: 1.5,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.three,
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  drawerClose: {
    padding: Spacing.two,
  },
  saveNoteBtn: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  saveNoteBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  inlineStudyActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Spacing.three,
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
  },
  inlineStudyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 20,
    gap: Spacing.two,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  inlineStudyButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  versePreviewContainer: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.four,
    borderLeftWidth: 3.5,
  },
  versePreviewText: {
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  drawerScroll: {
    flexGrow: 1,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: Spacing.two,
    gap: Spacing.two,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    flex: 1,
    gap: Spacing.one,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  sectionContainer: {
    marginTop: Spacing.three,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: Spacing.two,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  emptySectionText: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  linkedVerseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.two,
    borderRadius: Spacing.two,
    marginBottom: Spacing.two,
  },
  linkedReference: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: Spacing.half,
  },
  linkedText: {
    fontSize: 13,
  },
  linkedRemoveBtn: {
    padding: Spacing.one,
    marginLeft: Spacing.two,
  },
  linkForm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
    marginBottom: Spacing.two,
    flexWrap: 'wrap',
  },
  linkInput: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: 40,
    flex: 1,
  },
  linkSubmitBtn: {
    paddingHorizontal: Spacing.three,
    height: 40,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    width: '100%',
    color: '#B91C1C',
    fontSize: 12,
    marginTop: Spacing.half,
  },
  /* Lateral Compare Button */
  lateralCompareBtn: {
    marginLeft: 'auto',
    padding: Spacing.one,
    opacity: 0.55,
  },
  /* Floating Bottom Verse Selection Panel */
  bottomSelectPanel: {
    position: 'absolute',
    bottom: 105,
    left: 16,
    right: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 150,
  },
  bottomSelectIndicator: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignSelf: 'center',
    marginBottom: Spacing.two,
  },
  bottomSelectTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: Spacing.three,
    letterSpacing: 0.5,
  },
  colorPickerContainerCentered: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: Spacing.two,
  },
  colorPickerFloat: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 32,
    borderWidth: 1.5,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    zIndex: 90,
  },
  colorDotSpacious: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  activeColorDotSpacious: {
    borderWidth: 2,
    borderColor: '#3B82F6',
    transform: [{ scale: 1.18 }],
  },
  colorDotClearSpacious: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelDivider: {
    height: 1,
    marginVertical: Spacing.four,
    width: '100%',
    opacity: 0.5,
  },
  bottomSelectActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    gap: Spacing.two,
  },
  spaciousActionBtn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: 14,
    gap: 6,
    height: 60,
  },
  spaciousActionText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },
  /* Dotted Line Separator */
  interlinearPanel: {
    position: 'absolute',
    bottom: 95,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    zIndex: 85,
    paddingBottom: 4,
  },
  interlinearWordModal: {
    width: '88%',
    borderRadius: 16,
    padding: Spacing.four,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  dottedLine: {
    borderWidth: 0.4,
    borderStyle: 'dashed',
    height: 1,
    width: '100%',
    marginTop: 3,
  },
  /* Version selector modal styles */
  versionModalContent: {
    width: '90%',
    maxHeight: '75%',
    borderRadius: Spacing.three,
    padding: Spacing.four,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  versionModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  versionModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  versionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  versionItemText: {
    fontSize: 15,
  },
  /* LinkSelector & Correlations Premium Styles */
  staticNoteContainer: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderLeftWidth: 3.5,
    marginVertical: Spacing.one,
  },
  staticNoteText: {
    fontSize: 15,
    lineHeight: 22,
  },
  emptyNoteText: {
    fontSize: 14,
    fontStyle: 'italic',
    marginVertical: Spacing.two,
  },
  editNoteBtn: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  editNoteBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  addLinkBtn: {
    borderWidth: 1.5,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  addLinkBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  correlationsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: Spacing.two,
  },
  correlationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '48.5%',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
  },
  correlationText: {
    fontSize: 14,
  },
  linkModalContent: {
    width: '95%',
    height: '80%',
    borderRadius: 20,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  linkModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1.5,
  },
  linkModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  backBtn: {
    padding: Spacing.one,
    marginRight: Spacing.half,
  },
  linkSearchInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    height: 48,
    fontSize: 15,
    marginBottom: Spacing.three,
  },
  testamentLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.two,
    marginTop: Spacing.one,
  },
  booksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bookGridItem: {
    width: '31.3%',
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bookGridText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  numbersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
    paddingBottom: Spacing.four,
  },
  numberGridItem: {
    width: '18%',
    aspectRatio: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  numberGridText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  linkModalFooter: {
    padding: Spacing.three,
    borderTopWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  linkSelectionSummary: {
    fontSize: 12,
    flex: 1,
  },
  linkConfirmBtn: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkConfirmBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  verseMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
    paddingLeft: Spacing.two,
  },
  verseNoteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.one,
    maxWidth: 180,
  },
  verseNoteBadgeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  verseLinkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.one,
    borderWidth: 1,
  },
  verseLinkBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  highlightedVerseNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  normalVerseNumberContainer: {
    marginRight: 6,
    paddingVertical: 2,
  },
  verseNumberText: {
    fontSize: 15,
  },
});
