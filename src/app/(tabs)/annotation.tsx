import { useAppTheme } from '@/components/ThemeContext';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
 
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { Colors, Spacing } from '@/constants/theme';
import { saveNote, deleteNote, getVerses } from '@/database/queries';

export default function AnnotationScreen() {
  const router = useRouter();
  const { isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  
  const colors = Colors[isDark ? 'dark' : 'light'];

  const { bookId, bookName, chapter, verse, verseText, initialNote } = useLocalSearchParams<{
    bookId: string;
    bookName: string;
    chapter: string;
    verse: string;
    verseText: string;
    initialNote: string;
  }>();

  const [noteText, setNoteText] = useState(initialNote ?? '');

  useEffect(() => {
    setNoteText(initialNote ?? '');
  }, [bookId, chapter, verse]);

  const handleSave = () => {
    const bookIdNum = Number(bookId);
    const chapterNum = Number(chapter);
    const verseNum = Number(verse);
    if (noteText.trim() === '') {
      deleteNote(bookIdNum, chapterNum, verseNum);
    } else {
      saveNote(bookIdNum, chapterNum, verseNum, noteText.trim());
    }
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.backgroundElement }]}>
          <Text style={[styles.headerTitle, { color: colors.text, fontFamily: 'serif' }]}>
            {bookName} {chapter}:{verse}
          </Text>
          <Pressable onPress={() => router.back()} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Note input */}
        <View style={[styles.inputContainer, { borderBottomColor: colors.backgroundElement }]}>
          <TextInput
            style={[styles.noteInput, { color: colors.text }]}
            placeholder="Escreva sua anotação aqui..."
            placeholderTextColor={colors.textMuted}
            multiline
            autoFocus
            value={noteText}
            onChangeText={setNoteText}
          />
          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            {noteText.length > 0 && (
              <Pressable
                onPress={() => setNoteText('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.error ?? '#EF4444', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} color="#fff" />
              </Pressable>
            )}
            <Pressable style={[styles.saveBtn, { backgroundColor: colors.accent, flex: 1 }]} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Salvar</Text>
            </Pressable>
          </View>
        </View>

        {/* Verse preview */}
        <ScrollView style={styles.verseArea} showsVerticalScrollIndicator={false}>
          <View style={[styles.verseCard, { backgroundColor: colors.backgroundElement, borderLeftColor: colors.accent }]}>
            <Text style={[styles.verseText, { color: colors.textSecondary }]}>"{verseText}"</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: Spacing.one,
  },
  inputContainer: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    gap: Spacing.two,
  },
  noteInput: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveBtn: {
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  verseArea: {
    flex: 1,
    padding: Spacing.four,
  },
  verseCard: {
    padding: Spacing.three,
    borderLeftWidth: 3,
    borderRadius: 6,
  },
  verseText: {
    fontSize: 17,
    lineHeight: 28,
    fontFamily: 'serif',
    fontStyle: 'italic',
  },
});
