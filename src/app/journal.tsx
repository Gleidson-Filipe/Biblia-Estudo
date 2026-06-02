import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  Pressable,
  ScrollView,
  Vibration,
  Modal,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BookOpen, MessageSquare, Heart, Trash2, Calendar, ChevronRight, X, ArrowUpRight, BookMarked, Bookmark } from 'lucide-react-native';
import { Colors, Spacing } from '@/constants/theme';
import {
  getAllNotes,
  deleteNote,
  getAllFavorites,
  toggleFavorite,
  getBooks,
  getVerse,
  Note,
  Favorite
} from '@/database/queries';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function GeneralJournalScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];
  const router = useRouter();

  // Tab: 'notes' or 'favorites'
  const [activeTab, setActiveTab] = useState<'notes' | 'favorites'>('notes');

  // Data states
  const [notesList, setNotesList] = useState<Note[]>([]);
  const [favoritesList, setFavoritesList] = useState<Favorite[]>([]);

  // Detailed Modal states
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteVerseText, setNoteVerseText] = useState<string>('');

  // Load general logs and favorites on focus / mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    try {
      const allNotes = getAllNotes();
      setNotesList(allNotes);

      // Load favorites and fetch their text properties
      const favs = getAllFavorites();
      setFavoritesList(favs);
    } catch (err) {
      console.log('Error loading journal data:', err);
    }
  };

  // Navigate back to reader at chosen verse
  const handleGoToVerse = (bookId: number, chapter: number, verse: number) => {
    setSelectedNote(null);
    router.navigate({
      pathname: '/',
      params: {
        bookId: String(bookId),
        chapter: String(chapter),
        verse: String(verse)
      }
    });
  };

  // Open note details modal
  const handleOpenNoteDetails = async (note: Note) => {
    setSelectedNote(note);
    Vibration.vibrate(20);
    
    // Fetch verse content for citation block
    try {
      const verseObj = getVerse(note.book_id, note.chapter, note.verse);
      if (verseObj) {
        setNoteVerseText(verseObj.text_ara);
      } else {
        setNoteVerseText('');
      }
    } catch (_) {
      setNoteVerseText('');
    }
  };

  // Delete note from general list
  const handleDeleteNote = (note: Note) => {
    Alert.alert(
      'Confirmar Exclusão',
      `Tem certeza que deseja apagar a anotação de ${note.book_name} ${note.chapter}:${note.verse}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            deleteNote(note.book_id, note.chapter, note.verse);
            Vibration.vibrate(30);
            setSelectedNote(null);
            loadData();
          }
        }
      ]
    );
  };

  // Remove favorite directly from list
  const handleRemoveFavorite = (fav: Favorite) => {
    toggleFavorite(fav.book_id, fav.chapter, fav.verse);
    Vibration.vibrate(20);
    loadData();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Premium Elegant Header */}
      <View style={[styles.headerContainer, { borderBottomColor: colors.backgroundElement }]}>
        <View style={styles.headerTitleRow}>
          <View style={[styles.headerIconBg, { backgroundColor: colors.accentSubtle }]}>
            <Bookmark size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text, fontFamily: 'serif' }]}>
              Diário & Notas
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Seu repositório espiritual e meditações catalogadas
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {/* TAB 1: NOTES LIST */}
        {activeTab === 'notes' && (
          <View style={styles.listContainer}>
            {notesList.length === 0 ? (
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
                  onPress={() => router.navigate('/')}
                >
                  <Text style={styles.emptyActionBtnText}>Escolher Versículo para Anotar</Text>
                </Pressable>
              </View>
            ) : (
              notesList.map((note) => (
                <Pressable
                  key={`note_item_${note.book_id}_${note.chapter}_${note.verse}`}
                  style={[
                    styles.noteCard, 
                    { 
                      backgroundColor: colors.card, 
                      borderColor: colors.backgroundElement,
                      borderLeftColor: colors.accent,
                    }
                  ]}
                  onPress={() => handleOpenNoteDetails(note)}
                >
                  {/* Left accent bar handled via border style in StyleSheet */}
                  <View style={styles.noteCardBody}>
                    <View style={styles.noteCardHeader}>
                      <Text style={[styles.noteCardRef, { color: colors.accent, fontFamily: 'serif' }]}>
                        {note.book_name} {note.chapter}:{note.verse}
                      </Text>
                      
                      <View style={[styles.calendarBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)' }]}>
                        <Calendar size={11} color={colors.textSecondary} />
                        <Text style={[styles.noteCardDate, { color: colors.textSecondary }]}>
                          {new Date(note.updated_at).toLocaleDateString('pt-BR')}
                        </Text>
                      </View>
                    </View>
                    
                    <Text style={[styles.noteCardContent, { color: colors.text }]} numberOfLines={3}>
                      {note.content}
                    </Text>

                    <View style={styles.cardLinkRow}>
                      <Text style={[styles.cardLinkText, { color: colors.accent }]}>Ler meditação completa</Text>
                      <ChevronRight size={12} color={colors.accent} strokeWidth={2.5} />
                    </View>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}

        {/* TAB 2: FAVORITES LIST */}
        {activeTab === 'favorites' && (
          <View style={styles.listContainer}>
            {favoritesList.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyIconCircle, { backgroundColor: colors.accentSubtle }]}>
                  <Heart size={32} color={colors.accent} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: 'serif' }]}>
                  Nenhum favorito guardado
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  Marque seus versículos mais preciosos com um coração na aba Leitura para colecioná-los nesta lista para memorização!
                </Text>
                <Pressable
                  style={[styles.emptyActionBtn, { backgroundColor: colors.accent }]}
                  onPress={() => router.navigate('/')}
                >
                  <Text style={styles.emptyActionBtnText}>Abrir Bíblia Sagrada</Text>
                </Pressable>
              </View>
            ) : (
              favoritesList.map((fav) => {
                const bookName = fav.book_name ?? 'Livro';
                return (
                  <View
                    key={`fav_item_${fav.book_id}_${fav.chapter}_${fav.verse}`}
                    style={[
                      styles.favoriteCard, 
                      { 
                        backgroundColor: colors.card, 
                        borderColor: colors.backgroundElement,
                        borderLeftColor: colors.accent,
                      }
                    ]}
                  >
                    <Pressable
                      style={{ flex: 1, paddingRight: Spacing.two }}
                      onPress={() => handleGoToVerse(fav.book_id, fav.chapter, fav.verse)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.two }}>
                        <Text style={[styles.favRefText, { color: colors.accent, fontFamily: 'serif' }]}>
                          {bookName} {fav.chapter}:{fav.verse}
                        </Text>
                        <View style={[styles.arrowBadge, { backgroundColor: colors.accentSubtle }]}>
                          <ArrowUpRight size={10} color={colors.accent} strokeWidth={2.5} />
                        </View>
                      </View>
                      <Text style={[styles.favExcerptText, { color: colors.text }]} numberOfLines={2}>
                        "{fav.text_ara}"
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.favRemoveBtn, { backgroundColor: colors.error + '10' }]}
                      onPress={() => handleRemoveFavorite(fav)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Trash2 size={15} color={colors.error} />
                    </Pressable>
                  </View>
                );
              })
            )}
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
          onRequestClose={() => setSelectedNote(null)}
        >
          <GestureHandlerRootView style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.backgroundElement }]}>
              {/* Modal Header */}
              <View style={[styles.modalHeader, { borderBottomColor: colors.backgroundElement }]}>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.text, fontFamily: 'serif' }]}>
                    {selectedNote.book_name} {selectedNote.chapter}:{selectedNote.verse}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Meditação Teológica
                  </Text>
                </View>
                <Pressable
                  onPress={() => setSelectedNote(null)}
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
                    backgroundColor: isDark ? '#232120' : '#FAF6EE', 
                    borderColor: isDark ? '#363230' : '#EAE2D5' 
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
              onPress={() => setSelectedNote(null)}
            />
          </GestureHandlerRootView>
        </Modal>
      )}
    </SafeAreaView>
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
});
