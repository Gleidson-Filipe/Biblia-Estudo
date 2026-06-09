import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { requireNativeComponent, UIManager, findNodeHandle, Platform, View } from 'react-native';

const NativeBibleReaderView = requireNativeComponent<any>('BibleReaderView');

export interface BibleReaderViewRef {
  loadChapter: (html: string, scrollToVerse?: number) => void;
  scrollToVerse: (verseNum: number) => void;
}

interface Props {
  style?: any;
  isDark?: boolean;
  onVersePress?: (verseNum: number) => void;
  onVerseNumPress?: (verseNum: number) => void;
  onVerseComparePress?: (verseNum: number) => void;
}

const BibleReaderView = forwardRef<BibleReaderViewRef, Props>(({ style, isDark, onVersePress, onVerseNumPress, onVerseComparePress }, ref) => {
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
    />
  );
});

export default BibleReaderView;
