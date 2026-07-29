import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, Vibration,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Link2, Bold, Italic, Underline, AlignLeft, X } from 'lucide-react-native';
import { addNoteGroup, updateNoteGroup, getVerses, cleanJesusTags } from '@/database/queries';
import { linkVerseCallbackRef, globalVersionRef } from '@/components/verse-context-ref';

const MAX_LEN = 500;

interface LinkedVerse {
  book_id: number;
  chapter: number;
  verse: number;
  book_abbrev: string;
  text: string;
}

export default function NotaGlobal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ groupId?: string; initialContent?: string }>();

  const [content, setContent] = useState(params.initialContent ?? '');
  const [linkedVerses, setLinkedVerses] = useState<LinkedVerse[]>([]);

  const openVersePicker = () => {
    // Registra callback: estudo vai chamar isso ao confirmar o versículo
    linkVerseCallbackRef.current = (book_id, chapter, verse, book_abbrev) => {
      const version = globalVersionRef.current ?? 'ara';
      const versesData = getVerses(book_id, chapter, [version]);
      const vData = versesData.find(v => v.verse === verse);
      const text = cleanJesusTags(
        vData?.text_ara ?? vData?.text_arc ?? vData?.text_kjv ?? vData?.text_dby ?? ''
      );
      setLinkedVerses(prev => {
        const already = prev.some(v => v.book_id === book_id && v.chapter === chapter && v.verse === verse);
        if (already) return prev;
        return [...prev, { book_id, chapter, verse, book_abbrev, text }];
      });
    };
    router.push('/vincular');
  };

  const handleSave = () => {
    if (!content.trim()) return;
    const verses = linkedVerses.map(v => ({ book_id: v.book_id, chapter: v.chapter, verse: v.verse }));
    if (params.groupId) {
      updateNoteGroup(Number(params.groupId), content.trim());
    } else {
      addNoteGroup(content.trim(), verses);
    }
    Vibration.vibrate(20);
    router.back();
  };

  const removeVerse = (idx: number) => {
    setLinkedVerses(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={18} color='#FFFFFF' />
        </Pressable>
        <Text style={styles.headerTitle}>Nota global</Text>
        <Pressable
          style={styles.verseBtn}
          onPress={openVersePicker}
        >
          <Link2 size={14} color='#FFFFFF' />
          <Text style={styles.verseBtnText}>Versículo</Text>
        </Pressable>
      </View>

      {/* Formatting toolbar */}
      <View style={styles.toolbar}>
        {[
          { icon: <Bold size={16} color='#8A8A8A' /> },
          { icon: <Italic size={16} color='#8A8A8A' /> },
          { icon: <Underline size={16} color='#8A8A8A' /> },
          { icon: <AlignLeft size={16} color='#8A8A8A' /> },
        ].map((item, i) => (
          <Pressable key={i} style={styles.toolbarBtn}>
            {item.icon}
          </Pressable>
        ))}
      </View>

      <KeyboardAwareScrollView
        keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        bottomOffset={20}
      >
        {/* Linked verse chips */}
        {linkedVerses.length > 0 && (
          <View style={styles.chipsRow}>
            {linkedVerses.map((v, i) => (
              <View key={i} style={styles.chip}>
                <Text style={styles.chipText}>↗ {v.book_abbrev} {v.chapter}:{v.verse}</Text>
                <Pressable onPress={() => removeVerse(i)} hitSlop={6}>
                  <X size={11} color='#8A8A8A' />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Text editor */}
        <TextInput
          style={styles.editor}
          placeholder="Escreva sua nota livremente..."
          placeholderTextColor='#444444'
          value={content}
          onChangeText={t => setContent(t.slice(0, MAX_LEN))}
          multiline
          textAlignVertical="top"
          autoFocus
        />

        {/* Counter */}
        <Text style={styles.counter}>{content.length}/{MAX_LEN}</Text>
      </KeyboardAwareScrollView>

      {/* Save button */}
      <View style={[styles.cta, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={[styles.saveBtn, !content.trim() && { opacity: 0.4 }]}
          onPress={handleSave}
          disabled={!content.trim()}
        >
          <Text style={styles.saveBtnText}>Salvar nota</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#242424',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  verseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4A8FE7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  verseBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#2A2A2A',
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 4,
  },
  toolbarBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  body: {
    padding: 20,
    flexGrow: 1,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1A2A1A',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#2A3A2A',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4ADE80',
  },
  editor: {
    flex: 1,
    fontSize: 16,
    lineHeight: 26,
    color: '#FFFFFF',
    textAlignVertical: 'top',
    minHeight: 200,
    padding: 0,
  },
  counter: {
    fontSize: 12,
    color: '#444444',
    marginTop: 12,
    alignSelf: 'flex-end',
  },
  cta: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E1E1E',
  },
  saveBtn: {
    backgroundColor: '#4A8FE7',
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
