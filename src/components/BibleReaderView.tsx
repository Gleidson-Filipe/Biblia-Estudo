import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { requireNativeComponent, UIManager, findNodeHandle, Platform, View } from 'react-native';

const NativeBibleReaderView = requireNativeComponent<any>('BibleReaderView');

export interface BibleReaderViewRef {
  loadChapter: (html: string, scrollToVerse?: number) => void;
  scrollToVerse: (verseNum: number) => void;
  clearSelection: () => void;
  updateVerseHighlight: (verseNum: number, color: string | null) => void;
  showInterlinear: (verseNum: number, wordsJson: string) => void;
  clearInterlinear: (verseNum: number) => void;
  selectVerse: (verseNum: number) => void;
  updateHtml: (html: string) => void;
  updateBadges: (noteVerses: number[], corrVerses: number[], groupNoteVerses?: number[], groupCorrVerses?: number[]) => void;
  toggleMultiSelect: (verseNum: number) => void;
  clearMultiSelect: () => void;
  updateSavedNoColor: (verseNums: number[]) => void;
  removeSavedNoColor: (verseNums: number[]) => void;
}

interface Props {
  style?: any;
  isDark?: boolean;
  onVersePress?: (verseNum: number) => void;
  onVerseNumPress?: (verseNum: number) => void;
  onVerseComparePress?: (verseNum: number) => void;
  onInterlinearWordPress?: (strongs: string, gloss: string, translit: string) => void;
  onInterlinearDismiss?: (verseNum: number) => void;
}

const BibleReaderView = forwardRef<BibleReaderViewRef, Props>(({ style, isDark, onVersePress, onVerseNumPress, onVerseComparePress, onInterlinearWordPress, onInterlinearDismiss }, ref) => {
  const nativeRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    loadChapter: (html: string, scrollToVerse = 1) => {
      const handle = findNodeHandle(nativeRef.current);
      if (handle) {
        UIManager.dispatchViewManagerCommand(handle, 'loadChapter', [html, scrollToVerse]);
      }
    },
    scrollToVerse: (verseNum: number) => {
      const handle = findNodeHandle(nativeRef.current);
      if (handle) {
        UIManager.dispatchViewManagerCommand(handle, 'scrollToVerse', [verseNum]);
      }
    },
    clearSelection: () => {
      const handle = findNodeHandle(nativeRef.current);
      if (handle) {
        UIManager.dispatchViewManagerCommand(handle, 'clearSelection', []);
      }
    },
    updateVerseHighlight: (verseNum: number, color: string | null) => {
      const handle = findNodeHandle(nativeRef.current);
      if (handle) {
        UIManager.dispatchViewManagerCommand(handle, 'updateVerseHighlight', [verseNum, color ?? '']);
      }
    },
    showInterlinear: (verseNum: number, wordsJson: string) => {
      const handle = findNodeHandle(nativeRef.current);
      if (handle) {
        UIManager.dispatchViewManagerCommand(handle, 'showInterlinear', [verseNum, wordsJson]);
      }
    },
    clearInterlinear: (verseNum: number) => {
      const handle = findNodeHandle(nativeRef.current);
      if (handle) {
        UIManager.dispatchViewManagerCommand(handle, 'clearInterlinear', [verseNum]);
      }
    },
    selectVerse: (verseNum: number) => {
      const handle = findNodeHandle(nativeRef.current);
      if (handle) {
        UIManager.dispatchViewManagerCommand(handle, 'selectVerse', [verseNum]);
      }
    },
    updateHtml: (html: string) => {
      const handle = findNodeHandle(nativeRef.current);
      if (handle) {
        UIManager.dispatchViewManagerCommand(handle, 'updateHtml', [html]);
      }
    },
    updateBadges: (noteVerses: number[], corrVerses: number[], groupNoteVerses: number[] = [], groupCorrVerses: number[] = []) => {
      const handle = findNodeHandle(nativeRef.current);
      if (handle) {
        UIManager.dispatchViewManagerCommand(handle, 'updateBadges', [JSON.stringify(noteVerses), JSON.stringify(corrVerses), JSON.stringify(groupNoteVerses), JSON.stringify(groupCorrVerses)]);
      }
    },
    toggleMultiSelect: (verseNum: number) => {
      const handle = findNodeHandle(nativeRef.current);
      if (handle) {
        UIManager.dispatchViewManagerCommand(handle, 'toggleMultiSelect', [verseNum]);
      }
    },
    clearMultiSelect: () => {
      const handle = findNodeHandle(nativeRef.current);
      if (handle) {
        UIManager.dispatchViewManagerCommand(handle, 'clearMultiSelect', []);
      }
    },
    updateSavedNoColor: (verseNums: number[]) => {
      const handle = findNodeHandle(nativeRef.current);
      if (handle) {
        UIManager.dispatchViewManagerCommand(handle, 'updateSavedNoColor', [verseNums]);
      }
    },
    removeSavedNoColor: (verseNums: number[]) => {
      const handle = findNodeHandle(nativeRef.current);
      if (handle) {
        UIManager.dispatchViewManagerCommand(handle, 'removeSavedNoColor', [verseNums]);
      }
    },
  }));

  if (Platform.OS !== 'android') {
    return <View style={style} />;
  }

  return (
    <NativeBibleReaderView
      ref={nativeRef}
      style={style}
      isDark={isDark}
      onVersePress={(e: any) => onVersePress?.(e.nativeEvent.verse)}
      onVerseNumPress={(e: any) => onVerseNumPress?.(e.nativeEvent.verse)}
      onVerseComparePress={(e: any) => onVerseComparePress?.(e.nativeEvent.verse)}
      onInterlinearWordPress={(e: any) => onInterlinearWordPress?.(e.nativeEvent.strongs, e.nativeEvent.gloss, e.nativeEvent.translit)}
      onInterlinearDismiss={(e: any) => onInterlinearDismiss?.(e.nativeEvent.verse)}
    />
  );
});

export default BibleReaderView;
