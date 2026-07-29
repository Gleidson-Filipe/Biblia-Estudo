import { useAppTheme } from '@/components/ThemeContext';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Vibration,
  Modal,
  Dimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BookOpen, MessageSquare, Heart, Trash2, Calendar, ChevronLeft, ChevronRight, X, ArrowUpRight, Bookmark, ArrowUpDown, FolderOpen, Search, MoreVertical, SlidersHorizontal, Pencil, Eye, Maximize2, Ban, List, Folder, Plus, Check, ArrowLeft } from 'lucide-react-native';
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
  cleanJesusTags,
  Pasta,
  getPastas,
  createPasta,
  updatePasta,
  deletePasta,
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
  // Sub-tab under Anotações
  const [anotacoesSubTab, setAnotacoesSubTab] = useState<'assuntos' | 'notas'>('assuntos');
  // Search
  const [searchQuery, setSearchQuery] = useState('');
  // Pastas
  const [pastasList, setPastasList] = useState<Pasta[]>([]);
  // Nova pasta modal
  // Menu pasta
  const [menuPasta, setMenuPasta] = useState<Pasta | null>(null);
  // Modal: Ver descrição
  const [showDescricaoModal, setShowDescricaoModal] = useState(false);
  const [descricaoPasta, setDescricaoPasta] = useState<Pasta | null>(null);
  // Modal: Mover notas para...
  const [showMoverModal, setShowMoverModal] = useState(false);
  const [pastaOrigem, setPastaOrigem] = useState<Pasta | null>(null);
  // Modal: Tipo de nota
  const [showNoteTypeModal, setShowNoteTypeModal] = useState(false);
  // Tela: Selecionar Notas
  const [showSelecionarNotas, setShowSelecionarNotas] = useState(false);
  const [pastaSelecionar, setPastaSelecionar] = useState<Pasta | null>(null);
  const [notasSelecionadas, setNotasSelecionadas] = useState<Set<number>>(new Set());
  const [notasDaPasta, setNotasDaPasta] = useState<Note[]>([]);

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

  // Filtros contextuais (bottom sheet)
  const [showFiltrosModal, setShowFiltrosModal] = useState(false);

  // Assuntos filters (aplicados)
  const [assuntosSort, setAssuntosSort] = useState<'newest' | 'oldest' | 'az' | 'za' | 'most' | 'least'>('newest');
  const [assuntosCorFiltro, setAssuntosCorFiltro] = useState<string | null>(null);

  // Notas filters (aplicados)
  const [notasTipo, setNotasTipo] = useState<'versiculo' | 'global' | 'ambos'>('ambos');
  const [notasAssuntoFiltro, setNotasAssuntoFiltro] = useState<number[]>([]);
  const [notasSort, setNotasSort] = useState<'newest' | 'oldest' | 'az' | 'za'>('newest');

  // Salvos filters (aplicados)
  const [salvosTestamento, setSalvosTestamento] = useState<'ot' | 'nt' | 'ambos'>('ambos');
  const [salvosSort, setSalvosSort] = useState<'newest' | 'oldest' | 'biblica'>('newest');

  // Pending (dentro do modal, antes de aplicar)
  const [pendingAssuntosSort, setPendingAssuntosSort] = useState<'newest' | 'oldest' | 'az' | 'za' | 'most' | 'least'>('newest');
  const [pendingAssuntosCorFiltro, setPendingAssuntosCorFiltro] = useState<string | null>(null);
  const [pendingNotasTipo, setPendingNotasTipo] = useState<'versiculo' | 'global' | 'ambos'>('ambos');
  const [pendingNotasAssuntoFiltro, setPendingNotasAssuntoFiltro] = useState<number[]>([]);
  const [pendingNotasSort, setPendingNotasSort] = useState<'newest' | 'oldest' | 'az' | 'za'>('newest');
  const [pendingSalvosTestamento, setPendingSalvosTestamento] = useState<'ot' | 'nt' | 'ambos'>('ambos');
  const [pendingSalvosSort, setPendingSalvosSort] = useState<'newest' | 'oldest' | 'biblica'>('newest');

  const openFiltros = () => {
    setPendingAssuntosSort(assuntosSort);
    setPendingAssuntosCorFiltro(assuntosCorFiltro);
    setPendingNotasTipo(notasTipo);
    setPendingNotasAssuntoFiltro(notasAssuntoFiltro);
    setPendingNotasSort(notasSort);
    setPendingSalvosTestamento(salvosTestamento);
    setPendingSalvosSort(salvosSort);
    setShowFiltrosModal(true);
  };

  const applyFiltros = () => {
    setAssuntosSort(pendingAssuntosSort);
    setAssuntosCorFiltro(pendingAssuntosCorFiltro);
    setNotasTipo(pendingNotasTipo);
    setNotasAssuntoFiltro(pendingNotasAssuntoFiltro);
    setNotasSort(pendingNotasSort);
    setSalvosTestamento(pendingSalvosTestamento);
    setSalvosSort(pendingSalvosSort);
    setShowFiltrosModal(false);
  };

  const limparFiltros = () => {
    if (activeTab === 'notes' && anotacoesSubTab === 'assuntos') {
      setPendingAssuntosSort('newest'); setPendingAssuntosCorFiltro(null);
    } else if (activeTab === 'notes' && anotacoesSubTab === 'notas') {
      setPendingNotasTipo('ambos'); setPendingNotasAssuntoFiltro([]); setPendingNotasSort('newest');
    } else {
      setPendingSalvosTestamento('ambos'); setPendingSalvosSort('newest');
    }
  };

  // Custom confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  const selectedNote = selectedGroup ? selectedGroup[groupIndex] : null;

  const pastaMap = React.useMemo(() => {
    const m = new Map<number, Pasta>();
    pastasList.forEach(p => m.set(p.id, p));
    return m;
  }, [pastasList]);

  const sortedPastas = React.useMemo(() => {
    let list = assuntosCorFiltro
      ? pastasList.filter(p => p.cor === assuntosCorFiltro)
      : [...pastasList];
    list.sort((a, b) => {
      if (assuntosSort === 'az') return a.nome.localeCompare(b.nome);
      if (assuntosSort === 'za') return b.nome.localeCompare(a.nome);
      if (assuntosSort === 'most') return (b.note_count ?? 0) - (a.note_count ?? 0);
      if (assuntosSort === 'least') return (a.note_count ?? 0) - (b.note_count ?? 0);
      if (assuntosSort === 'oldest') return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    });
    return list;
  }, [pastasList, assuntosSort, assuntosCorFiltro]);

  // Group notes by verse (with notas filters)
  const notesGroups: Note[][] = React.useMemo(() => {
    let filtered = notesList;
    if (notasAssuntoFiltro.length > 0) {
      filtered = filtered.filter(n => n.pasta_id != null && notasAssuntoFiltro.includes(n.pasta_id));
    }
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
      if (notasSort === 'newest') return tB - tA;
      if (notasSort === 'oldest') return tA - tB;
      const refA = `${a[0].book_name ?? ''} ${a[0].chapter}:${a[0].verse}`;
      const refB = `${b[0].book_name ?? ''} ${b[0].chapter}:${b[0].verse}`;
      return notasSort === 'az' ? refA.localeCompare(refB) : refB.localeCompare(refA);
    });
    return groups;
  }, [notesList, notasSort, notasAssuntoFiltro]);

  // Grupos de anotação filtrados
  const filteredAnnotationGroups = React.useMemo(() => {
    return annotationGroupsList.filter(g => {
      if (notasAssuntoFiltro.length > 0) return false; // grupos globais não têm pasta
      return true;
    });
  }, [annotationGroupsList, notasAssuntoFiltro]);


  // Combine individual notes and group annotations
  const combinedNotesList = React.useMemo(() => {
    const list: Array<
      | { type: 'group'; data: NoteGroup; timestamp: number }
      | { type: 'individual'; data: Note[]; timestamp: number }
    > = [];

    const includeGlobal = notasTipo === 'global' || notasTipo === 'ambos';
    const includeVersiculo = notasTipo === 'versiculo' || notasTipo === 'ambos';

    if (includeGlobal) {
      filteredAnnotationGroups.forEach(g => {
        list.push({ type: 'group', data: g, timestamp: new Date(g.updated_at).getTime() });
      });
    }

    if (includeVersiculo) {
      notesGroups.forEach(group => {
        if (group.length > 0) {
          list.push({ type: 'individual', data: group, timestamp: new Date(group[0].updated_at).getTime() });
        }
      });
    }

    list.sort((a, b) => notasSort === 'oldest' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp);
    return list;
  }, [filteredAnnotationGroups, notesGroups, notasTipo, notasSort]);

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
      if (salvosTestamento === 'ot') return f.book_id <= 39;
      if (salvosTestamento === 'nt') return f.book_id >= 40;
      return true;
    });
  }, [favoritesList, highlights, selectedColorFilter, salvosTestamento]);

  // Agrupa favoritos: grupos de salvamento por group_id, individuais por capítulo
  const favoritesGroups: GroupedFavorite[] = React.useMemo(() => {
    const typeFiltered = filteredFavorites.slice();

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

    result.sort((a, b) => {
      if (salvosSort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (salvosSort === 'biblica') return a.book_id !== b.book_id ? a.book_id - b.book_id : a.chapter - b.chapter;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return result;
  }, [filteredFavorites, formatVerseIntervals, salvosSort]);


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
      setPastasList(getPastas());

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

      {/* Nav Block — tabs + busca num único container arredondado */}
      <View style={styles.navBlock}>
        {/* Tab Row */}
        <View style={styles.navTabRow}>
          {/* Tab Group */}
          <View style={styles.navTabGroup}>
            <Pressable
              style={styles.navTabChip}
              onPress={() => { setActiveTab('notes'); Vibration.vibrate(10); }}
            >
              <MessageSquare size={13} color={activeTab === 'notes' ? '#FFFFFF' : 'rgba(255,255,255,0.5)'} />
              <Text style={[styles.navTabChipText, { color: activeTab === 'notes' ? '#FFFFFF' : 'rgba(255,255,255,0.5)', opacity: activeTab === 'notes' ? 1 : 1 }]}>
                Anotações
              </Text>
            </Pressable>
            <Pressable
              style={styles.navTabChip}
              onPress={() => { setActiveTab('favorites'); Vibration.vibrate(10); }}
            >
              <Heart size={13} color={activeTab === 'favorites' ? '#FFFFFF' : 'rgba(255,255,255,0.5)'} />
              <Text style={[styles.navTabChipText, { color: activeTab === 'favorites' ? '#FFFFFF' : 'rgba(255,255,255,0.5)' }]}>
                Salvos
              </Text>
            </Pressable>
          </View>
          {/* Filter chip */}
          <Pressable style={styles.navFilterChip} onPress={() => { openFiltros(); Vibration.vibrate(10); }}>
            <SlidersHorizontal size={13} color='#8A8A8A' />
            <Text style={styles.navFilterChipText}>Filtros</Text>
          </Pressable>
        </View>
        {/* Separator */}
        <View style={styles.navSep} />
        {/* Search Row */}
        <View style={styles.navSearchRow}>
          <Search size={14} color='#555555' />
          <TextInput
            style={styles.navSearchInput}
            placeholder="Buscar notas e versículos..."
            placeholderTextColor='#555555'
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <X size={14} color='#555555' />
            </Pressable>
          )}
        </View>
      </View>

      {/* Sub-tabs under Anotações */}
      {activeTab === 'notes' && (
        <View style={styles.topBarRow}>
          {/* View Toggle */}
          <View style={styles.viewToggle}>
            <Pressable
              style={[styles.viewToggleOpt, anotacoesSubTab === 'assuntos' && styles.viewToggleOptActive]}
              onPress={() => { setAnotacoesSubTab('assuntos'); Vibration.vibrate(10); }}
            >
              <Folder size={12} color={anotacoesSubTab === 'assuntos' ? '#FFFFFF' : '#555555'} />
              <Text style={[styles.viewToggleOptText, { color: anotacoesSubTab === 'assuntos' ? '#FFFFFF' : '#555555', fontWeight: anotacoesSubTab === 'assuntos' ? '600' : '400' }]}>
                Assuntos
              </Text>
            </Pressable>
            <Pressable
              style={[styles.viewToggleOpt, anotacoesSubTab === 'notas' && styles.viewToggleOptActive]}
              onPress={() => { setAnotacoesSubTab('notas'); Vibration.vibrate(10); }}
            >
              <List size={12} color={anotacoesSubTab === 'notas' ? '#FFFFFF' : '#555555'} />
              <Text style={[styles.viewToggleOptText, { color: anotacoesSubTab === 'notas' ? '#FFFFFF' : '#555555', fontWeight: anotacoesSubTab === 'notas' ? '600' : '400' }]}>
                Notas
              </Text>
            </Pressable>
          </View>
          {/* New Btn — muda conforme sub-tab */}
          {anotacoesSubTab === 'assuntos' ? (
            <Pressable
              style={styles.newBtn}
              onPress={() => { router.push('/novo-assunto'); Vibration.vibrate(10); }}
            >
              <FolderOpen size={13} color='#8A8A8A' />
              <Text style={styles.newBtnText}>{pastasList.length}</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.newBtn, { backgroundColor: '#4A8FE7' }]}
              onPress={() => { setShowNoteTypeModal(true); Vibration.vibrate(10); }}
            >
              <Pencil size={13} color='#FFFFFF' />
              <Text style={[styles.newBtnText, { color: '#FFFFFF' }]}>{combinedNotesList.length}</Text>
            </Pressable>
          )}
        </View>
      )}


      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {/* TAB 1: ANOTAÇÕES */}
        {activeTab === 'notes' && anotacoesSubTab === 'assuntos' && (
          <View style={styles.listContainer}>
            {/* Pasta grid */}
            {pastasList.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyIconCircle, { backgroundColor: colors.accentSubtle }]}>
                  <FolderOpen size={32} color={colors.accent} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: 'serif' }]}>
                  Nenhum assunto criado
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  Crie assuntos para organizar suas meditações e anotações por tema.
                </Text>
              </View>
            ) : (
              <View style={styles.pastaGrid}>
                {sortedPastas.map((pasta) => {
                  const cardW = (SCREEN_WIDTH - 32 - 8) / 2;
                  return (
                    <Pressable
                      key={pasta.id}
                      style={[styles.pastaCard, { width: cardW }]}
                      onPress={() => {
                        setPastaSelecionar(pasta);
                        setNotasSelecionadas(new Set());
                        setNotasDaPasta(notesList.filter(n => n.pasta_id === pasta.id));
                        setShowSelecionarNotas(true);
                      }}
                      onLongPress={() => { setMenuPasta(pasta); Vibration.vibrate(30); }}
                    >
                      {/* Nome */}
                      <Text style={styles.pastaCardName} numberOfLines={2}>{pasta.nome}</Text>
                      {/* Count */}
                      <Text style={styles.pastaCardCount}>
                        {pasta.note_count ?? 0} {(pasta.note_count ?? 0) === 1 ? 'nota' : 'notas'}
                      </Text>
                      {/* Menu */}
                      <Pressable
                        style={styles.pastaMenuBtn}
                        onPress={() => { setMenuPasta(pasta); Vibration.vibrate(20); }}
                        hitSlop={8}
                      >
                        <MoreVertical size={20} color='#616161' />
                      </Pressable>
                      {/* Color dot */}
                      {pasta.cor && (
                        <View style={[styles.pastaColorDot, { backgroundColor: pasta.cor }]} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {activeTab === 'notes' && anotacoesSubTab === 'notas' && (
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
                      style={[styles.noteCard, { borderLeftColor: '#F59E0B', backgroundColor: colors.card }]}
                      onPress={() => setSelectedAnnotationGroup(ng)}
                    >
                      <View style={styles.noteCardBody}>
                        <View style={styles.noteCardHeader}>
                          <Text style={[styles.noteCardRef, { color: '#F59E0B' }]}>
                            {bookNameStr} {firstVerse.chapter}:{intervals}
                          </Text>
                          <View style={styles.noteDateBadge}>
                            <Calendar size={10} color='#8A8A8A' />
                            <Text style={styles.noteCardDate}>
                              {new Date(ng.updated_at).toLocaleDateString('pt-BR')}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.noteCardContent} numberOfLines={3}>{previewText}</Text>
                        <View style={styles.noteCardFooter}>
                          <View style={styles.cardLinkRow}>
                            <Text style={[styles.cardLinkText, { color: '#F59E0B' }]}>
                              {noteTexts.length > 1 ? `Ver ${noteTexts.length} notas` : 'Ler nota completa'}
                            </Text>
                            <ChevronRight size={12} color='#F59E0B' strokeWidth={2.5} />
                          </View>
                        </View>
                      </View>
                    </Pressable>
                  );
                } else {
                  const group = item.data;
                  const first = group[0];
                  const notaPasta = first.pasta_id ? pastaMap.get(first.pasta_id) : null;
                  return (
                    <Pressable
                      key={`group_${first.book_id}_${first.chapter}_${first.verse}`}
                      style={[styles.noteCard, { borderLeftColor: '#3B82F6', backgroundColor: colors.card }]}
                      onPress={() => handleOpenGroup(group)}
                    >
                      <View style={styles.noteCardBody}>
                        <View style={styles.noteCardHeader}>
                          <Text style={styles.noteCardRef}>
                            {bName(first.book_name ?? '', first.book_name_en)} {first.chapter}:{first.verse}
                          </Text>
                          <View style={styles.noteDateBadge}>
                            <Calendar size={10} color='#8A8A8A' />
                            <Text style={styles.noteCardDate}>
                              {new Date(first.updated_at).toLocaleDateString('pt-BR')}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.noteCardContent} numberOfLines={3}>
                          {first.content}
                        </Text>
                        <View style={styles.noteCardFooter}>
                          <View style={styles.cardLinkRow}>
                            <Text style={styles.cardLinkText}>
                              {group.length > 1 ? `Ver ${group.length} notas` : 'Ler nota completa'}
                            </Text>
                            <ChevronRight size={12} color='#3B82F6' strokeWidth={2.5} />
                          </View>
                          {notaPasta && (
                            <View style={styles.subjectBadge}>
                              <Text style={styles.subjectBadgeText} numberOfLines={1}>{notaPasta.nome}</Text>
                            </View>
                          )}
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

      {/* TELA: Selecionar Notas */}
      <Modal visible={showSelecionarNotas} animationType="slide" onRequestClose={() => setShowSelecionarNotas(false)}>
        <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
          {/* Header */}
          <View style={[styles.selecionarHeader, { borderBottomColor: colors.backgroundElement }]}>
            <Pressable style={[styles.selecionarBackBtn, { backgroundColor: colors.backgroundElement }]} onPress={() => setShowSelecionarNotas(false)}>
              <ChevronLeft size={20} color={colors.text} />
            </Pressable>
            <Text style={[styles.selecionarTitle, { color: colors.text }]}>{pastaSelecionar?.nome}</Text>
          </View>

          {/* Action Bar */}
          <View style={styles.selecionarActionBar}>
            <Pressable
              onPress={() => setNotasSelecionadas(new Set())}
              style={styles.selecionarCancelBtn}
            >
              <Text style={styles.selecionarCancelText}>Cancelar</Text>
            </Pressable>
            <Text style={styles.selecionarCount}>
              {notasSelecionadas.size} de {notasDaPasta.length} selecionadas
            </Text>
            <Pressable
              onPress={() => {
                const allSelected = notasSelecionadas.size === notasDaPasta.length && notasDaPasta.length > 0;
                setNotasSelecionadas(allSelected ? new Set() : new Set(notasDaPasta.map(n => n.id)));
              }}
              style={styles.todasBtn}
            >
              <Text style={styles.todasBtnText}>Todas</Text>
            </Pressable>
          </View>

          {/* Lista de notas com checkboxes */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 12 }}>
            {notasDaPasta.map((nota) => {
              const selected = notasSelecionadas.has(nota.id);
              return (
                <Pressable
                  key={nota.id}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
                  onPress={() => {
                    const next = new Set(notasSelecionadas);
                    if (selected) next.delete(nota.id); else next.add(nota.id);
                    setNotasSelecionadas(next);
                  }}
                >
                  {/* Checkbox */}
                  <View style={[styles.selecionarCheckbox, selected
                    ? { backgroundColor: colors.accent, borderColor: colors.accent }
                    : { backgroundColor: 'transparent', borderColor: colors.textMuted }
                  ]}>
                    {selected && <View style={styles.selecionarCheckboxInner} />}
                  </View>

                  {/* Card */}
                  <View style={[styles.selecionarCard, { backgroundColor: colors.card, flex: 1 }]}>
                    <View style={[styles.selecionarAccent, { backgroundColor: colors.accent }]} />
                    <View style={{ flex: 1, padding: 14, paddingLeft: 18, gap: 6 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.accent, fontFamily: 'serif' }}>
                          {nota.book_name} {nota.chapter}:{nota.verse}
                        </Text>
                        <View style={[styles.calendarBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                          <Calendar size={10} color={colors.textSecondary} />
                          <Text style={{ fontSize: 10, color: colors.textSecondary }}>{new Date(nota.updated_at).toLocaleDateString('pt-BR')}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 13, color: colors.text, lineHeight: 20 }} numberOfLines={3}>{nota.content}</Text>
                      <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '600' }}>Ler nota completa</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* CTA Bottom */}
          {notasSelecionadas.size > 0 && (
            <View style={[styles.selecionarCTA, { backgroundColor: colors.card, borderTopColor: colors.backgroundElement }]}>
              <Pressable
                style={[styles.selecionarCTABtn, { backgroundColor: colors.accent }]}
                onPress={() => { setShowSelecionarNotas(false); setPastaOrigem(pastaSelecionar); setShowMoverModal(true); }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>
                  Mover {notasSelecionadas.size} {notasSelecionadas.size === 1 ? 'nota' : 'notas'} →
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>

      {/* MODAL: Ver Descrição */}
      {showDescricaoModal && descricaoPasta && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowDescricaoModal(false)}>
          <Pressable style={styles.confirmBackdrop} onPress={() => setShowDescricaoModal(false)}>
            <Pressable style={[styles.confirmCard, { backgroundColor: colors.card, borderColor: colors.backgroundElement }]} onPress={() => {}}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={[styles.confirmTitle, { color: colors.text, marginBottom: 0 }]}>{descricaoPasta.nome}</Text>
                <Pressable onPress={() => setShowDescricaoModal(false)} style={[styles.closeBtn, { backgroundColor: colors.backgroundElement }]}>
                  <X size={16} color={colors.textSecondary} />
                </Pressable>
              </View>
              <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 22 }}>
                {descricaoPasta.descricao || 'Nenhuma descrição adicionada.'}
              </Text>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* MODAL: Filtros contextuais */}
      <Modal visible={showFiltrosModal} transparent animationType="slide" onRequestClose={() => setShowFiltrosModal(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowFiltrosModal(false)}>
          <Pressable style={styles.filtrosSheet} onPress={() => {}}>
            {/* Handle */}
            <View style={styles.filtrosHandle} />

            {/* Título */}
            <View style={styles.filtrosTitleRow}>
              <Text style={styles.filtrosTitleText}>Filtros</Text>
              <Pressable onPress={limparFiltros}>
                <Text style={styles.filtrosLimparText}>Limpar</Text>
              </Pressable>
            </View>
            <View style={styles.filtrosSep} />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>

              {/* ── ASSUNTOS ── */}
              {activeTab === 'notes' && anotacoesSubTab === 'assuntos' && (<>
                {/* Ordenar por */}
                <View style={styles.filtrosSection}>
                  <Text style={styles.filtrosSectionLabel}>Ordenar por</Text>
                  <View style={styles.filtrosRadioGroup}>
                    {([
                      { value: 'newest', label: 'Mais recentes' },
                      { value: 'oldest', label: 'Mais antigas' },
                      { value: 'az',     label: 'A–Z' },
                      { value: 'za',     label: 'Z–A' },
                      { value: 'most',   label: 'Mais notas' },
                      { value: 'least',  label: 'Menos notas' },
                    ] as const).map((opt, i, arr) => (
                      <React.Fragment key={opt.value}>
                        <Pressable style={styles.filtrosRadioRow} onPress={() => setPendingAssuntosSort(opt.value)}>
                          <Text style={[styles.filtrosRadioText, { color: pendingAssuntosSort === opt.value ? '#FFFFFF' : '#555555' }]}>{opt.label}</Text>
                          <View style={[styles.filtrosRadioBullet, pendingAssuntosSort === opt.value && styles.filtrosRadioBulletActive]}>
                            {pendingAssuntosSort === opt.value && <View style={styles.filtrosRadioDot} />}
                          </View>
                        </Pressable>
                        {i < arr.length - 1 && <View style={styles.filtrosRowSep} />}
                      </React.Fragment>
                    ))}
                  </View>
                </View>
                <View style={styles.filtrosSep} />

                {/* Cor */}
                <View style={styles.filtrosSection}>
                  <Text style={styles.filtrosSectionLabel}>Cor</Text>
                  <View style={styles.filtrosCorRow}>
                    <Pressable
                      style={[styles.filtrosCorNone, pendingAssuntosCorFiltro === null && { borderColor: '#4A8FE7' }]}
                      onPress={() => setPendingAssuntosCorFiltro(null)}
                    >
                      <Ban size={11} color='#666666' />
                    </Pressable>
                    {['#E74C3C','#F39C12','#2ECC71','#4A8FE7','#7B6CF0','#E91E8C'].map(cor => (
                      <Pressable
                        key={cor}
                        style={[styles.filtrosCorDot, { backgroundColor: cor }, pendingAssuntosCorFiltro === cor && styles.filtrosCorDotActive]}
                        onPress={() => setPendingAssuntosCorFiltro(pendingAssuntosCorFiltro === cor ? null : cor)}
                      />
                    ))}
                  </View>
                </View>
              </>)}

              {/* ── NOTAS ── */}
              {activeTab === 'notes' && anotacoesSubTab === 'notas' && (<>
                {/* Tipo */}
                <View style={styles.filtrosSection}>
                  <Text style={styles.filtrosSectionLabel}>Tipo</Text>
                  <View style={styles.filtrosSegment}>
                    {([
                      { value: 'versiculo', label: 'Versículo' },
                      { value: 'global',    label: 'Global' },
                      { value: 'ambos',     label: 'Ambos' },
                    ] as const).map((opt, i, arr) => {
                      const active = pendingNotasTipo === opt.value;
                      const radius: [number,number,number,number] = i === 0 ? [10,0,0,10] : i === arr.length-1 ? [0,10,10,0] : [0,0,0,0];
                      return (
                        <Pressable
                          key={opt.value}
                          style={[styles.filtrosSegmentOpt, { borderRadius: 0, borderTopLeftRadius: radius[0], borderTopRightRadius: radius[1], borderBottomRightRadius: radius[2], borderBottomLeftRadius: radius[3] }, active && { backgroundColor: '#2A2A2A' }]}
                          onPress={() => setPendingNotasTipo(opt.value)}
                        >
                          <Text style={[styles.filtrosSegmentText, { color: active ? '#4A8FE7' : '#555555', fontWeight: active ? '600' : '400' }]}>{opt.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <View style={styles.filtrosSep} />

                {/* Assunto */}
                {pastasList.length > 0 && (
                  <>
                    <View style={styles.filtrosSection}>
                      <Text style={styles.filtrosSectionLabel}>Assunto</Text>
                      <View style={styles.filtrosChipRow}>
                        {pastasList.map(p => {
                          const active = pendingNotasAssuntoFiltro.includes(p.id);
                          return (
                            <Pressable
                              key={p.id}
                              style={[styles.filtrosChip, active && styles.filtrosChipActive]}
                              onPress={() => {
                                setPendingNotasAssuntoFiltro(prev =>
                                  prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                                );
                              }}
                            >
                              <Text style={[styles.filtrosChipText, { color: active ? '#4A8FE7' : '#555555', fontWeight: active ? '600' : '400' }]}>{p.nome}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                    <View style={styles.filtrosSep} />
                  </>
                )}

                {/* Ordenar por */}
                <View style={styles.filtrosSection}>
                  <Text style={styles.filtrosSectionLabel}>Ordenar por</Text>
                  <View style={styles.filtrosRadioGroup}>
                    {([
                      { value: 'newest', label: 'Mais recentes' },
                      { value: 'oldest', label: 'Mais antigas' },
                      { value: 'az',     label: 'A–Z' },
                      { value: 'za',     label: 'Z–A' },
                    ] as const).map((opt, i, arr) => (
                      <React.Fragment key={opt.value}>
                        <Pressable style={styles.filtrosRadioRow} onPress={() => setPendingNotasSort(opt.value)}>
                          <Text style={[styles.filtrosRadioText, { color: pendingNotasSort === opt.value ? '#FFFFFF' : '#555555' }]}>{opt.label}</Text>
                          <View style={[styles.filtrosRadioBullet, pendingNotasSort === opt.value && styles.filtrosRadioBulletActive]}>
                            {pendingNotasSort === opt.value && <View style={styles.filtrosRadioDot} />}
                          </View>
                        </Pressable>
                        {i < arr.length - 1 && <View style={styles.filtrosRowSep} />}
                      </React.Fragment>
                    ))}
                  </View>
                </View>
              </>)}

              {/* ── SALVOS ── */}
              {activeTab === 'favorites' && (<>
                {/* Testamento */}
                <View style={styles.filtrosSection}>
                  <Text style={styles.filtrosSectionLabel}>Testamento</Text>
                  <View style={styles.filtrosSegment}>
                    {([
                      { value: 'ot',    label: 'A.T.' },
                      { value: 'nt',    label: 'N.T.' },
                      { value: 'ambos', label: 'Ambos' },
                    ] as const).map((opt, i, arr) => {
                      const active = pendingSalvosTestamento === opt.value;
                      const radius: [number,number,number,number] = i === 0 ? [10,0,0,10] : i === arr.length-1 ? [0,10,10,0] : [0,0,0,0];
                      return (
                        <Pressable
                          key={opt.value}
                          style={[styles.filtrosSegmentOpt, { borderTopLeftRadius: radius[0], borderTopRightRadius: radius[1], borderBottomRightRadius: radius[2], borderBottomLeftRadius: radius[3] }, active && { backgroundColor: '#2A2A2A' }]}
                          onPress={() => setPendingSalvosTestamento(opt.value)}
                        >
                          <Text style={[styles.filtrosSegmentText, { color: active ? '#4A8FE7' : '#555555', fontWeight: active ? '600' : '400' }]}>{opt.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <View style={styles.filtrosSep} />

                {/* Ordenar por */}
                <View style={styles.filtrosSection}>
                  <Text style={styles.filtrosSectionLabel}>Ordenar por</Text>
                  <View style={styles.filtrosRadioGroup}>
                    {([
                      { value: 'newest',  label: 'Mais recentes' },
                      { value: 'oldest',  label: 'Mais antigas' },
                      { value: 'biblica', label: 'Ordem bíblica' },
                    ] as const).map((opt, i, arr) => (
                      <React.Fragment key={opt.value}>
                        <Pressable style={styles.filtrosRadioRow} onPress={() => setPendingSalvosSort(opt.value)}>
                          <Text style={[styles.filtrosRadioText, { color: pendingSalvosSort === opt.value ? '#FFFFFF' : '#555555' }]}>{opt.label}</Text>
                          <View style={[styles.filtrosRadioBullet, pendingSalvosSort === opt.value && styles.filtrosRadioBulletActive]}>
                            {pendingSalvosSort === opt.value && <View style={styles.filtrosRadioDot} />}
                          </View>
                        </Pressable>
                        {i < arr.length - 1 && <View style={styles.filtrosRowSep} />}
                      </React.Fragment>
                    ))}
                  </View>
                </View>
              </>)}

            </ScrollView>

            {/* Separador + Aplicar */}
            <View style={styles.filtrosSep} />
            <View style={styles.filtrosFooter}>
              <Pressable style={styles.filtrosApplyBtn} onPress={applyFiltros}>
                <Text style={styles.filtrosApplyText}>Aplicar filtros</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* MODAL: Mover notas para... */}
      {showMoverModal && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShowMoverModal(false)}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setShowMoverModal(false)}>
            <Pressable style={[styles.sheetContainer, { backgroundColor: colors.card }]} onPress={() => {}}>
              <View style={[styles.sheetHandle, { backgroundColor: colors.backgroundElement }]} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={[styles.sheetTitleText, { color: colors.text }]}>Mover notas para...</Text>
                <Pressable onPress={() => setShowMoverModal(false)} style={[styles.closeBtn, { backgroundColor: colors.backgroundElement }]}>
                  <X size={16} color={colors.textSecondary} />
                </Pressable>
              </View>

              {pastasList.filter(p => p.id !== pastaOrigem?.id).map((pasta) => (
                <Pressable
                  key={pasta.id}
                  style={styles.sheetItem}
                  onPress={() => setShowMoverModal(false)}
                >
                  {pasta.cor
                    ? <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: pasta.cor }} />
                    : <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: colors.textMuted }} />
                  }
                  <Text style={[styles.sheetItemText, { color: colors.text, flex: 1 }]}>{pasta.nome}</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>{pasta.note_count ?? 0} notas</Text>
                </Pressable>
              ))}

              {pastasList.filter(p => p.id !== pastaOrigem?.id).length === 0 && (
                <Text style={{ color: colors.textSecondary, textAlign: 'center', paddingVertical: 24, fontSize: 14 }}>
                  Nenhum outro assunto disponível.
                </Text>
              )}

              <Pressable onPress={() => setShowMoverModal(false)} style={{ alignItems: 'center', paddingVertical: 18 }}>
                <Text style={{ fontSize: 15, color: colors.textSecondary, fontWeight: '500' }}>Cancelar</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Modal: Nova Pasta */}

      {/* Modal: Menu Pasta */}
      {menuPasta && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setMenuPasta(null)}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setMenuPasta(null)}>
            <Pressable style={[styles.sheetContainer, { backgroundColor: colors.card }]} onPress={() => {}}>
              {/* Handle */}
              <View style={[styles.sheetHandle, { backgroundColor: colors.backgroundElement }]} />

              {/* Título com dot de cor */}
              <View style={[styles.sheetTitleRow, { borderBottomColor: colors.backgroundElement }]}>
                {menuPasta.cor
                  ? <View style={[styles.pastaColorDot, { backgroundColor: menuPasta.cor, width: 14, height: 14, borderRadius: 7 }]} />
                  : <View style={[styles.pastaColorDot, { backgroundColor: colors.backgroundElement, width: 14, height: 14, borderRadius: 7 }]} />
                }
                <Text style={[styles.sheetTitleText, { color: colors.text }]}>{menuPasta.nome}</Text>
              </View>

              {/* Separador após título */}
              <View style={{ height: 1, backgroundColor: '#2E2E2E' }} />

              {/* Opções */}
              {[
                { icon: <Pencil size={20} color='#FFFFFF' />, label: 'Renomear', onPress: () => setMenuPasta(null) },
                {
                  icon: <Maximize2 size={20} color='#FFFFFF' />, label: 'Mover notas para...', onPress: () => {
                    const p = menuPasta;
                    setMenuPasta(null);
                    setPastaOrigem(p);
                    setShowMoverModal(true);
                  }
                },
                {
                  icon: <Eye size={20} color='#FFFFFF' />, label: 'Ver descrição', onPress: () => {
                    const p = menuPasta;
                    setMenuPasta(null);
                    setDescricaoPasta(p);
                    setShowDescricaoModal(true);
                  }
                },
              ].map((item) => (
                <Pressable
                  key={item.label}
                  style={styles.sheetItem}
                  onPress={item.onPress}
                >
                  {item.icon}
                  <Text style={[styles.sheetItemText, { color: '#FFFFFF' }]}>{item.label}</Text>
                </Pressable>
              ))}

              <View style={{ height: 1, backgroundColor: '#2E2E2E' }} />

              <Pressable
                style={styles.sheetItem}
                onPress={() => {
                  const pasta = menuPasta;
                  setMenuPasta(null);
                  setConfirmDialog({
                    title: 'Excluir assunto',
                    message: `Deseja excluir "${pasta.nome}"? As notas dentro do assunto não serão excluídas.`,
                    confirmLabel: 'Excluir',
                    onConfirm: () => { deletePasta(pasta.id); loadData(); Vibration.vibrate(30); },
                  });
                }}
              >
                <Trash2 size={20} color='#FF3B30' />
                <Text style={[styles.sheetItemText, { color: '#FF3B30' }]}>Excluir pasta</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Modal: Tipo de nota */}
      <Modal visible={showNoteTypeModal} transparent animationType="slide" onRequestClose={() => setShowNoteTypeModal(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowNoteTypeModal(false)}>
          <Pressable style={[styles.sheetContainer, { backgroundColor: '#1E1E1E' }]} onPress={() => {}}>
            <View style={[styles.sheetHandle, { backgroundColor: '#333333' }]} />
            <Text style={[styles.noteTypeHeading, { color: '#666666' }]}>Nova nota</Text>
            <Pressable
              style={styles.noteTypeRow}
              onPress={() => {
                setShowNoteTypeModal(false);
                router.navigate({ pathname: '/', params: { resetScroll: 'true' } });
              }}
            >
              <View style={[styles.noteTypeIcon, { backgroundColor: '#1A2233' }]}>
                <BookOpen size={19} color='#3B82F6' />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.noteTypeTitle, { color: '#FFFFFF' }]}>Nota de versículo</Text>
                <Text style={[styles.noteTypeDesc, { color: '#666666' }]}>Selecione um versículo como base</Text>
              </View>
            </Pressable>
            <View style={[styles.noteTypeSep, { backgroundColor: '#2A2A2A' }]} />
            <Pressable
              style={styles.noteTypeRow}
              onPress={() => {
                setShowNoteTypeModal(false);
                router.push('/nota-global');
              }}
            >
              <View style={[styles.noteTypeIcon, { backgroundColor: '#27200A' }]}>
                <Pencil size={19} color='#F59E0B' />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.noteTypeTitle, { color: '#FFFFFF' }]}>Nota global</Text>
                <Text style={[styles.noteTypeDesc, { color: '#666666' }]}>Escreva livremente e vincule versículos</Text>
              </View>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

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

const PASTA_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  filterIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Search bar */
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: Spacing.four,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  /* Sub-tabs */
  subTabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingBottom: 10,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  subTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  subTabActive: {},
  subTabText: {
    fontSize: 13,
  },
  noteCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  noteCountText: {
    fontSize: 12,
    fontWeight: '700',
  },
  /* Pasta grid */
  assuntosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  assuntosTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  novaPastaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  novaPastaBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  /* Nav Block (tabs + search container) */
  navBlock: {
    backgroundColor: '#242424',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2E2E2E',
    marginHorizontal: 16,
    marginTop: 15,
  },
  navTabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  navTabGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  navTabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  navTabChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  navFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  navFilterChipText: {
    fontSize: 12,
    color: '#8A8A8A',
  },
  navSep: {
    height: 1,
    backgroundColor: '#2E2E2E',
  },
  navSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  navSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#FFFFFF',
    padding: 0,
  },
  /* Sub-tab row (view toggle + new pasta btn) */
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  viewToggle: {
    flexDirection: 'row',
    gap: 2,
    backgroundColor: '#242424',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2E2E2E',
    padding: 2,
  },
  viewToggleOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  viewToggleOptActive: {
    backgroundColor: '#2A2A2A',
  },
  viewToggleOptText: {
    fontSize: 12,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  newBtnText: {
    fontSize: 12,
    color: '#8A8A8A',
  },
  pastaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
  },
  pastaCard: {
    height: 104,
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    overflow: 'hidden',
  },
  pastaCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
  },
  pastaCardName: {
    position: 'absolute',
    left: 14,
    top: 14,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 112,
  },
  pastaMenuBtn: {
    position: 'absolute',
    right: 9,
    top: 36,
  },
  pastaCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pastaCardCount: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    fontSize: 10,
    color: '#555555',
  },
  pastaColorDot: {
    position: 'absolute',
    right: 18,
    bottom: 15,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  /* Nova pasta modal inputs */
  pastaInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 16,
  },
  pastaInputMulti: {
    height: 80,
    textAlignVertical: 'top',
  },
  corPickerDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  /* Selecionar Notas */
  selecionarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  selecionarBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selecionarTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  selecionarActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#242424',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#2E2E2E',
  },
  selecionarCancelBtn: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  selecionarCancelText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  selecionarCount: {
    fontSize: 12,
    color: '#555555',
  },
  selecionarCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selecionarCheckboxInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFF',
  },
  selecionarCard: {
    borderRadius: 12,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  selecionarAccent: {
    width: 4,
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
  },
  selecionarCTA: {
    padding: 16,
    borderTopWidth: 1,
  },
  selecionarCTABtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  /* Menu pasta — bottom sheet */
  menuPastaItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  menuPastaItemText: {
    fontSize: 15,
    fontWeight: '500',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    marginBottom: 4,
  },
  sheetTitleText: {
    fontSize: 16,
    fontWeight: '700',
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
  },
  sheetItemText: {
    fontSize: 15,
    fontWeight: '500',
  },
  tabSelectorCapsule: {
    flex: 1,
    flexDirection: 'row',
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
    paddingHorizontal: 16,
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
    borderLeftWidth: 4,
    borderRadius: 14,
    overflow: 'hidden',
  },
  noteCardBody: {
    padding: 16,
    gap: 10,
  },
  noteCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  noteCardRef: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3B82F6',
    fontFamily: 'serif',
  },
  noteDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
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
    color: '#8A8A8A',
  },
  noteCardContent: {
    fontSize: 13,
    lineHeight: 21,
    color: '#FFFFFF',
  },
  noteCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  cardLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  cardLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3B82F6',
  },
  subjectBadge: {
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  subjectBadgeText: {
    color: '#b5b5b5',
    fontSize: 10,
    fontWeight: '600',
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
  notePastaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    maxWidth: 120,
  },
  notePastaBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  todasBtn: {
    backgroundColor: '#4A8FE7',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  todasBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  /* Filtros bottom sheet */
  filtrosSheet: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 28,
    maxHeight: '90%',
  },
  filtrosHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3A3A3A',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 14,
  },
  filtrosTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  filtrosTitleText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  filtrosLimparText: {
    fontSize: 14,
    color: '#4A8FE7',
  },
  filtrosSep: {
    height: 1,
    backgroundColor: '#2E2E2E',
  },
  filtrosSection: {
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  filtrosSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555555',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  filtrosRadioGroup: {
    backgroundColor: '#242424',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2E2E2E',
    overflow: 'hidden',
  },
  filtrosRadioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  filtrosRowSep: {
    height: 1,
    backgroundColor: '#2E2E2E',
  },
  filtrosRadioText: {
    fontSize: 14,
  },
  filtrosRadioBullet: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#2E2E2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtrosRadioBulletActive: {
    backgroundColor: '#4A8FE7',
    borderColor: '#4A8FE7',
  },
  filtrosRadioDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  filtrosSegment: {
    flexDirection: 'row',
    backgroundColor: '#242424',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2E2E2E',
    overflow: 'hidden',
  },
  filtrosSegmentOpt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  filtrosSegmentText: {
    fontSize: 13,
  },
  filtrosChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filtrosChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#242424',
    borderWidth: 1,
    borderColor: '#2E2E2E',
  },
  filtrosChipActive: {
    backgroundColor: '#1A2A4A',
    borderColor: 'transparent',
  },
  filtrosChipText: {
    fontSize: 12,
  },
  filtrosCorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filtrosCorNone: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: '#2E2E2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtrosCorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  filtrosCorDotActive: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
  filtrosFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  filtrosApplyBtn: {
    backgroundColor: '#4A8FE7',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  filtrosApplyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  noteTypeHeading: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  noteTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  noteTypeSep: {
    height: 1,
    marginLeft: 54,
  },
  noteTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteTypeTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  noteTypeDesc: {
    fontSize: 12,
    lineHeight: 16,
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
