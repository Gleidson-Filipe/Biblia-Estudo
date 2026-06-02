import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { unstable_batchedUpdates } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import {
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
  InteractionManager,
  Modal,
  Vibration,
} from 'react-native';
import { Pressable as GHPressable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useNavigation, useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { BookOpen, ChevronDown, ChevronLeft, ChevronUp, GripVertical, Heart, MessageSquare, Split, Share2, Search, X, Link, AlignJustify } from 'lucide-react-native';
import SortableVersionList from '@/components/sortable-version-list';
import { Colors, Spacing, BottomTabInset } from '@/constants/theme';
import Svg, { Line } from 'react-native-svg';
import { verseContextRef, activeStudyVerseRef } from '@/components/verse-context-ref';
import { initializeDatabase } from '@/database/db';
import {
  getBooks,
  getChaptersCount,
  getVersesCount,
  getVerses,
  toggleFavorite,
  saveNote,
  deleteNote,
  addCorrelation,
  removeCorrelation,
  getVerse,
  Book,
  Verse,
} from '@/database/queries';

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
      setVersesCount(getVerses(selBook.id, selChapter).length);
    }
  }, [selBook, selChapter]);

  const chaptersCount = selBook ? getChaptersCount(selBook.id) : 0;

  const isSearching = bookSearch.length > 0;
  const filteredBooks = books.filter(b => {
    const match = b.name_pt.toLowerCase().includes(bookSearch.toLowerCase()) ||
                  b.abbrev.toLowerCase().includes(bookSearch.toLowerCase());
    if (isSearching) return match;
    return match && (testament === 'old' ? b.id <= 39 : b.id > 39);
  });

  return (
    <SafeAreaView style={[styles.selectorFullScreen, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.fullScreenHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
        <Text style={[styles.fullScreenHeaderTitle, { color: colors.text, fontFamily: 'serif' }]}>
          {isLinkingMode ? 'Vincular Versículo' : (step === 'book' ? 'Índice' : selBook?.name_pt ?? 'Índice')}
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
                  <Text style={[styles.bookRowText, { color: selBook?.id === item.id ? colors.accent : colors.text, fontFamily: 'serif', fontWeight: selBook?.id === item.id ? 'bold' : 'normal' }]}>{item.name_pt}</Text>
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
            <Text style={[styles.modalSubTitle, { color: colors.text, fontFamily: 'serif' }]}>{selBook?.name_pt}</Text>
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
            {selBook?.name_pt} {selChapter} — Escolha o Versículo
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
    </SafeAreaView>
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

const DottedText = memo(({ text, isSelected, dotColor, textStyle, textColor }: {
  text: string; isSelected: boolean; dotColor: string; textStyle: any; textColor: string;
}) => {
  const [lines, setLines] = React.useState<{ width: number; y: number }[]>([]);

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
      {isSelected && (
        lines.length > 0 ? lines.map((line, i) => (
          <Svg key={i} width={line.width} height="3" style={{ position: 'absolute', top: line.y, left: 0 }}>
            <Line x1="0" y1="1.5" x2={line.width} y2="1.5" stroke={dotColor} strokeWidth="1.5" strokeDasharray="1,4" strokeLinecap="round" />
          </Svg>
        )) : (
          <Svg width="100%" height="3" style={{ marginTop: 2 }}>
            <Line x1="0" y1="1.5" x2="10000" y2="1.5" stroke={dotColor} strokeWidth="1.5" strokeDasharray="1,4" strokeLinecap="round" />
          </Svg>
        )
      )}
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
}: VerseRowProps) => {
  const suppressNextPress = React.useRef(false);

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
    <GHPressable
      onLayout={onLayout}
      onPress={() => { setTimeout(() => { if (suppressNextPress.current) { suppressNextPress.current = false; return; } onPress(item); }, 0); }}
    >
      <View style={styles.verseHeader}>
        <Pressable
          onPress={() => {
            suppressNextPress.current = true;
            setTimeout(() => { suppressNextPress.current = false; }, 500);
            if ((hasNote || hasCorrelations) && onPressNoteNumber) onPressNoteNumber();
          }}
          disabled={!hasNote && !hasCorrelations}
          onStartShouldSetResponderCapture={() => !!(hasNote || hasCorrelations)}
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
        <GHPressable
          style={[styles.lateralCompareBtn, { marginLeft: 'auto', opacity: 0.9 }]}
          onPress={() => { suppressNextPress.current = true; setTimeout(() => { suppressNextPress.current = false; }, 500); onPressCompare(); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {hasCorrelations && (
              <Link size={14} color={colors.accent} />
            )}
            <BookOpen size={16} color={colors.textSecondary} />
          </View>
        </GHPressable>
      </View>
      <DottedText
        text={text}
        isSelected={isSelected}
        dotColor={savedHighlightColor || '#ffffff'}
        textStyle={styles.verseText}
        textColor={colors.text}
      />
    </GHPressable>
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.text === nextProps.text &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.savedHighlightColor === nextProps.savedHighlightColor &&
    prevProps.isFav === nextProps.isFav &&
    prevProps.hasNote === nextProps.hasNote &&
    prevProps.hasCorrelations === nextProps.hasCorrelations &&
    prevProps.primaryVersion === nextProps.primaryVersion &&
    prevProps.colors === nextProps.colors &&
    prevProps.item.correlations?.length === nextProps.item.correlations?.length
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
}: SplitVerseRowProps) => {
  return (
    <Pressable
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



export default function BibleReaderScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];
  const navigation = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams<{ bookId?: string; chapter?: string; verse?: string; openLinkSelector?: string }>();

  const flatListRef = useRef<FlatList>(null);
  const itemOffsetsRef = useRef<number[]>([]);
  const [highlightedVerse, setHighlightedVerse] = useState<number | null>(null);
  const scrollToVerseRef = useRef<number | null>(null);
  const activeSelectedVerseStateRef = useRef<Verse | null>(null);
  const verseHighlightsRef = useRef<Record<string, string>>({});

  // State
  const [dbReady, setDbReady] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [chaptersCount, setChaptersCount] = useState(0);
  const [verses, setVerses] = useState<Verse[]>([]);
  
  // Selection / Navigation Sheets (Step-by-step)
  const [showSelector, setShowSelector] = useState(false);
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
  const [verseHighlights, setVerseHighlights] = useState<Record<string, string>>({});
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [versionOrder, setVersionOrder] = useState<('ara'|'arc'|'kjv'|'dby')[]>(['ara','arc','kjv','dby']);
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

  // Sync refs for use in stable callbacks
  activeSelectedVerseStateRef.current = activeSelectedVerse;
  verseHighlightsRef.current = verseHighlights;

  const handleVersePress = useCallback((item: Verse) => {
    const cur = activeSelectedVerseStateRef.current;
    const highlights = verseHighlightsRef.current;
    const highlightKey = `${item.book_id}_${item.chapter}_${item.verse}`;
    const savedColor = highlights[highlightKey] || null;
    unstable_batchedUpdates(() => {
      setHighlightedVerse(null);
      setActiveStudyVerse(null);
      if (cur?.verse === item.verse && cur?.chapter === item.chapter) {
        setActiveSelectedVerse(null);
        setActiveColor(null);
      } else {
        setActiveSelectedVerse(item);
        setActiveColor(savedColor);
      }
    });
  }, []);

  useEffect(() => {
    (navigation.setParams as any)({
      showSelector: showSelector || showDetailSheet,
      verseSelected: !!activeSelectedVerse
    });
  }, [showSelector, showDetailSheet, activeSelectedVerse, navigation]);

  // sempre atualiza o ref primeiro
  activeSelectedVerseRef.current = activeSelectedVerse;

  useEffect(() => {
    if (!activeSelectedVerse) { verseContextRef.current = null; return; }
    verseContextRef.current = {
      label: selectedBook ? `${selectedBook.name_pt} ${activeSelectedVerse.chapter}:${activeSelectedVerse.verse}` : '',
      activeColor,
      onAnnotation: () => {
        const v = activeSelectedVerseRef.current;
        if (!v) return;
        setActiveSelectedVerse(null);
        activeStudyVerseRef.set(v, selectedBook?.name_pt ?? '', primaryVersion);
        router.navigate('/study');
      },
      onCopy: () => {
        const v = activeSelectedVerseRef.current;
        if (!v) return;
        Clipboard.setString(`[${primaryVersion.toUpperCase()}] ${selectedBook?.name_pt ?? ''} ${v.chapter}:${v.verse} - "${getVerseText(v, primaryVersion)}"`);
        setActiveSelectedVerse(null);
      },
      onCompare: () => {
        const v = activeSelectedVerseRef.current;
        if (!v) return;
        setSelectedVerse(v);
        setShowVersionModal(true);
        setActiveSelectedVerse(null);
      },
      onShare: async () => {
        const v = activeSelectedVerseRef.current;
        if (!v) return;
        await Share.share({ message: `${selectedBook?.name_pt ?? ''} ${v.chapter}:${v.verse}\n\n${getVerseText(v, primaryVersion)}` });
      },
      onClose: () => setActiveSelectedVerse(null),
      onColorSelect: (color: string) => {
        const v = activeSelectedVerseRef.current;
        if (!v) return;
        setActiveColor(color);
        const highlightKey = `${v.book_id}_${v.chapter}_${v.verse}`;
        setVerseHighlights(prev => ({ ...prev, [highlightKey]: color }));
        saveHighlight(v.book_id, v.chapter, v.verse, color);
      },
      onColorClear: () => {
        const v = activeSelectedVerseRef.current;
        if (!v) return;
        setActiveColor(null);
        const highlightKey = `${v.book_id}_${v.chapter}_${v.verse}`;
        setVerseHighlights(prev => { const n = { ...prev }; delete n[highlightKey]; return n; });
        saveHighlight(v.book_id, v.chapter, v.verse, '');
      },
    };
  }, [activeSelectedVerse, selectedBook, primaryVersion, expandedVerse, activeColor]);

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
    if (dbReady && books.length > 0 && params.bookId && params.chapter) {
      const bookIdNum = Number(params.bookId);
      const chapterNum = Number(params.chapter);
      const verseNum = params.verse ? Number(params.verse) : undefined;
      const shouldLink = params.openLinkSelector === 'true';
      
      const targetBook = books.find(b => b.id === bookIdNum);
      if (targetBook) {
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
          scrollToVerseRef.current = verseNum;
        } else {
          setHighlightedVerse(null);
          scrollToVerseRef.current = null;
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
    
    const loadedVerses = getVerses(selectedBook.id, chap);
    setVerses(loadedVerses);
    setExpandedVerse(null);
    itemOffsetsRef.current = [];
    FileSystem.writeAsStringAsync(
      FileSystem.documentDirectory + 'lastPosition.json',
      JSON.stringify({ bookId: selectedBook.id, chapter: chap })
    ).catch(() => {});
  }, [dbReady, selectedBook, selectedChapter]);

  const openSelector = () => setShowSelector(true);

  // Load note when selected verse changes
  useEffect(() => {
    if (selectedVerse) {
      setNoteText(selectedVerse.note_content || '');
    }
  }, [selectedVerse]);

  // Reload verses when returning from annotation screen
  useFocusEffect(
    useCallback(() => {
      if (dbReady && selectedBook) {
        setVerses(getVerses(selectedBook.id, selectedChapter));
      }
    }, [dbReady, selectedBook, selectedChapter])
  );

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

  const handlePrevChapter = () => {
    if (selectedChapter > 1) {
      setSelectedChapter(selectedChapter - 1);
    } else if (selectedBook && selectedBook.id > 1) {
      const prevBook = books[selectedBook.id - 2];
      setSelectedBook(prevBook);
      setSelectedChapter(getChaptersCount(prevBook.id));
    }
  };

  const handleNextChapter = () => {
    if (selectedChapter < chaptersCount) {
      setSelectedChapter(selectedChapter + 1);
    } else if (selectedBook && selectedBook.id < 66) {
      const nextBook = books[selectedBook.id];
      setSelectedBook(nextBook);
      setSelectedChapter(1);
    }
  };

  const getVerseText = (verse: Verse, version: 'ara' | 'arc' | 'kjv' | 'dby') => {
    switch (version) {
      case 'ara': return verse.text_ara;
      case 'arc': return verse.text_arc;
      case 'kjv': return verse.text_kjv;
      case 'dby': return verse.text_dby;
    }
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
    setVerses(getVerses(selectedBook.id, selectedChapter));
  };


  const renderDottedText = (text: string, isSelected: boolean, savedHighlightColor: string | null, textStyle: any = styles.verseText) => {
    const dotColor = savedHighlightColor || '#ffffff';
    const words = text.split(' ');
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {words.map((word, idx) => (
          <View key={idx} style={{ marginRight: 6, marginBottom: 4 }}>
            <Text style={[textStyle, { color: colors.text }]}>{word}</Text>
            <Svg width="100%" height="3">
              <Line
                x1="0" y1="1.5" x2="10000" y2="1.5"
                stroke={dotColor}
                strokeWidth="1.5"
                strokeDasharray="0.5,4"
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
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

        <Pressable style={styles.chapterHeading} onPress={openSelector}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={[styles.chapterHeadingBook, { color: colors.textSecondary, fontFamily: 'serif' }]}>
              {selectedBook.name_pt}
            </Text>
            <ChevronDown size={11} color={colors.textSecondary} />
          </View>
          <Text style={[styles.chapterHeadingNumber, { color: colors.text, fontFamily: 'serif' }]}>
            {selectedChapter}
          </Text>
        </Pressable>

        {/* Layout Toggle */}
        <Pressable
          style={[styles.layoutToggle, { backgroundColor: colors.backgroundElement }]}
          onPress={() => setLayoutMode(layoutMode === 'stacked' ? 'split' : 'stacked')}
        >
          <Split size={18} color={colors.text} />
        </Pressable>
      </View>

      {/* Reader Body */}
      {layoutMode === 'stacked' ? (
        <FlatList
          ref={flatListRef}
          onScrollToIndexFailed={(info) => {
            flatListRef.current?.scrollToOffset({
              offset: info.highestMeasuredFrameIndex * 80,
              animated: false,
            });
            setTimeout(() => {
              try {
                flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
              } catch (e) {}
            }, 100);
          }}
          data={verses}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          maxToRenderPerBatch={8}
          windowSize={10}
          initialNumToRender={20}
          extraData={activeSelectedVerse?.verse}
          renderItem={({ item }) => {
            const hasNote = !!item.note_content;
            const isFav = !!item.is_favorite;
            const highlightKey = `${selectedBook.id}_${selectedChapter}_${item.verse}`;
            const savedHighlightColor = verseHighlights[highlightKey];
            const isSelected = activeSelectedVerse?.verse === item.verse;
            
            return (
              <VerseRow
                item={item}
                text={getVerseText(item, primaryVersion)}
                isSelected={isSelected}
                isFav={isFav}
                hasNote={hasNote}
                hasCorrelations={!!(item.correlations && item.correlations.length > 0)}
                savedHighlightColor={savedHighlightColor}
                primaryVersion={primaryVersion}
                colors={colors}
                onPress={handleVersePress}
                onPressCompare={() => {
                  setHighlightedVerse(null);
                  setSelectedVerse(item);
                  setShowCompareModal(true);
                }}
                onPressNoteNumber={() => {
                  setSelectedVerse(item);
                  setShowNoteDetailsModal(true);
                }}
                onLayout={(e) => {
                  const h = e.nativeEvent.layout.height;
                  itemOffsetsRef.current[item.verse - 1] = h;
                  if (scrollToVerseRef.current === item.verse) {
                    scrollToVerseRef.current = null;
                    const offset = itemOffsetsRef.current.slice(0, item.verse - 1).reduce((a, b) => a + (b || 0), 0);
                    flatListRef.current?.scrollToOffset({ offset, animated: false });
                  }
                }}
              />
            );
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
            ref={flatListRef}
            onScrollToIndexFailed={(info) => {
              flatListRef.current?.scrollToOffset({
                offset: info.highestMeasuredFrameIndex * 80,
                animated: false,
              });
              setTimeout(() => {
                try {
                  flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
                } catch (e) {}
              }, 100);
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
                  hasCorrelations={!!(item.correlations && item.correlations.length > 0)}
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
                  onPressNoteNumber={() => {
                    setSelectedVerse(item);
                    setShowNoteDetailsModal(true);
                  }}
                />
              );
            }}
          />
        </View>
      )}

      {/* FLOATING BOTTOM VERSE SELECTION PANEL (MATCHING REFERENCE IMAGE 1) */}

      {/* Navigation Buttons for chapters at the very bottom right/left of container */}
      <View style={styles.chapterArrowsContainer} pointerEvents="box-none">
        <Pressable
          style={[styles.arrowButton, { backgroundColor: colors.backgroundElement }]}
          onPress={handlePrevChapter}
        >
          <Text style={{ color: colors.text, fontSize: 18 }}>←</Text>
        </Pressable>
        <Pressable
          style={[styles.arrowButton, { backgroundColor: colors.backgroundElement }]}
          onPress={handleNextChapter}
        >
          <Text style={{ color: colors.text, fontSize: 18 }}>→</Text>
        </Pressable>
      </View>

      {/* VERSION SELECTOR MODAL / SHEET */}
      {showVersionModal && (
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowVersionModal(false)} />
          <View style={[styles.versionModalContent, { backgroundColor: colors.card, borderColor: colors.backgroundElement }]}>
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
          </View>
        </View>
      )}

      {/* PASSAGE SELECTOR */}
      {showSelector && (
        <PassageSelector
          books={books}
          initialBook={selectedBook}
          initialChapter={selectedChapter}
          initialVerse={isLinkingFromSelector ? (selectedVerse?.verse || null) : highlightedVerse}
          isDark={isDark}
          colors={colors}
          isLinkingMode={isLinkingFromSelector}
          linkingTargetText={selectedVerse ? `${selectedBook?.name_pt} ${selectedVerse.chapter}:${selectedVerse.verse}` : ''}
          onClose={() => {
            setShowSelector(false);
            if (isLinkingFromSelector) {
              setIsLinkingFromSelector(false);
              setShowDetailSheet(true);
            }
          }}
          onConfirm={(book, chapter, verse) => {
            if (isLinkingFromSelector && selectedVerse) {
              addCorrelation(
                selectedVerse.book_id,
                selectedVerse.chapter,
                selectedVerse.verse,
                book.id,
                chapter,
                verse || 1
              );
              setIsLinkingFromSelector(false);
              setShowSelector(false);
              
              // Refresh
              const updated = getVerses(selectedBook!.id, selectedChapter);
              setVerses(updated);
              const updatedVerse = updated.find(v => v.verse === selectedVerse.verse);
              if (updatedVerse) {
                setSelectedVerse(updatedVerse);
              }
              setShowDetailSheet(true);
            } else {
              setSelectedBook(book);
              setSelectedChapter(chapter);
              setShowSelector(false);
              itemOffsetsRef.current = [];
              if (verse !== undefined) {
                setHighlightedVerse(verse);
                scrollToVerseRef.current = verse;
              } else {
                setHighlightedVerse(null);
                scrollToVerseRef.current = null;
                flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
              }
            }
          }}
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
                  {selectedBook?.name_pt} {selectedVerse.chapter}:{selectedVerse.verse}
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
                    activeStudyVerseRef.set(selectedVerse, selectedBook?.name_pt ?? '', primaryVersion);
                    router.navigate('/study');
                  }}
                >
                  <View style={[styles.optionIconContainer, { backgroundColor: colors.backgroundElement }]}>
                    <MessageSquare size={18} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionRowTitle, { color: colors.text }]}>Estudo & Anotações</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>Ver notas de estudo, referências cruzadas ou vincular passagens</Text>
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
                    setVerses(getVerses(selectedBook!.id, selectedChapter));
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

                {/* 5. Compartilhar */}
                <Pressable
                  style={styles.optionRowItem}
                  onPress={async () => {
                    setShowOptionsSheet(false);
                    const text = `${selectedBook?.name_pt} ${selectedVerse.chapter}:${selectedVerse.verse}\n\n${primaryVersion.toUpperCase()}: "${getVerseText(selectedVerse, primaryVersion)}"\n\nCompartilhado via Scriptura.`;
                    await Share.share({ message: text });
                  }}
                >
                  <View style={[styles.optionIconContainer, { backgroundColor: colors.backgroundElement }]}>
                    <Share2 size={18} color={colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionRowTitle, { color: colors.text }]}>Compartilhar Passagem</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>Enviar texto bíblico para outras redes</Text>
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
                  {selectedBook?.name_pt} {selectedVerse.chapter}:{selectedVerse.verse}
                </Text>
                <Pressable
                  onPress={() => setShowDetailSheet(false)}
                  style={styles.drawerClose}
                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                >
                  <X size={22} color={colors.textSecondary} />
                </Pressable>
              </View>

              {/* Dynamic Tabs Bar at the top of the Drawer */}
              <View style={[styles.drawerTabsBar, { borderBottomColor: colors.backgroundElement }]}>
                <Pressable
                  style={[styles.drawerTabButton, detailMode === 'note' && { borderBottomColor: colors.accent }]}
                  onPress={() => setDetailMode('note')}
                >
                  <MessageSquare size={15} color={detailMode === 'note' ? colors.accent : colors.textSecondary} />
                  <Text style={[styles.drawerTabButtonText, { color: detailMode === 'note' ? colors.text : colors.textSecondary }]}>
                    Anotação
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.drawerTabButton, detailMode === 'links' && { borderBottomColor: colors.accent }]}
                  onPress={() => setDetailMode('links')}
                >
                  <Link size={15} color={detailMode === 'links' ? colors.accent : colors.textSecondary} />
                  <Text style={[styles.drawerTabButtonText, { color: detailMode === 'links' ? colors.text : colors.textSecondary }]}>
                    Relacionados
                  </Text>
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
                            bookName: selectedBook?.name_pt ?? '',
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

                      {selectedVerse.correlations && selectedVerse.correlations.length > 0 ? (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.one }}>
                          {selectedVerse.correlations.map((linked) => (
                            <View
                              key={`${linked.book_id}_${linked.chapter}_${linked.verse}`}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: colors.backgroundElement,
                                paddingVertical: 6,
                                paddingHorizontal: 12,
                                borderRadius: 20,
                                borderWidth: 1,
                                borderColor: colors.backgroundElement,
                              }}
                            >
                              <Pressable
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                                onPress={() => {
                                  setShowDetailSheet(false);
                                  navigateToVerse(linked.book_id, linked.chapter, linked.verse);
                                }}
                              >
                                <Link size={12} color={colors.accent} />
                                <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 13 }}>
                                  {linked.book_name} {linked.chapter}:{linked.verse}
                                </Text>
                              </Pressable>
                              
                              <Pressable
                                onPress={() => {
                                  removeCorrelation(
                                    selectedVerse.book_id, selectedVerse.chapter, selectedVerse.verse,
                                    linked.book_id, linked.chapter, linked.verse
                                  );
                                  Vibration.vibrate(20);
                                  // Refresh verses and drawer state!
                                  const updated = getVerses(selectedBook!.id, selectedChapter);
                                  setVerses(updated);
                                  const updatedVerse = updated.find(v => v.verse === selectedVerse.verse);
                                  if (updatedVerse) {
                                    setSelectedVerse(updatedVerse);
                                  }
                                }}
                                style={{ marginLeft: 8 }}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              >
                                <X size={13} color="#EF4444" />
                              </Pressable>
                            </View>
                          ))}
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
      {showCompareModal && selectedVerse && (() => {
        const versionMeta: Record<string, { label: string; fullName: string; italic?: boolean }> = {
          ara: { label: 'ARA', fullName: 'Almeida Revista e Atualizada' },
          arc: { label: 'ARC', fullName: 'Almeida Revista e Corrigida' },
          kjv: { label: 'KJV', fullName: 'King James Version', italic: true },
          dby: { label: 'DARBY', fullName: "Darby's Translation 1890", italic: true },
        };
        const versionText: Record<string, string | undefined> = {
          ara: selectedVerse.text_ara,
          arc: selectedVerse.text_arc,
          kjv: selectedVerse.text_kjv,
          dby: selectedVerse.text_dby,
        };
        return (
          <Modal
            visible={showCompareModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowCompareModal(false)}
          >
            <GestureHandlerRootView style={{ flex: 1, justifyContent: 'flex-end' }}>
              <View
                style={[
                  styles.drawerContent,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.backgroundElement,
                    marginBottom: keyboardHeight,
                    height: showVersionOrderConfig ? '55%' : '75%',
                    borderTopLeftRadius: Spacing.four,
                    borderTopRightRadius: Spacing.four,
                    paddingTop: Spacing.three,
                    paddingBottom: Spacing.four,
                    zIndex: 1,
                  }
                ]}
              >
                {/* Drag Handle */}
                <View style={[styles.dragHandle, { backgroundColor: colors.backgroundElement }]} />

                {/* Header */}
                <View style={[styles.drawerHeader, { borderBottomWidth: 1.5, borderBottomColor: colors.backgroundElement, paddingBottom: Spacing.three, marginBottom: Spacing.two }]}>
                  <View>
                    <Text style={[styles.drawerTitle, { color: colors.text, fontFamily: 'serif' }]}>
                      {selectedBook?.name_pt} {selectedVerse.chapter}:{selectedVerse.verse}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                      {showVersionOrderConfig ? 'Reordenar traduções' : 'Comparação de Traduções'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                    <Pressable
                      onPress={() => setShowVersionOrderConfig(v => !v)}
                      style={[styles.drawerClose, showVersionOrderConfig && { backgroundColor: colors.accent + '25', borderRadius: 8 }]}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <AlignJustify size={20} color={showVersionOrderConfig ? colors.accent : colors.textSecondary} />
                    </Pressable>
                    <Pressable
                      onPress={() => { setShowVersionModal(false); setShowCompareModal(false); setShowVersionOrderConfig(false); }}
                      style={styles.drawerClose}
                      hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                      <X size={22} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                </View>

                {/* SORT MODE / READ MODE */}
                {showVersionOrderConfig ? (
                  <SortableVersionList
                    order={versionOrder}
                    onOrderChange={(next) => setVersionOrder(next as ('ara'|'arc'|'kjv'|'dby')[])}
                    versionMeta={versionMeta}
                    colors={colors}
                    spacing={{ two: Spacing.two, three: Spacing.three }}
                  />
                ) : (
                  /* READ MODE: Scrollable translations */
                  <ScrollView
                    style={{ flex: 1 }}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ gap: Spacing.four, paddingBottom: Spacing.four }}
                    keyboardShouldPersistTaps="handled"
                  >
                    {versionOrder.map((key) => {
                      const meta = versionMeta[key];
                      const text = versionText[key];
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
              <Pressable
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: -1 }}
                onPress={() => { setShowCompareModal(false); setShowVersionOrderConfig(false); }}
              />
            </GestureHandlerRootView>
          </Modal>
        );
      })()}

      {/* Note Details and Linked Verses Modal */}
      {(() => {
        if (!selectedVerse || !showNoteDetailsModal) return null;
        return (
          <Modal
            visible={showNoteDetailsModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowNoteDetailsModal(false)}
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
                  }
                ]}
              >
                {/* Drag Handle */}
                <View style={[styles.dragHandle, { backgroundColor: colors.backgroundElement }]} />

                {/* Header */}
                <View style={[styles.drawerHeader, { borderBottomWidth: 1.5, borderBottomColor: colors.backgroundElement, paddingBottom: Spacing.three, marginBottom: Spacing.two }]}>
                  <View>
                    <Text style={[styles.drawerTitle, { color: colors.text, fontFamily: 'serif' }]}>
                      {selectedBook?.name_pt} {selectedVerse.chapter}:{selectedVerse.verse}
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

                <ScrollView style={styles.drawerScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {/* Note Section */}
                  <View style={styles.sectionContainer}>
                    <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Spacing.one }]}>Anotação Pessoal</Text>
                    {selectedVerse.note_content ? (
                      <View style={{ backgroundColor: isDark ? '#232120' : '#FAF6EE', borderLeftColor: colors.accent, borderLeftWidth: 3, padding: 12, borderRadius: 8 }}>
                        <Text style={{ color: colors.text, fontSize: 14, lineHeight: 22 }}>
                          {selectedVerse.note_content}
                        </Text>
                      </View>
                    ) : (
                      <Text style={{ color: colors.textMuted, fontStyle: 'italic', fontSize: 13 }}>
                        Nenhuma anotação neste versículo ainda.
                      </Text>
                    )}
                  </View>

                  {/* Linked Verses Section */}
                  {selectedVerse.correlations && selectedVerse.correlations.length > 0 && (
                    <View style={[styles.sectionContainer, { marginTop: Spacing.three }]}>
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>Versículos Vinculados</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.two }}>
                        {selectedVerse.correlations.map((linked) => (
                          <View
                            key={`${linked.book_id}_${linked.chapter}_${linked.verse}`}
                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1E1E1E' : '#F5F5F5', borderRadius: 20, borderWidth: 1, borderColor: isDark ? '#333' : '#DDD', paddingVertical: 6, paddingLeft: 12, paddingRight: 6, gap: 6 }}
                          >
                            <Pressable onPress={() => setPreviewLinkedVerse(linked)}>
                              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>
                                {linked.book_name} {linked.chapter}:{linked.verse}
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() => {
                                removeCorrelation(selectedVerse.book_id, selectedVerse.chapter, selectedVerse.verse, linked.book_id, linked.chapter, linked.verse);
                                Vibration.vibrate(20);
                                const updated = getVerses(selectedBook!.id, selectedChapter);
                                setVerses(updated);
                                const updatedVerse = updated.find(v => v.verse === selectedVerse.verse);
                                if (updatedVerse) setSelectedVerse(updatedVerse);
                              }}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={{ padding: 2 }}
                            >
                              <X size={13} color={colors.textMuted} />
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  <View style={{ height: Spacing.four }} />
                </ScrollView>

                {/* Edit Button in footer */}
                <View style={{ paddingHorizontal: Spacing.four, paddingTop: Spacing.two }}>
                  <Pressable
                    style={[styles.editNoteBtn, { backgroundColor: colors.accent }]}
                    onPress={() => {
                      setShowNoteDetailsModal(false);
                      setActiveSelectedVerse(null);
                      activeStudyVerseRef.set(selectedVerse, selectedBook?.name_pt ?? '', primaryVersion, 'note');
                      router.navigate('/study');
                    }}
                  >
                    <Text style={styles.editNoteBtnText}>Editar no Painel de Estudo</Text>
                  </Pressable>
                </View>
              </View>
              <Pressable
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: -1 }}
                onPress={() => setShowNoteDetailsModal(false)}
              />
            </GestureHandlerRootView>
          </Modal>
        );
      })()}

      {/* MODAL DE PRÉVIA DO VERSÍCULO VINCULADO */}
      {previewLinkedVerse && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPreviewLinkedVerse(null)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: Spacing.four }} onPress={() => setPreviewLinkedVerse(null)}>
            <Pressable style={{ width: '100%', backgroundColor: colors.card, borderRadius: 20, padding: Spacing.four, gap: Spacing.three }} onPress={() => {}}>
              <Text style={{ color: colors.accent, fontWeight: 'bold', fontSize: 15, fontFamily: 'serif' }}>
                {previewLinkedVerse.book_name} {previewLinkedVerse.chapter}:{previewLinkedVerse.verse}
              </Text>
              <Text style={{ color: colors.text, fontSize: 16, lineHeight: 26, fontFamily: 'serif', fontStyle: 'italic' }}>
                "{previewLinkedVerse.text_ara}"
              </Text>
              <Pressable
                style={{ backgroundColor: colors.accent, borderRadius: 12, paddingVertical: Spacing.three, alignItems: 'center' }}
                onPress={() => {
                  setPreviewLinkedVerse(null);
                  setShowNoteDetailsModal(false);
                  navigateToVerse(previewLinkedVerse.book_id, previewLinkedVerse.chapter, previewLinkedVerse.verse);
                }}
              >
                <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 14 }}>Ver capítulo</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </SafeAreaView>
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
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
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
  dottedLine: {
    borderWidth: 0.8,
    borderStyle: 'dashed',
    height: 1,
    width: '100%',
    marginTop: Spacing.two,
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
    fontSize: 13,
  },
});
