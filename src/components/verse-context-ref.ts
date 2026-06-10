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

export const activeStudyVerseRef = {
  current: null as any,
  bookName: '',
  primaryVersion: 'ara' as 'ara' | 'arc' | 'kjv' | 'dby',
  mode: 'note' as 'note' | 'links',
  editNoteId: null as number | null,
  editNoteText: '' as string,
  listeners: [] as (() => void)[],
  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  },
  set(verse: any, bookName: string, version: 'ara' | 'arc' | 'kjv' | 'dby', mode: 'note' | 'links' = 'note', editNoteId: number | null = null, editNoteText: string = '') {
    this.current = verse;
    this.bookName = bookName;
    this.primaryVersion = version;
    this.mode = mode;
    this.editNoteId = editNoteId;
    this.editNoteText = editNoteText;
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
} = {
  bookId: 1,
  chapter: 1,
  verseNums: [],
  version: 'ara',
  bookDisplayName: '',
  onConfirm: null,
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
