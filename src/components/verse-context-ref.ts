type VerseContextActions = {
  onAnnotation: () => void;
  onLink: () => void;
  onCopy: () => void;
  onCompare: () => void;
  onClose: () => void;
  onColorSelect: (color: string) => void;
  onColorClear: () => void;
  activeColor: string | null;
  label: string;
};

export const verseContextRef: { current: VerseContextActions | null } = { current: null };

export const selectorNavigationRef: {
  navigate: ((bookId: number, chapter: number, verse?: number) => void) | null;
} = { navigate: null };

export const tabBarVisibilityRef = { hidden: false };

export const activeStudyVerseRef = {
  current: null as any,
  bookName: '',
  primaryVersion: 'ara' as 'ara' | 'arc' | 'kjv' | 'dby',
  mode: 'note' as 'note' | 'links',
  listeners: [] as (() => void)[],
  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  },
  set(verse: any, bookName: string, version: 'ara' | 'arc' | 'kjv' | 'dby', mode: 'note' | 'links' = 'note') {
    this.current = verse;
    this.bookName = bookName;
    this.primaryVersion = version;
    this.mode = mode;
    this.listeners.forEach(l => l());
  }
};

export const dbModifiedRef = {
  modified: false,
};
