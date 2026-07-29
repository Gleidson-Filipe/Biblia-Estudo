type VerseContextActions = {
  onAnnotation: () => void;
  onLink: () => void;
  onCopy: () => void;
  onFavoriteToggle: () => void;
  onClose: () => void;
  onColorSelect: (color: string) => void;
  onColorClear: () => void;
  onEnterMultiSelect: () => void;
  onConfirmMultiSelect: () => void;
  onSave: () => void;
  onRemove: () => void;
  saveMode: 'save' | 'remove' | 'update';
  activeColor: string | null;
  isFavorite: boolean;
  isMultiSelectMode: boolean;
  multiSelectedCount: number;
  label: string;
};

export const verseContextRef: {
  current: VerseContextActions | null;
  listeners: (() => void)[];
  set(val: VerseContextActions | null): void;
} = {
  current: null,
  listeners: [],
  set(val) {
    this.current = val;
    this.listeners.forEach(l => l());
  }
};

export const selectorNavigationRef: {
  navigate: ((bookId: number, chapter: number, verse?: number) => void) | null;
} = { navigate: null };

export const tabBarVisibilityRef = { hidden: false };

export const skipStudyRestoreRef = { current: false };

export const activeStudyVerseRef = {
  current: null as any,
  bookName: '',
  primaryVersion: 'ara' as 'ara' | 'arc' | 'kjv' | 'dby',
  mode: 'note' as 'note' | 'links',
  highlightNoteId: null as number | null,
  // group mode: when more than one verse is selected
  groupVerses: null as Array<{ book_id: number; chapter: number; verse: number }> | null,
  highlightGroupId: null as number | null,
  highlightGroupNoteIndex: null as number | null,
  listeners: [] as (() => void)[],
  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  },
  set(verse: any, bookName: string, version: 'ara' | 'arc' | 'kjv' | 'dby', mode: 'note' | 'links' = 'note', highlightNoteId: number | null = null, groupVerses: Array<{ book_id: number; chapter: number; verse: number }> | null = null, highlightGroupId: number | null = null, highlightGroupNoteIndex: number | null = null) {
    this.current = verse;
    this.bookName = bookName;
    this.primaryVersion = version;
    this.mode = mode;
    this.highlightNoteId = highlightNoteId;
    this.groupVerses = groupVerses;
    this.highlightGroupId = highlightGroupId;
    this.highlightGroupNoteIndex = highlightGroupNoteIndex;
    this.listeners.forEach(l => l());
  }
};

export const dbModifiedRef = {
  modified: false,
};

export const saveSheetRef: {
  bookId: number;
  chapter: number;
  verseNums: number[];
  version: 'ara' | 'arc' | 'kjv' | 'dby';
  bookDisplayName: string;
  onConfirm: ((color: string | null) => void) | null;
  groupMergeInfo: { groupIds: number[]; existingLabel: string; allVerses: Array<{ book_id: number; chapter: number; verse: number }>; newVerseNums: number[] } | null;
  saveMode: 'save' | 'remove' | 'update';
} = {
  bookId: 1,
  chapter: 1,
  verseNums: [],
  version: 'ara',
  bookDisplayName: '',
  onConfirm: null,
  groupMergeInfo: null,
  saveMode: 'save' as 'save' | 'remove' | 'update',
};

export const readerNavigatingRef = { current: false, chapterChanged: false };

export const globalVersionRef: {
  current: 'ara' | 'arc' | 'kjv' | 'dby';
} = { current: 'ara' };

export function bookName(name_pt: string, name_en: string | undefined): string {
  return (globalVersionRef.current === 'kjv' || globalVersionRef.current === 'dby') && name_en
    ? name_en
    : name_pt;
}

export const pendingNavigationRef: {
  bookId: number | null;
  chapter: number | null;
  verse: number | undefined;
  version: 'ara' | 'arc' | 'kjv' | 'dby' | null;
} = { bookId: null, chapter: null, verse: undefined, version: null };

export const pendingLinkedVerseRef: {
  book_id: number | null;
  chapter: number | null;
  verse: number | null;
  book_abbrev: string | null;
} = { book_id: null, chapter: null, verse: null, book_abbrev: null };

// Callback usado quando nota-global abre a aba Vincular para escolher um versículo
export const linkVerseCallbackRef: {
  current: ((book_id: number, chapter: number, verse: number, book_abbrev: string) => void) | null;
} = { current: null };
