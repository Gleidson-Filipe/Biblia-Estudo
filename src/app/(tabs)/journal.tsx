import { useAppTheme } from '@/components/ThemeContext';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
 
  Pressable,
  ScrollView,
  Vibration,
  Modal,
  Dimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BookOpen, MessageSquare, Heart, Trash2, Calendar, ChevronLeft, ChevronRight, X, ArrowUpRight, BookMarked, Bookmark, ArrowUpDown } from 'lucide-react-native';
import { Colors, Spacing } from '@/constants/theme';
import {
  getAllNotes,
  deleteNote,
  getAllFavoritesWithGroups,
  getAllAnnotationGroups,
  toggleFavorite,
  deleteNoteGroup,
  getBooks,
  getVerse,
  parseGroupNotes,
  Note,
  Favorite,
  NoteGroup,
  cleanJesusTags
} from '@/database/queries';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { dbModifiedRef, bookName as bName, globalVersionRef } from '@/components/verse-context-ref';
import * as FileSystem from 'expo-file-system/legacy';

const SCREEN_WIDTH = Dimensions.get('window').width;

export interface GroupedFavorite {
  key: string;
  book_id: number;
  chapter: number;
  book_name: string;
  book_name_en?: string;
  items: Favorite[];
  reference: string;
  firstText: string;
  created_at: string;
}

/* Skeleton placeholder for note/favorite cards while loading */
const SkeletonCardLine = React.memo(({ width }: { width: string }) => {
  const { isDark } = useAppTheme();
  const colors = Colors[isDark ? 'dark' : 'light'];
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [isDark ? 0.12 : 0.08, isDark ? 0.04 : 0.03] });
  return <Animated.View style={{ height: 12, width: width as any, borderRadius: 6, backgroundColor: colors.skeleton, opacity, marginBottom: 8 }} />;
});

const SkeletonCard = React.memo(() => {
  const { isDark } = useAppTheme();
  const colors = Colors[isDark ? 'dark' : 'light'];
  return (
    <View style={{
      borderWidth: 1.5,
      borderLeftWidth: 4,
      borderRadius: 14,
      borderColor: colors.backgroundElement,
      borderLeftColor: colors.backgroundElement,
      backgroundColor: colors.card,
      overflow: 'hidden',
      padding: 16,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
        <SkeletonCardLine width="35%" />
        <SkeletonCardLine width="22%" />
      </View>
      <SkeletonCardLine width="95%" />
      <SkeletonCardLine width="80%" />
      <SkeletonCardLine width="60%" />
      <View style={{ marginTop: 6 }}>
        <SkeletonCardLine width="30%" />
      </View>
    </View>
  );
});

const JournalSkeletons = React.memo(() => (
  <>
    <SkeletonCard />
    <SkeletonCard />
    <SkeletonCard />
  </>
));

export default function GeneralJournalScreen() {
  const { isDark } = useAppTheme();
  
  const colors = Colors[isDark ? 'dark' : 'light'];
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Tab: 'notes' or 'favorites'
  const [activeTab, setActiveTab] = useState<'notes' | 'favorites'>('notes');

  // Data states
  const [notesList, setNotesList] = useState<Note[]>([]);
  const [annotationGroupsList, setAnnotationGroupsList] = useState<NoteGroup[]>([]);
  const [favoritesList, setFavoritesList] = useState<Favorite[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Detailed Modal states — selectedGroup = all notes for one verse, groupIndex = which one is showing
  const [selectedGroup, setSelectedGroup] = useState<Note[] | null>(null);
  const [groupIndex, setGroupIndex] = useState(0);
  const [noteVerseText, setNoteVerseText] = useState<string>('');
  const [selectedFavoriteGroup, setSelectedFavoriteGroup] = useState<GroupedFavorite | null>(null);
  const [selectedAnnotationGroup, setSelectedAnnotationGroup] = useState<NoteGroup | null>(null);
  const [highlights, setHighlights] = useState<Record<string, string>>({});
  const [selectedColorFilter, setSelectedColorFilter] = useState<string | null>(null);
  const [testamentFilter, setTestamentFilter] = useState<'all' | 'ot' | 'nt'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [noteTypeFilter, setNoteTypeFilter] = useState<'all' | 'individual' | 'group'>('all');
  const [saveTypeFilter, setSaveTypeFilter] = useState<'all' | 'individual' | 'group'>('all');

  // Custom confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  const selectedNote = selectedGroup ? selectedGroup[groupIndex] : null;

  // Group notes by verse (with testament + sort filters)
  const notesGroups: Note[][] = React.useMemo(() => {
    const filtered = notesList.filter(n => {
      if (testamentFilter === 'ot') return n.book_id <= 39;
      if (testamentFilter === 'nt') return n.book_id >= 40;
      return true;
    });
    const map = new Map<string, Note[]>();
    for (const n of filtered) {
      const key = `${n.book_id}_${n.chapter}_${n.verse}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    }
    const groups = Array.from(map.values());
    groups.sort((a, b) => {
      const tA = new Date(a[0].updated_at).getTime();
      const tB = new Date(b[0].updated_at).getTime();
      return sortOrder === 'newest' ? tB - tA : tA - tB;
    });
    return groups;
  }, [notesList, testamentFilter, sortOrder]);

  // Grupos de anotação filtrados por testamento
  const filteredAnnotationGroups = React.useMemo(() => {
    return annotationGroupsList.filter(g => {
      const bookId = g.verses?.[0]?.book_id;
      if (!bookId) return false;
      if (testamentFilter === 'ot') return bookId <= 39;
      if (testamentFilter === 'nt') return bookId >= 40;
      return true;
    });
  }, [annotationGroupsList, testamentFilter]);

  const hasBothNoteTypes = (notesGroups.length > 0) && (filteredAnnotationGroups.length > 0);

  // Combine individual notes and group annotations, sorting them globally by sortOrder
  const combinedNotesList = React.useMemo(() => {
    const list: Array<
      | { type: 'group'; data: NoteGroup; timestamp: number }
      | { type: 'individual'; data: Note[]; timestamp: number }
    > = [];

    if (noteTypeFilter !== 'individual') {
      filteredAnnotationGroups.forEach(g => {
        const time = new Date(g.updated_at).getTime();
        list.push({ type: 'group', data: g, timestamp: time });
      });
    }

    if (noteTypeFilter !== 'group') {
      notesGroups.forEach(group => {
        if (group.length > 0) {
          const time = new Date(group[0].updated_at).getTime();
          list.push({ type: 'individual', data: group, timestamp: time });
        }
      });
    }

    list.sort((a, b) => {
      return sortOrder === 'newest' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp;
    });

    return list;
  }, [filteredAnnotationGroups, notesGroups, noteTypeFilter, sortOrder]);

  // Formata versículos consecutivos, ex: [3, 4, 5, 8] -> "3-5, 8"
  const formatVerseIntervals = useCallback((verses: number[]): string => {
    if (verses.length === 0) return '';
    const sorted = [...verses].sort((a, b) => a - b);
    const parts: string[] = [];
    let start = sorted[0];
    let prev = sorted[0];

    for (let i = 1; i <= sorted.length; i++) {
      const curr = sorted[i];
      if (curr === prev + 1) {
        prev = curr;
      } else {
        if (start === prev) {
          parts.push(`${start}`);
        } else {
          parts.push(`${start}-${prev}`);
        }
        start = curr;
        prev = curr;
      }
    }
    return parts.join(', ');
  }, []);

  // Filtra favoritos por cor e testamento
  const filteredFavorites = React.useMemo(() => {
    return favoritesList.filter(f => {
      if (selectedColorFilter) {
        const key = `${f.book_id}_${f.chapter}_${f.verse}`;
        if (highlights[key] !== selectedColorFilter) return false;
      }
      if (testamentFilter === 'ot') return f.book_id <= 39;
      if (testamentFilter === 'nt') return f.book_id >= 40;
      return true;
    });
  }, [favoritesList, highlights, selectedColorFilter, testamentFilter]);

  // Agrupa favoritos: grupos de salvamento por group_id, individuais por capítulo
  const favoritesGroups: GroupedFavorite[] = React.useMemo(() => {
    const typeFiltered = filteredFavorites.filter(f => {
      if (saveTypeFilter === 'individual') return !f.save_group_id;
      if (saveTypeFilter === 'group') return !!f.save_group_id;
      return true;
    });

    const groupMap = new Map<number, Favorite[]>();
    const individualMap = new Map<string, Favorite[]>();
    for (const f of typeFiltered) {
      if (f.save_group_id) {
        if (!groupMap.has(f.save_group_id)) groupMap.set(f.save_group_id, []);
        groupMap.get(f.save_group_id)!.push(f);
      } else {
        const key = `${f.book_id}_${f.chapter}`;
        if (!individualMap.has(key)) individualMap.set(key, []);
        individualMap.get(key)!.push(f);
      }
    }

    const buildGroup = (key: string, items: Favorite[]): GroupedFavorite => {
      items.sort((a, b) => a.verse - b.verse);
      const intervals = formatVerseIntervals(items.map(x => x.verse));
      const first = items[0];
      const bNameStr = bName(first.book_name ?? 'Livro', first.book_name_en);
      const newestCreatedAt = items.reduce((max, item) =>
        new Date(item.created_at).getTime() > new Date(max).getTime() ? item.created_at : max,
        items[0].created_at
      );
      const vk = `text_${globalVersionRef.current}` as keyof typeof first;
      return { key, book_id: first.book_id, chapter: first.chapter, book_name: first.book_name ?? 'Livro', book_name_en: first.book_name_en, items, reference: `${bNameStr} ${first.chapter}:${intervals}`, firstText: cleanJesusTags((first[vk] as string) || first.text_ara), created_at: newestCreatedAt };
    };

    const result: GroupedFavorite[] = [];
    for (const [gid, items] of groupMap.entries()) result.push(buildGroup(`group_${gid}`, items));
    for (const [key, items] of individualMap.entries()) result.push(buildGroup(`ind_${key}`, items));

    result.sort((a, b) => sortOrder === 'newest'
      ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return result;
  }, [filteredFavorites, saveTypeFilter, formatVerseIntervals, sortOrder]);

  const hasBothSaveTypes = filteredFavorites.some(f => !f.save_group_id) && filteredFavorites.some(f => !!f.save_group_id);

  // Lista de cores únicas encontradas nos favoritos carregados
  const availableColors = React.useMemo(() => {
    const colorsSet = new Set<string>();
    for (const fav of favoritesList) {
      const key = `${fav.book_id}_${fav.chapter}_${fav.verse}`;
      if (highlights[key]) {
        colorsSet.add(highlights[key]);
      }
    }
    return Array.from(colorsSet);
  }, [favoritesList, highlights]);

  // Retorna a cor de destaque do grupo de favoritos (se houver) ou a cor padrão do app
  const getGroupColor = useCallback((group: GroupedFavorite) => {
    for (const item of group.items) {
      const key = `${item.book_id}_${item.chapter}_${item.verse}`;
      if (highlights[key]) {
        return highlights[key];
      }
    }
    return group.key.startsWith('group_') ? '#F59E0B' : colors.accent;
  }, [highlights, colors.accent]);

  // Recarrega ao entrar na aba (captura edições feitas em outra tela)
  useFocusEffect(useCallback(() => {
    loadData();
  }, []));

  const loadData = async () => {
    try {
      const allNotes = getAllNotes();
      setNotesList(allNotes);
      const allAnnotationGroups = getAllAnnotationGroups();
      setAnnotationGroupsList(allAnnotationGroups);

      // Load favorites
      const favs = getAllFavoritesWithGroups();
      setFavoritesList(favs);

      // Load highlights from FileSystem
      const path = FileSystem.documentDirectory + 'highlights.json';
      const fileInfo = await FileSystem.getInfoAsync(path);
      if (fileInfo.exists) {
        const content = await FileSystem.readAsStringAsync(path);
        const parsed = JSON.parse(content);
        setHighlights(parsed);
      } else {
        setHighlights({});
      }
      setDataLoaded(true);
    } catch (err) {
      console.log('Error loading journal data:', err);
      setDataLoaded(true);
    }
  };

  const closeGroup = () => { setSelectedGroup(null); setGroupIndex(0); };

  // Navigate back to reader at chosen verse
  const handleGoToVerse = (bookId: number, chapter: number, verse: number) => {
    closeGroup();
    router.navigate({
      pathname: '/',
      params: {
        bookId: String(bookId),
        chapter: String(chapter),
        verse: String(verse)
      }
    });
  };

  // Open group of notes for a verse
  const handleOpenGroup = async (group: Note[]) => {
    setSelectedGroup(group);
    setGroupIndex(0);
    Vibration.vibrate(20);
    try {
      const verseObj = getVerse(group[0].book_id, group[0].chapter, group[0].verse);
      const vk2 = `text_${globalVersionRef.current}` as keyof NonNullable<typeof verseObj>;
      setNoteVerseText(cleanJesusTags((verseObj?.[vk2] as string | undefined) || verseObj?.text_ara));
    } catch (_) {
      setNoteVerseText('');
    }
  };

  // Delete note from general list
  const handleDeleteNote = (note: Note) => {
    setConfirmDialog({
      title: 'Confirmar Exclusão',
      message: `Tem certeza que deseja apagar a anotação de ${bName(note.book_name ?? '', note.book_name_en)} ${note.chapter}:${note.verse}?`,
      confirmLabel: 'Excluir',
      onConfirm: () => {
        deleteNote(note.book_id, note.chapter, note.verse);
        dbModifiedRef.modified = true;
        Vibration.vibrate(30);
        closeGroup();
        loadData();
      },
    });
  };

  const handleDeleteAnnotationGroup = (group: NoteGroup) => {
    const vv = group.verses ?? [];
    const fv = vv[0];
    const ref = fv 
      ? `${bName(fv.book_name ?? '', fv.book_name_en)} ${fv.chapter}:${formatVerseIntervals(vv.map(v => v.verse))}`
      : 'Grupo de Anotações';
    setConfirmDialog({
      title: 'Confirmar Exclusão',
      message: `Tem certeza que deseja apagar todas as anotações do grupo de ${ref}?`,
      confirmLabel: 'Excluir',
      onConfirm: () => {
        deleteNoteGroup(group.id);
        dbModifiedRef.modified = true;
        Vibration.vibrate(30);
        setSelectedAnnotationGroup(null);
        loadData();
      },
    });
  };

  // Open favorite group modal
  const handleOpenFavoriteGroup = (group: GroupedFavorite) => {
    setSelectedFavoriteGroup(group);
    Vibration.vibrate(20);
  };

  // Close favorite group modal
  const closeFavoriteGroup = () => {
    setSelectedFavoriteGroup(null);
  };

  // Remove single favorite from detail modal
  const handleRemoveSingleFavorite = (fav: Favorite) => {
    toggleFavorite(fav.book_id, fav.chapter, fav.verse);
    dbModifiedRef.modified = true;
    Vibration.vibrate(20);
    
    // Fetch updated data from DB
    const favs = getAllFavoritesWithGroups();
    setFavoritesList(favs);

    // Filter matching favorites remaining for this book and chapter
    const remaining = favs.filter((x: Favorite) => x.book_id === fav.book_id && x.chapter === fav.chapter);
    if (remaining.length > 0) {
      remaining.sort((a: Favorite, b: Favorite) => a.verse - b.verse);
      const verses = remaining.map((x: Favorite) => x.verse);
      const intervals = formatVerseIntervals(verses);
      const bNameStr = bName(remaining[0].book_name ?? 'Livro', remaining[0].book_name_en);
      
      setSelectedFavoriteGroup({
        key: `${fav.book_id}_${fav.chapter}`,
        book_id: fav.book_id,
        chapter: fav.chapter,
        book_name: remaining[0].book_name ?? 'Livro',
        book_name_en: remaining[0].book_name_en,
        items: remaining,
        reference: `${bNameStr} ${fav.chapter}:${intervals}`,
        firstText: cleanJesusTags((remaining[0][`text_${globalVersionRef.current}` as keyof typeof remaining[0]] as string) || remaining[0].text_ara),
        created_at: remaining[0].created_at,
      });
    } else {
      setSelectedFavoriteGroup(null);
    }
  };

  // Remove entire favorite group with confirmation
  const handleRemoveFavoriteGroup = (group: GroupedFavorite) => {
    const performRemoval = () => {
      group.items.forEach(fav => {
        toggleFavorite(fav.book_id, fav.chapter, fav.verse);
      });
      dbModifiedRef.modified = true;
      Vibration.vibrate(30);
      loadData();
    };

    const isRealGroup = group.key.startsWith('group_');
    setConfirmDialog({
      title: isRealGroup || group.items.length > 1 ? 'Remover Todos' : 'Remover Versículo',
      message: isRealGroup || group.items.length > 1
        ? `Deseja remover os ${group.items.length} versículos de ${group.reference} dos salvos?`
        : `Deseja remover ${group.reference} dos salvos?`,
      confirmLabel: isRealGroup || group.items.length > 1 ? 'Remover Todos' : 'Remover',
      onConfirm: performRemoval,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Premium Elegant Header */}
      <View style={[styles.headerContainer, { borderBottomColor: colors.backgroundElement }]}>
        <View style={styles.headerTitleRow}>
          <View style={[styles.headerIconBg, { backgroundColor: colors.accentSubtle }]}>
            <Bookmark size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text, fontFamily: 'serif' }]}>
              Notas e Salvos
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Suas anotações e versículos favoritos
            </Text>
          </View>
        </View>
      </View>

      {/* Modern Capsule Pill Segment Selector */}
      <View style={styles.tabSelectorWrapper}>
        <View style={[styles.tabSelectorCapsule, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
          <Pressable
            style={[styles.tabPill, activeTab === 'notes' && [styles.tabPillActive, { backgroundColor: colors.accent }]]}
            onPress={() => {
              setActiveTab('notes');
              Vibration.vibrate(10);
            }}
          >
            <MessageSquare size={14} color={activeTab === 'notes' ? '#FFF' : colors.textSecondary} strokeWidth={2.2} />
            <Text style={[styles.tabPillText, activeTab === 'notes' ? { color: '#FFF', fontWeight: 'bold' } : { color: colors.textSecondary }]}>
              Meditações ({notesList.length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tabPill, activeTab === 'favorites' && [styles.tabPillActive, { backgroundColor: colors.accent }]]}
            onPress={() => {
              setActiveTab('favorites');
              Vibration.vibrate(10);
            }}
          >
            <Heart size={14} color={activeTab === 'favorites' ? '#FFF' : colors.textSecondary} strokeWidth={2.2} />
            <Text style={[styles.tabPillText, activeTab === 'favorites' ? { color: '#FFF', fontWeight: 'bold' } : { color: colors.textSecondary }]}>
              Salvos ({favoritesList.length})
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Filter & Sort Bar (Horizontal & Compact) */}
      <View style={[styles.filterBar, { borderBottomColor: colors.backgroundElement, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
          {/* Testament Filter Group */}
          <View style={styles.filterPills}>
            {(['ot', 'nt'] as const).map((f) => {
              const label = f === 'ot' ? 'A.T.' : 'N.T.';
              const active = testamentFilter === f;
              return (
                <Pressable
                  key={f}
                  onPress={() => setTestamentFilter(testamentFilter === f ? 'all' : f)}
                  style={[
                    styles.filterPillCompact,
                    { backgroundColor: active ? colors.accent : colors.backgroundElement }
                  ]}
                >
                  <Text style={[styles.filterPillTextCompact, { color: active ? '#fff' : colors.textSecondary }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Divider */}
          {((activeTab === 'notes' && hasBothNoteTypes) || (activeTab === 'favorites' && hasBothSaveTypes)) && (
            <View style={{ width: 1.5, height: 16, backgroundColor: colors.border, opacity: 0.3, marginHorizontal: 2 }} />
          )}

          {/* Type Filter Group */}
          {((activeTab === 'notes' && hasBothNoteTypes) || (activeTab === 'favorites' && hasBothSaveTypes)) && (
            <View style={styles.filterPills}>
              {(['individual', 'group'] as const).map((t) => {
                const label = t === 'individual' ? 'Indiv.' : 'Grupo';
                const active = activeTab === 'notes' ? noteTypeFilter === t : saveTypeFilter === t;
                const activeColor = t === 'group' ? '#F59E0B' : colors.accent;
                return (
                  <Pressable
                    key={t}
                    onPress={() => {
                      if (activeTab === 'notes') {
                        setNoteTypeFilter(noteTypeFilter === t ? 'all' : t);
                      } else {
                        setSaveTypeFilter(saveTypeFilter === t ? 'all' : t);
                      }
                    }}
                    style={[
                      styles.filterPillCompact,
                      { backgroundColor: active ? activeColor : colors.backgroundElement }
                    ]}
                  >
                    <Text style={[styles.filterPillTextCompact, { color: active ? '#fff' : colors.textSecondary }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Sort Button */}
        <Pressable
          onPress={() => setSortOrder(o => o === 'newest' ? 'oldest' : 'newest')}
          style={[
            styles.sortBtn,
            {
              backgroundColor: sortOrder === 'newest' ? colors.accent : colors.backgroundElement,
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 8,
            }
          ]}
        >
          <ArrowUpDown size={12} color={sortOrder === 'newest' ? '#fff' : colors.textSecondary} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: sortOrder === 'newest' ? '#fff' : colors.textSecondary }}>
            {sortOrder === 'newest' ? 'Recentes' : 'Antigos'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {/* TAB 1: NOTES LIST */}
        {activeTab === 'notes' && (
          <View style={styles.listContainer}>
            {!dataLoaded ? (
              <JournalSkeletons />
            ) : notesList.length === 0 && annotationGroupsList.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyIconCircle, { backgroundColor: colors.accentSubtle }]}>
                  <MessageSquare size={32} color={colors.accent} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: 'serif' }]}>
                  Nenhuma meditação registrada
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  Suas anotações, reflexões e revelações escritas no app serão organizadas e listadas aqui cronologicamente!
                </Text>
                <Pressable
                  style={[styles.emptyActionBtn, { backgroundColor: colors.accent }]}
                  onPress={() => router.navigate({ pathname: '/', params: { resetScroll: 'true' } })}
                >
                  <Text style={styles.emptyActionBtnText}>Escolher Versículo para Anotar</Text>
                </Pressable>
              </View>
            ) : (
              <>
              {combinedNotesList.map((item) => {
                if (item.type === 'group') {
                  const ng = item.data;
                  const verses = ng.verses ?? [];
                  const firstVerse = verses[0];
                  if (!firstVerse) return null;
                  const bookNameStr = bName(firstVerse.book_name ?? '', firstVerse.book_name_en);
                  const sameChapterVerses = verses.filter(v => v.book_id === firstVerse.book_id && v.chapter === firstVerse.chapter);
                  const intervals = formatVerseIntervals(sameChapterVerses.map(v => v.verse));
                  const noteTexts = parseGroupNotes(ng.content);
                  const previewText = noteTexts[0] ?? '';
                  return (
                    <Pressable
                      key={`ng_${ng.id}`}
                      style={[styles.noteCard, { backgroundColor: colors.card, borderColor: colors.backgroundElement, borderLeftColor: '#F59E0B' }]}
                      onPress={() => setSelectedAnnotationGroup(ng)}
                    >
                      <View style={styles.noteCardBody}>
                        <View style={styles.noteCardHeader}>
                          <Text style={[styles.noteCardRef, { color: '#F59E0B', fontFamily: 'serif' }]}>
                            {bookNameStr} {firstVerse.chapter}:{intervals}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={[styles.calendarBadge, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                              <Text style={{ fontSize: 11, color: '#F59E0B', fontWeight: '700' }}>{verses.length} versículos</Text>
                            </View>
                            <View style={[styles.calendarBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)' }]}>
                              <Calendar size={11} color={colors.textSecondary} />
                              <Text style={[styles.noteCardDate, { color: colors.textSecondary }]}>
                                {new Date(ng.updated_at).toLocaleDateString('pt-BR')}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <Text style={[styles.noteCardContent, { color: colors.text }]} numberOfLines={3}>{previewText}</Text>
                        <View style={styles.cardLinkRow}>
                          <Text style={[styles.cardLinkText, { color: '#F59E0B' }]}>
                            {noteTexts.length > 1 ? `Ver ${noteTexts.length} notas` : 'Ler nota completa'}
                          </Text>
                          <ChevronRight size={12} color='#F59E0B' strokeWidth={2.5} />
                        </View>
                      </View>
                    </Pressable>
                  );
                } else {
                  const group = item.data;
                  const first = group[0];
                  return (
                    <Pressable
                      key={`group_${first.book_id}_${first.chapter}_${first.verse}`}
                      style={[styles.noteCard, { backgroundColor: colors.card, borderColor: colors.backgroundElement, borderLeftColor: colors.accent }]}
                      onPress={() => handleOpenGroup(group)}
                    >
                      <View style={styles.noteCardBody}>
                        <View style={styles.noteCardHeader}>
                          <Text style={[styles.noteCardRef, { color: colors.accent, fontFamily: 'serif' }]}>
                            {bName(first.book_name ?? '', first.book_name_en)} {first.chapter}:{first.verse}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {group.length > 1 && (
                              <View style={[styles.calendarBadge, { backgroundColor: colors.accentSubtle }]}>
                                <Text style={{ fontSize: 11, color: colors.accent, fontWeight: '700' }}>{group.length} notas</Text>
                              </View>
                            )}
                            <View style={[styles.calendarBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)' }]}>
                              <Calendar size={11} color={colors.textSecondary} />
                              <Text style={[styles.noteCardDate, { color: colors.textSecondary }]}>
                                {new Date(first.updated_at).toLocaleDateString('pt-BR')}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <Text style={[styles.noteCardContent, { color: colors.text }]} numberOfLines={3}>
                          {first.content}
                        </Text>
                        <View style={styles.cardLinkRow}>
                          <Text style={[styles.cardLinkText, { color: colors.accent }]}>
                            {group.length > 1 ? `Ver ${group.length} notas` : 'Ler nota completa'}
                          </Text>
                          <ChevronRight size={12} color={colors.accent} strokeWidth={2.5} />
                        </View>
                      </View>
                    </Pressable>
                  );
                }
              })}
              </>
            )}
          </View>
        )}

        {/* TAB 2: FAVORITES LIST */}
        {activeTab === 'favorites' && (
          <View style={{ gap: Spacing.three }}>
            {availableColors.length > 0 && (
              <View style={styles.colorFilterContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorFilterScroll}>
                  <Pressable
                    onPress={() => setSelectedColorFilter(null)}
                    style={[
                      styles.colorFilterPill,
                      selectedColorFilter === null 
                        ? [styles.colorFilterPillActive, { borderColor: colors.accent, backgroundColor: colors.accentSubtle }] 
                        : { borderColor: colors.backgroundElement, backgroundColor: colors.card }
                    ]}
                  >
                    <Text style={[styles.colorFilterText, { color: selectedColorFilter === null ? colors.accent : colors.textSecondary, fontWeight: '700' }]}>Todos</Text>
                  </Pressable>
                  
                  {availableColors.map((color) => {
                    const isSelected = selectedColorFilter === color;
                    return (
                      <Pressable
                        key={color}
                        onPress={() => setSelectedColorFilter(color)}
                        style={[
                          styles.colorFilterPill,
                          isSelected 
                            ? [styles.colorFilterPillActive, { borderColor: color, backgroundColor: color + '15' }] 
                            : { borderColor: colors.backgroundElement, backgroundColor: colors.card }
                        ]}
                      >
                        <View style={[styles.colorDot, { backgroundColor: color }]} />
                        <Text style={[styles.colorFilterText, { color: isSelected ? color : colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', fontSize: 10 }]}>
                          Destaque
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <View style={styles.listContainer}>
              {!dataLoaded ? (
                <JournalSkeletons />
              ) : favoritesGroups.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <View style={[styles.emptyIconCircle, { backgroundColor: colors.accentSubtle }]}>
                    <Heart size={32} color={colors.accent} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: 'serif' }]}>
                    Nenhum favorito guardado
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                    Marque seus versículos mais preciosos na aba Leitura para colecioná-los nesta lista para memorização!
                  </Text>
                  <Pressable
                    style={[styles.emptyActionBtn, { backgroundColor: colors.accent }]}
                    onPress={() => router.navigate({ pathname: '/', params: { resetScroll: 'true' } })}
                  >
                    <Text style={styles.emptyActionBtnText}>Abrir Bíblia Sagrada</Text>
                  </Pressable>
                </View>
              ) : (
                favoritesGroups.map((group) => {
                  const isGrouped = group.items.length > 1;
                  const groupColor = getGroupColor(group);
                  return (
                    <View
                      key={`fav_group_${group.key}`}
                      style={[
                        styles.favoriteCard, 
                        { 
                          backgroundColor: colors.card, 
                          borderColor: colors.backgroundElement,
                          borderLeftColor: groupColor,
                        }
                      ]}
                    >
                    <Pressable
                      style={{ flex: 1, paddingRight: Spacing.two }}
                      onPress={() => handleOpenFavoriteGroup(group)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.two, flexWrap: 'wrap', gap: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.favRefText, { color: colors.accent, fontFamily: 'serif' }]}>
                            {group.reference}
                          </Text>
                          <View style={[styles.arrowBadge, { backgroundColor: colors.accentSubtle }]}>
                            <ArrowUpRight size={10} color={colors.accent} strokeWidth={2.5} />
                          </View>
                        </View>
                        {isGrouped && (
                          <View style={[styles.groupedBadge, { backgroundColor: colors.accentSubtle }]}>
                            <Text style={[styles.groupedBadgeText, { color: colors.accent }]}>
                              {group.items.length} versículos
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.favExcerptText, { color: colors.text }]} numberOfLines={2}>
                        "{group.firstText}"
                        {isGrouped && <Text style={{ color: colors.textSecondary, fontStyle: 'normal' }}> ...</Text>}
                      </Text>
                      {isGrouped && (
                        <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 4, fontWeight: '500' }}>
                          Clique para gerenciar a sequência completa de versículos
                        </Text>
                      )}
                    </Pressable>
                    <Pressable
                      style={[styles.favRemoveBtn, { backgroundColor: colors.error + '10' }]}
                      onPress={() => handleRemoveFavoriteGroup(group)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Trash2 size={15} color={colors.error} />
                    </Pressable>
                  </View>
                );
              })
            )}
            </View>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* DETAILED NOTE VIEW OVERLAY MODAL */}
      {selectedNote && (
        <Modal
          visible={selectedNote !== null}
          transparent
          animationType="fade"
          onRequestClose={() => closeGroup()}
        >
          <GestureHandlerRootView style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.backgroundElement }]}>
              {/* Modal Header */}
              <View style={[styles.modalHeader, { borderBottomColor: colors.backgroundElement }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: colors.text, fontFamily: 'serif' }]}>
                    {bName(selectedNote.book_name ?? '', selectedNote.book_name_en)} {selectedNote.chapter}:{selectedNote.verse}
                  </Text>
                  {selectedGroup && selectedGroup.length > 1 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                      <Pressable
                        onPress={() => {
                          setGroupIndex(i => Math.max(0, i - 1));
                          Vibration.vibrate(10);
                        }}
                        disabled={groupIndex === 0}
                        style={[
                          styles.navArrowBtn,
                          {
                            backgroundColor: colors.backgroundElement,
                            opacity: groupIndex === 0 ? 0.35 : 1,
                          }
                        ]}
                      >
                        <ChevronLeft size={14} color={colors.accent} strokeWidth={3} />
                      </Pressable>
                      <Text style={[styles.navText, { color: colors.textSecondary }]}>
                        Nota {groupIndex + 1} de {selectedGroup.length}
                      </Text>
                      <Pressable
                        onPress={() => {
                          setGroupIndex(i => Math.min(selectedGroup.length - 1, i + 1));
                          Vibration.vibrate(10);
                        }}
                        disabled={groupIndex === selectedGroup.length - 1}
                        style={[
                          styles.navArrowBtn,
                          {
                            backgroundColor: colors.backgroundElement,
                            opacity: groupIndex === selectedGroup.length - 1 ? 0.35 : 1,
                          }
                        ]}
                      >
                        <ChevronRight size={14} color={colors.accent} strokeWidth={3} />
                      </Pressable>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Meditação Teológica
                    </Text>
                  )}
                </View>
                <Pressable
                  onPress={() => closeGroup()}
                  style={[styles.closeBtn, { backgroundColor: colors.backgroundElement }]}
                >
                  <X size={18} color={colors.textSecondary} />
                </Pressable>
              </View>

              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {/* Citation block */}
                {noteVerseText ? (
                  <View style={[styles.citationContainer, { backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)', borderLeftColor: colors.accent }]}>
                    <Text style={[styles.citationText, { color: colors.text, fontFamily: 'serif' }]}>
                      "{noteVerseText}"
                    </Text>
                  </View>
                ) : null}

                {/* Personal study notes - Parchment Paper look */}
                <View style={[
                  styles.noteContentContainer, 
                  { 
                    backgroundColor: colors.parchment, 
                    borderColor: colors.parchmentBorder 
                  }
                ]}>
                  <Text style={[styles.noteContentLabel, { color: colors.accent, fontFamily: 'serif' }]}>Revelações & Aprendizados:</Text>
                  <Text style={[styles.noteContentText, { color: colors.text }]}>
                    {selectedNote.content}
                  </Text>
                </View>

                {/* Date */}
                <View style={styles.modalDateRow}>
                  <Calendar size={12} color={colors.textMuted} />
                  <Text style={[styles.noteDateStamp, { color: colors.textMuted }]}>
                    Última atualização: {new Date(selectedNote.updated_at).toLocaleString('pt-BR')}
                  </Text>
                </View>
              </ScrollView>

              {/* Footer buttons */}
              <View style={[styles.modalFooter, { borderTopColor: colors.backgroundElement }]}>
                <Pressable
                  style={[styles.footerBtn, { backgroundColor: colors.error + '12', borderColor: colors.error + '30' }]}
                  onPress={() => handleDeleteNote(selectedNote)}
                >
                  <Trash2 size={15} color={colors.error} />
                  <Text style={[styles.footerBtnText, { color: colors.error }]}>Excluir</Text>
                </Pressable>

                <Pressable
                  style={[styles.footerBtn, { backgroundColor: colors.accent, flex: 1.5 }]}
                  onPress={() => handleGoToVerse(selectedNote.book_id, selectedNote.chapter, selectedNote.verse)}
                >
                  <BookOpen size={15} color="#FFF" />
                  <Text style={[styles.footerBtnText, { color: '#FFF' }]}>Ir para o Leitor</Text>
                </Pressable>
              </View>
            </View>
            <Pressable
              style={styles.backdropTouch}
              onPress={() => closeGroup()}
            />
          </GestureHandlerRootView>
        </Modal>
      )}
      {/* ANNOTATION GROUP MODAL */}
      {selectedAnnotationGroup && (
        <Modal
          visible={selectedAnnotationGroup !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedAnnotationGroup(null)}
        >
          <GestureHandlerRootView style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.backgroundElement }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.backgroundElement }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: colors.text, fontFamily: 'serif' }]}>
                    {(() => {
                      const vv = selectedAnnotationGroup.verses ?? [];
                      const fv = vv[0];
                      if (!fv) return 'Grupo de Anotações';
                      const bn = bName(fv.book_name ?? '', fv.book_name_en);
                      const sameChap = vv.filter(v => v.book_id === fv.book_id && v.chapter === fv.chapter);
                      return `${bn} ${fv.chapter}:${formatVerseIntervals(sameChap.map(v => v.verse))}`;
                    })()}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#F59E0B', marginTop: 2, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Grupo de Meditações ({(selectedAnnotationGroup.verses ?? []).length} versículos)
                  </Text>
                </View>
                <Pressable
                  onPress={() => setSelectedAnnotationGroup(null)}
                  style={[styles.closeBtn, { backgroundColor: colors.backgroundElement }]}
                >
                  <X size={18} color={colors.textSecondary} />
                </Pressable>
              </View>

              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {/* Citation block for multiple verses */}
                {(selectedAnnotationGroup.verses ?? []).length > 0 ? (
                  <View style={[styles.citationContainer, { backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)', borderLeftColor: '#F59E0B' }]}>
                    <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled showsVerticalScrollIndicator={true}>
                      {(selectedAnnotationGroup.verses ?? []).map((v, idx) => {
                        const verseText = cleanJesusTags((v[`text_${globalVersionRef.current}` as keyof typeof v] as string) || v.text_ara || v.text_arc || v.text_kjv || v.text_dby || '');
                        return (
                          <Text key={idx} style={[styles.citationText, { color: colors.text, fontFamily: 'serif', marginBottom: idx === (selectedAnnotationGroup.verses ?? []).length - 1 ? 0 : 8 }]}>
                            <Text style={{ fontWeight: 'bold', color: '#F59E0B' }}>{v.verse}. </Text>
                            {verseText}
                          </Text>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : null}

                {/* Personal study notes - Parchment Paper look */}
                <View style={[
                  styles.noteContentContainer, 
                  { 
                    backgroundColor: colors.parchment, 
                    borderColor: colors.parchmentBorder 
                  }
                ]}>
                  <Text style={[styles.noteContentLabel, { color: '#F59E0B', fontFamily: 'serif' }]}>Revelações & Aprendizados do Grupo:</Text>
                  <View style={{ gap: 12, marginTop: 4 }}>
                    {parseGroupNotes(selectedAnnotationGroup.content).map((noteText, idx) => (
                      <View key={idx} style={{ gap: 2 }}>
                        {parseGroupNotes(selectedAnnotationGroup.content).length > 1 && (
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#F59E0B', textTransform: 'uppercase', letterSpacing: 0.5 }}>Nota {idx + 1}</Text>
                        )}
                        <Text style={[styles.noteContentText, { color: colors.text }]}>{noteText}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Date */}
                <View style={styles.modalDateRow}>
                  <Calendar size={12} color={colors.textMuted} />
                  <Text style={[styles.noteDateStamp, { color: colors.textMuted }]}>
                    Última atualização: {new Date(selectedAnnotationGroup.updated_at).toLocaleString('pt-BR')}
                  </Text>
                </View>
              </ScrollView>

              {/* Footer buttons */}
              <View style={[styles.modalFooter, { borderTopColor: colors.backgroundElement }]}>
                <Pressable
                  style={[styles.footerBtn, { backgroundColor: colors.error + '12', borderColor: colors.error + '30' }]}
                  onPress={() => handleDeleteAnnotationGroup(selectedAnnotationGroup)}
                >
                  <Trash2 size={15} color={colors.error} />
                  <Text style={[styles.footerBtnText, { color: colors.error }]}>Excluir</Text>
                </Pressable>

                <Pressable
                  style={[styles.footerBtn, { backgroundColor: '#F59E0B', flex: 1.5 }]}
                  onPress={() => {
                    const vv = selectedAnnotationGroup.verses ?? [];
                    const fv = vv[0];
                    if (fv) handleGoToVerse(fv.book_id, fv.chapter, fv.verse);
                    setSelectedAnnotationGroup(null);
                  }}
                >
                  <BookOpen size={15} color="#FFF" />
                  <Text style={[styles.footerBtnText, { color: '#FFF' }]}>Ir para o Leitor</Text>
                </Pressable>
              </View>
            </View>
            <Pressable
              style={styles.backdropTouch}
              onPress={() => setSelectedAnnotationGroup(null)}
            />
          </GestureHandlerRootView>
        </Modal>
      )}
      {/* DETAILED FAVORITES VIEW OVERLAY MODAL */}
      {selectedFavoriteGroup && (
        <Modal
          visible={selectedFavoriteGroup !== null}
          transparent
          animationType="fade"
          onRequestClose={() => closeFavoriteGroup()}
        >
          <GestureHandlerRootView style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.backgroundElement }]}>
              {/* Modal Header */}
              <View style={[styles.modalHeader, { borderBottomColor: colors.backgroundElement }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: colors.text, fontFamily: 'serif' }]}>
                    {selectedFavoriteGroup.reference}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Versículos Salvos ({selectedFavoriteGroup.items.length})
                  </Text>
                </View>
                <Pressable
                  onPress={() => closeFavoriteGroup()}
                  style={[styles.closeBtn, { backgroundColor: colors.backgroundElement }]}
                >
                  <X size={18} color={colors.textSecondary} />
                </Pressable>
              </View>

              {/* Scrollable List of Verses in the group */}
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                <View style={{ gap: Spacing.three }}>
                  {selectedFavoriteGroup.items.map((fav) => {
                    const itemKey = `${fav.book_id}_${fav.chapter}_${fav.verse}`;
                    const itemColor = highlights[itemKey] ?? colors.accent;
                    return (
                      <View 
                        key={`modal_fav_${fav.book_id}_${fav.chapter}_${fav.verse}`}
                        style={[
                          styles.favModalItem, 
                          { 
                            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                            borderColor: colors.backgroundElement,
                            borderLeftWidth: 4,
                            borderLeftColor: itemColor,
                          }
                        ]}
                      >
                      <View style={{ flex: 1, paddingRight: Spacing.two }}>
                        <Text style={[styles.favModalNumber, { color: colors.accent }]}>
                          Versículo {fav.verse}
                        </Text>
                        <Text style={[styles.favModalText, { color: colors.text }]}>
                          "{cleanJesusTags((fav[`text_${globalVersionRef.current}` as keyof typeof fav] as string) || fav.text_ara)}"
                        </Text>
                      </View>
                      
                    </View>
                  );})}
                </View>
              </ScrollView>

              {/* Footer buttons */}
              <View style={[styles.modalFooter, { borderTopColor: colors.backgroundElement }]}>
                <Pressable
                  style={[styles.footerBtn, { backgroundColor: colors.error + '12', borderColor: colors.error + '30' }]}
                  onPress={() => {
                    setConfirmDialog({
                      title: 'Remover Todos',
                      message: `Deseja remover todos os ${selectedFavoriteGroup.items.length} versículos favoritados desta sequência?`,
                      confirmLabel: 'Remover Todos',
                      onConfirm: () => {
                        selectedFavoriteGroup.items.forEach(fav => {
                          toggleFavorite(fav.book_id, fav.chapter, fav.verse);
                        });
                        dbModifiedRef.modified = true;
                        Vibration.vibrate(30);
                        closeFavoriteGroup();
                        loadData();
                      },
                    });
                  }}
                >
                  <Trash2 size={15} color={colors.error} />
                  <Text style={[styles.footerBtnText, { color: colors.error }]}>Remover Todos</Text>
                </Pressable>

                <Pressable
                  style={[styles.footerBtn, { backgroundColor: colors.accent, flex: 1.5 }]}
                  onPress={() => {
                    const first = selectedFavoriteGroup.items[0];
                    closeFavoriteGroup();
                    handleGoToVerse(first.book_id, first.chapter, first.verse);
                  }}
                >
                  <BookOpen size={15} color="#FFF" />
                  <Text style={[styles.footerBtnText, { color: '#FFF' }]}>Ir para o Leitor</Text>
                </Pressable>
              </View>
            </View>
            <Pressable
              style={styles.backdropTouch}
              onPress={() => closeFavoriteGroup()}
            />
          </GestureHandlerRootView>
        </Modal>
      )}

      {/* Custom Confirm Dialog */}
      {confirmDialog && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setConfirmDialog(null)}>
          <Pressable style={styles.confirmBackdrop} onPress={() => setConfirmDialog(null)}>
            <Pressable style={[styles.confirmCard, { backgroundColor: colors.card, borderColor: colors.backgroundElement }]} onPress={() => {}}>
              <Text style={[styles.confirmTitle, { color: colors.text }]}>{confirmDialog.title}</Text>
              <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>{confirmDialog.message}</Text>
              <View style={styles.confirmButtons}>
                <Pressable onPress={() => setConfirmDialog(null)} style={[styles.confirmBtn, { borderColor: colors.backgroundElement }]}>
                  <Text style={[styles.confirmBtnText, { color: colors.textSecondary }]}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
                  style={[styles.confirmBtn, styles.confirmBtnDestructive, { backgroundColor: colors.error + '18', borderColor: colors.error + '40' }]}
                >
                  <Text style={[styles.confirmBtnText, { color: colors.error }]}>{confirmDialog.confirmLabel}</Text>
                </Pressable>
              </View>
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
  headerContainer: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  headerIconBg: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
    fontWeight: '500',
  },
  /* Tab Capsule */
  tabSelectorWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  tabSelectorCapsule: {
    flexDirection: 'row',
    width: '100%',
    height: 46,
    borderRadius: 23,
    padding: 3,
  },
  tabPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    gap: 8,
  },
  tabPillActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContainer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.one,
  },
  listContainer: {
    gap: Spacing.three,
  },
  /* Empty State */
  emptyContainer: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.four,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.five,
  },
  emptyActionBtn: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: 20,
  },
  emptyActionBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  /* Note Card styling */
  noteCard: {
    borderWidth: 1.5,
    borderLeftWidth: 4,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  noteCardBody: {
    padding: Spacing.four,
  },
  noteCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  noteCardRef: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  calendarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  noteCardDate: {
    fontSize: 10,
    fontWeight: '600',
  },
  noteCardContent: {
    fontSize: 13,
    lineHeight: 21,
    marginBottom: Spacing.three,
  },
  cardLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  cardLinkText: {
    fontSize: 12,
    fontWeight: '700',
  },
  /* Favorite Card Styling */
  favoriteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderLeftWidth: 4,
    borderRadius: 14,
    padding: Spacing.four,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 2,
  },
  arrowBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favRefText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  favExcerptText: {
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  favRemoveBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Detail overlay modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    zIndex: 2,
  },
  backdropTouch: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: -1,
  },
  modalCard: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 20,
    borderWidth: 1.5,
    padding: Spacing.four,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
    zIndex: 3,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.three,
    borderBottomWidth: 1.5,
    marginBottom: Spacing.four,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    maxHeight: '65%',
  },
  citationContainer: {
    padding: Spacing.four,
    borderRadius: 12,
    borderLeftWidth: 3.5,
    marginBottom: Spacing.four,
  },
  citationText: {
    fontSize: 13.5,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  noteContentContainer: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: Spacing.four,
    marginBottom: Spacing.three,
  },
  noteContentLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: Spacing.two,
  },
  noteContentText: {
    fontSize: 14,
    lineHeight: 22,
  },
  modalDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    marginTop: Spacing.two,
  },
  noteDateStamp: {
    fontSize: 11,
    fontWeight: '500',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingTop: Spacing.three,
    marginTop: Spacing.four,
    borderTopWidth: 1.5,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    height: 44,
  },
  footerBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  navArrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    fontSize: 12,
    fontWeight: '600',
  },
  groupedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupedBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  favModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
  },
  favModalNumber: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  favModalText: {
    fontSize: 13,
    lineHeight: 19,
  },
  favModalActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  favModalActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorFilterContainer: {
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.one,
  },
  colorFilterScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  colorFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  colorFilterPillActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  colorFilterText: {
    fontSize: 11,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    borderBottomWidth: 1,
    gap: 8,
  },
  filterPills: {
    flexDirection: 'row',
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterPillCompact: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  filterPillTextCompact: {
    fontSize: 11,
    fontWeight: '700',
  },
  sortBtnCompact: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  confirmCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  confirmMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  confirmBtnDestructive: {},
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
