import { getDB } from './db';
import { translateGloss } from './gloss-pt';

export interface Book {
  id: number;
  abbrev: string;
  name_pt: string;
  name_en: string;
  testament: 'old' | 'new';
}

export interface Verse {
  id: number;
  book_id: number;
  chapter: number;
  verse: number;
  text_ara: string;
  text_arc: string;
  text_kjv: string;
  text_dby: string;
  // Optional metadata from joins
  book_name?: string;
  book_name_en?: string;
  book_abbrev?: string;
  note_content?: string;
  is_favorite?: boolean;
  correlations?: Verse[];
}

export interface StrongEntry {
  id: number;
  number: string;
  lemma: string;
  pronounce: string;
  xlit: string;
  description: string;
}

export interface Note {
  id: number;
  book_id: number;
  chapter: number;
  verse: number;
  slot: number;
  content: string;
  created_at: string;
  updated_at: string;
  book_name?: string;
  book_name_en?: string;
  book_abbrev?: string;
}

export interface Favorite {
  id: number;
  book_id: number;
  chapter: number;
  verse: number;
  created_at: string;
  book_name?: string;
  book_name_en?: string;
  book_abbrev?: string;
  text_ara?: string;
  text_arc?: string;
  text_kjv?: string;
  text_dby?: string;
  save_group_id?: number | null;
}

let _booksCache: Book[] | null = null;
const _chaptersCountCache = new Map<number, number>();

/**
 * Fetch all 66 books from the database.
 */
export function getBooks(): Book[] {
  if (_booksCache) return _booksCache;
  const db = getDB();
  _booksCache = db.getAllSync<Book>('SELECT * FROM books ORDER BY id ASC');
  return _booksCache;
}

/**
 * Fetch a book by ID.
 */
export function getBookById(bookId: number): Book | null {
  const db = getDB();
  return db.getFirstSync<Book>('SELECT * FROM books WHERE id = ?', bookId);
}

/**
 * Get count of chapters in a book.
 */
export function getChaptersCount(bookId: number): number {
  if (_chaptersCountCache.has(bookId)) return _chaptersCountCache.get(bookId)!;
  const db = getDB();
  const row = db.getFirstSync<{ count: number }>(
    'SELECT MAX(chapter) as count FROM verses WHERE book_id = ?',
    bookId
  );
  const count = row?.count ?? 0;
  _chaptersCountCache.set(bookId, count);
  return count;
}

/**
 * Get count of verses in a chapter of a book.
 */
export function getVersesCount(bookId: number, chapter: number): number {
  const db = getDB();
  const row = db.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM verses WHERE book_id = ? AND chapter = ?',
    bookId, chapter
  );
  return row?.count ?? 0;
}

/**
 * Fetch a single verse by reference.
 */
export function getVerse(bookId: number, chapter: number, verseNumber: number): Verse | null {
  const db = getDB();
  return db.getFirstSync<Verse>(
    `SELECT * FROM verses WHERE book_id = ? AND chapter = ? AND verse = ?`,
    bookId, chapter, verseNumber
  );
}

const _versesCache = new Map<string, Verse[]>();

export function invalidateVersesCache() {
  _versesCache.clear();
}

export function isVersesCached(bookId: number, chapter: number): boolean {
  const prefix = `${bookId}_${chapter}_`;
  for (const key of _versesCache.keys()) {
    if (key.startsWith(prefix)) return true;
  }
  return false;
}

export function prefetchAdjacentChapters(bookId: number, chapter: number, totalChapters: number, activeVersions: string[] = ['ara']) {
  const candidates: [number, number][] = [];
  if (chapter > 1) candidates.push([bookId, chapter - 1]);
  if (chapter < totalChapters) candidates.push([bookId, chapter + 1]);
  for (const [bid, chap] of candidates) {
    if (!isVersesCached(bid, chap)) {
      setTimeout(() => getVerses(bid, chap, activeVersions), 0);
    }
  }
}

/**
 * Fetch verses in a specific book chapter with note & favorite statuses, loading only requested translation text.
 */
export function getVerses(bookId: number, chapter: number, activeVersions: string[] = ['ara', 'arc', 'kjv', 'dby']): Verse[] {
  const key = `${bookId}_${chapter}_${[...activeVersions].sort().join('_')}`;
  if (_versesCache.has(key)) return _versesCache.get(key)!;
  const db = getDB();
  
  const allVersions = ['ara', 'arc', 'kjv', 'dby'];
  const columns = ['id', 'book_id', 'chapter', 'verse'];
  for (const v of allVersions) {
    if (activeVersions.includes(v)) {
      columns.push(`text_${v}`);
    } else {
      columns.push(`'' as text_${v}`);
    }
  }

  const verses = db.getAllSync<Verse>(
    `SELECT ${columns.join(', ')} FROM verses WHERE book_id = ? AND chapter = ? ORDER BY verse ASC`,
    bookId, chapter
  );
  if (verses.length === 0) return verses;

  const notes = db.getAllSync<{ verse: number; content: string }>(
    `SELECT verse, content FROM notes WHERE book_id = ? AND chapter = ?`,
    bookId, chapter
  );
  const favs = db.getAllSync<{ verse: number }>(
    `SELECT verse FROM favorites WHERE book_id = ? AND chapter = ?`,
    bookId, chapter
  );

  const noteMap = new Map(notes.map(n => [n.verse, n.content]));
  const favSet = new Set(favs.map(f => f.verse));

  for (const v of verses) {
    v.note_content = noteMap.get(v.verse);
    v.is_favorite = favSet.has(v.verse);
    v.correlations = [];
  }
  if (_versesCache.size >= 30) {
    _versesCache.delete(_versesCache.keys().next().value!);
  }
  _versesCache.set(key, verses);
  return verses;
}

export function getChapterCorrelatedVerses(bookId: number, chapter: number): Set<number> {
  const db = getDB();
  const rows = db.getAllSync<{ verse: number }>(
    `SELECT from_verse as verse FROM correlations WHERE from_book_id = ? AND from_chapter = ?
     UNION
     SELECT to_verse as verse FROM correlations WHERE to_book_id = ? AND to_chapter = ?`,
    bookId, chapter, bookId, chapter
  );
  return new Set(rows.map(r => r.verse));
}

export function getCorrelationsForVerse(bookId: number, chapter: number, verse: number): Verse[] {
  const db = getDB();
  const rows = db.getAllSync<{
    id: number; book_id: number; chapter: number; verse: number;
    text_ara: string; text_arc: string; text_kjv: string; text_dby: string;
    book_name: string; book_abbrev: string;
  }>(
    `SELECT v.*, b.name_pt as book_name, b.name_en as book_name_en, b.abbrev as book_abbrev
     FROM correlations c
     JOIN verses v ON (v.book_id = c.to_book_id AND v.chapter = c.to_chapter AND v.verse = c.to_verse)
     JOIN books b ON b.id = v.book_id
     WHERE c.from_book_id = ? AND c.from_chapter = ? AND c.from_verse = ?
     UNION
     SELECT v.*, b.name_pt as book_name, b.name_en as book_name_en, b.abbrev as book_abbrev
     FROM correlations c
     JOIN verses v ON (v.book_id = c.from_book_id AND v.chapter = c.from_chapter AND v.verse = c.from_verse)
     JOIN books b ON b.id = v.book_id
     WHERE c.to_book_id = ? AND c.to_chapter = ? AND c.to_verse = ?`,
    bookId, chapter, verse, bookId, chapter, verse
  );
  return rows as Verse[];
}

/**
 * Perform reference search (e.g. "Gênesis 1:1", "Mateus 4", "Jo 3:16")
 */
export function searchReference(queryText: string): { book: Book; chapter: number; verse?: number; verses: Verse[] } | null {
  const db = getDB();
  const trimmed = queryText.trim();
  
  // Match "Book Name 12:34" or "Book Name 12"
  const refRegex = /^(.+?)\s+(\d+)(?::(\d+))?$/;
  const match = trimmed.match(refRegex);
  
  if (!match) return null;
  
  const bookQuery = match[1].trim().toLowerCase();
  const chapter = parseInt(match[2], 10);
  const verse = match[3] ? parseInt(match[3], 10) : undefined;
  
  // Find matching book (by abbrev, name_pt, or name_en)
  const books = getBooks();
  const book = books.find(b => 
    b.abbrev.toLowerCase() === bookQuery ||
    b.name_pt.toLowerCase() === bookQuery ||
    b.name_en.toLowerCase() === bookQuery ||
    b.name_pt.toLowerCase().replace(/[^a-z0-9]/g, '') === bookQuery.replace(/[^a-z0-9]/g, '') ||
    b.name_pt.toLowerCase().startsWith(bookQuery) ||
    b.name_en.toLowerCase().startsWith(bookQuery)
  );
  
  if (!book) return null;
  
  // Get verses for that book chapter
  let sql = `
    SELECT v.*, b.name_pt as book_name, b.name_en as book_name_en, b.abbrev as book_abbrev
    FROM verses v
    JOIN books b ON b.id = v.book_id
    WHERE v.book_id = ? AND v.chapter = ?
  `;
  const params: any[] = [book.id, chapter];
  
  if (verse !== undefined) {
    sql += ' AND v.verse = ?';
    params.push(verse);
  }
  
  sql += ' ORDER BY v.verse ASC';
  
  const verses = db.getAllSync<Verse>(sql, ...params);
  if (verses.length === 0) return null;
  
  return { book, chapter, verse, verses };
}

/**
 * Perform FTS5 search on Bible verses with optional testament filtering.
 * - Single word: prefix match (word*)
 * - Multiple words: phrase match first ("word1 word2"), fallback to AND of prefix matches
 */
export async function searchTerms(
  queryText: string,
  testamentFilter?: 'old' | 'new',
  bookId?: number,
  chapter?: number,
  version: 'ara' | 'arc' | 'kjv' | 'dby' = 'ara'
): Promise<Verse[]> {
  const db = getDB();
  const cleanQuery = queryText.trim();
  if (!cleanQuery) return [];

  const conditions: string[] = ['verses_fts MATCH ?'];
  const baseParams: any[] = [];
  if (testamentFilter) { conditions.push('b.testament = ?'); baseParams.push(testamentFilter); }
  if (bookId !== undefined) { conditions.push('v.book_id = ?'); baseParams.push(bookId); }
  if (chapter !== undefined) { conditions.push('v.chapter = ?'); baseParams.push(chapter); }

  const sql = `
    SELECT v.*, b.name_pt as book_name, b.name_en as book_name_en, b.abbrev as book_abbrev
    FROM verses_fts fts
    JOIN verses v ON v.id = fts.rowid
    JOIN books b ON b.id = v.book_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY rank
    LIMIT 500
  `;

  const words = cleanQuery.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return [];

  const col = `text_${version}`;
  const wrapCol = (expr: string) => `${col}: ${expr}`;

  const run = async (expr: string) => {
    try {
      return await db.getAllAsync<Verse>(sql, wrapCol(expr), ...baseParams);
    } catch { return []; }
  };

  if (words.length === 1) return run(`${words[0]}*`);

  const phraseResults = await run(`"${cleanQuery}"`);
  if (phraseResults.length > 0) return phraseResults;

  const andExpr = words.map((w, i) => i === words.length - 1 ? `${w}*` : w).join(' AND ');
  return run(andExpr);
}

/**
 * Notes CRUD
 */
export function addNote(bookId: number, chapter: number, verse: number, content: string): void {
  if (content.trim() === '') return;
  const db = getDB();
  const maxSlot = db.getAllSync<{m: number}>(
    `SELECT COALESCE(MAX(slot), 0) as m FROM notes WHERE book_id = ? AND chapter = ? AND verse = ?`,
    bookId, chapter, verse
  )[0]?.m ?? 0;
  db.runSync(
    `INSERT INTO notes (book_id, chapter, verse, slot, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    bookId, chapter, verse, maxSlot + 1, content
  );
}

export function updateNote(id: number, content: string): void {
  const db = getDB();
  if (content.trim() === '') {
    db.runSync('DELETE FROM notes WHERE id = ?', id);
    return;
  }
  db.runSync('UPDATE notes SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', content, id);
}

export function deleteNote(idOrBookId: number, chapter?: number, verse?: number): void {
  const db = getDB();
  if (chapter !== undefined && verse !== undefined) {
    db.runSync('DELETE FROM notes WHERE book_id = ? AND chapter = ? AND verse = ?', idOrBookId, chapter, verse);
  } else {
    db.runSync('DELETE FROM notes WHERE id = ?', idOrBookId);
  }
}

export function getNotesByVerse(bookId: number, chapter: number, verse: number): Note[] {
  const db = getDB();
  return db.getAllSync<Note>(
    `SELECT * FROM notes WHERE book_id = ? AND chapter = ? AND verse = ? ORDER BY created_at ASC`,
    bookId, chapter, verse
  );
}

// Keep for backwards compat
export function saveNote(bookId: number, chapter: number, verse: number, content: string, slot: number = 1): void {
  const db = getDB();
  if (content.trim() === '') {
    db.runSync('DELETE FROM notes WHERE book_id = ? AND chapter = ? AND verse = ? AND slot = ?', bookId, chapter, verse, slot);
    return;
  }
  db.runSync('DELETE FROM notes WHERE book_id = ? AND chapter = ? AND verse = ? AND slot = ?', bookId, chapter, verse, slot);
  db.runSync(
    `INSERT INTO notes (book_id, chapter, verse, slot, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    bookId, chapter, verse, slot, content
  );
}

export function getAllNotes(): Note[] {
  const db = getDB();
  return db.getAllSync<Note>(
    `SELECT n.*, b.name_pt as book_name, b.name_en as book_name_en, b.abbrev as book_abbrev
     FROM notes n
     JOIN books b ON b.id = n.book_id
     ORDER BY n.updated_at DESC`
  );
}

/**
 * Favorites CRUD: Toggle favorite status. Returns true if added, false if removed.
 */
export function toggleFavorite(bookId: number, chapter: number, verse: number): boolean {
  const db = getDB();
  
  // Check if exists
  const existing = db.getFirstSync<{ id: number }>(
    'SELECT id FROM favorites WHERE book_id = ? AND chapter = ? AND verse = ?',
    bookId,
    chapter,
    verse
  );
  
  if (existing) {
    db.runSync(
      'DELETE FROM favorites WHERE book_id = ? AND chapter = ? AND verse = ?',
      bookId,
      chapter,
      verse
    );
    return false;
  } else {
    db.runSync(
      'INSERT INTO favorites (book_id, chapter, verse) VALUES (?, ?, ?)',
      bookId,
      chapter,
      verse
    );
    return true;
  }
}

/**
 * Favorites CRUD: Get all favorites.
 */
export function getAllFavorites(): Favorite[] {
  const db = getDB();
  return db.getAllSync<Favorite>(
    `SELECT f.*, b.name_pt as book_name, b.name_en as book_name_en, b.abbrev as book_abbrev, v.text_ara, v.text_arc, v.text_kjv, v.text_dby
     FROM favorites f
     JOIN books b ON b.id = f.book_id
     JOIN verses v ON (v.book_id = f.book_id AND v.chapter = f.chapter AND v.verse = f.verse)
     ORDER BY f.created_at DESC`
  );
}

// Retorna favoritos com save_group_id (só grupos de salvamento, não grupos de anotação)
export function getAllFavoritesWithGroups(): Favorite[] {
  const db = getDB();
  return db.getAllSync<Favorite>(
    `SELECT f.*, b.name_pt as book_name, b.name_en as book_name_en, b.abbrev as book_abbrev,
            v.text_ara, v.text_arc, v.text_kjv, v.text_dby,
            ng_save.id as save_group_id
     FROM favorites f
     JOIN books b ON b.id = f.book_id
     JOIN verses v ON (v.book_id = f.book_id AND v.chapter = f.chapter AND v.verse = f.verse)
     LEFT JOIN note_group_verses ngv ON (ngv.book_id = f.book_id AND ngv.chapter = f.chapter AND ngv.verse = f.verse)
     LEFT JOIN note_groups ng_save ON (ng_save.id = ngv.group_id AND (ng_save.content IS NULL OR ng_save.content = '' OR ng_save.content = '[]'))
     ORDER BY f.created_at DESC`
  );
}

// Retorna todos os grupos de anotação (com conteúdo) para a aba de Meditações
export function getAllAnnotationGroups(): NoteGroup[] {
  const db = getDB();
  const groups = db.getAllSync<NoteGroup>(
    `SELECT ng.* FROM note_groups ng
     WHERE ng.content IS NOT NULL AND ng.content != '' AND ng.content != '[]'
     ORDER BY ng.updated_at DESC`
  );
  for (const g of groups) {
    g.verses = db.getAllSync<{ book_id: number; chapter: number; verse: number; book_name?: string; book_name_en?: string }>(
      `SELECT ngv.book_id, ngv.chapter, ngv.verse, b.name_pt as book_name, b.name_en as book_name_en
       FROM note_group_verses ngv
       JOIN books b ON b.id = ngv.book_id
       WHERE ngv.group_id = ? ORDER BY ngv.book_id, ngv.chapter, ngv.verse`,
      g.id
    ) as any;
  }
  return groups;
}

/**
 * Correlations CRUD: Link two verses together.
 */
export function addCorrelation(
  fromB: number, fromC: number, fromV: number,
  toB: number, toC: number, toV: number
): void {
  const db = getDB();
  
  // Prevent self-linking
  if (fromB === toB && fromC === toC && fromV === toV) return;
  
  // Canonical order (always insert smaller book/chap/verse first to prevent duplicates in opposite order)
  let fBook = fromB, fChap = fromC, fVerse = fromV;
  let tBook = toB, tChap = toC, tVerse = toV;
  
  const fromVal = fromB * 1000000 + fromC * 1000 + fromV;
  const toVal = toB * 1000000 + toC * 1000 + toV;
  
  if (fromVal > toVal) {
    fBook = toB; fChap = toC; fVerse = toV;
    tBook = fromB; tChap = fromC; tVerse = fromV;
  }
  
  db.runSync(
    `INSERT OR IGNORE INTO correlations (from_book_id, from_chapter, from_verse, to_book_id, to_chapter, to_verse)
     VALUES (?, ?, ?, ?, ?, ?)`,
    fBook, fChap, fVerse, tBook, tChap, tVerse
  );
}

/**
 * Correlations CRUD: Unlink two verses.
 */
export function removeCorrelation(
  fromB: number, fromC: number, fromV: number,
  toB: number, toC: number, toV: number
): void {
  const db = getDB();
  
  // Canonical order matching
  let fBook = fromB, fChap = fromC, fVerse = fromV;
  let tBook = toB, tChap = toC, tVerse = toV;
  
  const fromVal = fromB * 1000000 + fromC * 1000 + fromV;
  const toVal = toB * 1000000 + toC * 1000 + toV;
  
  if (fromVal > toVal) {
    fBook = toB; fChap = toC; fVerse = toV;
    tBook = fromB; tChap = fromC; tVerse = fromV;
  }
  
  db.runSync(
    `DELETE FROM correlations 
     WHERE from_book_id = ? AND from_chapter = ? AND from_verse = ?
       AND to_book_id = ? AND to_chapter = ? AND to_verse = ?`,
    fBook, fChap, fVerse, tBook, tChap, tVerse
  );
}

/**
 * Correlations CRUD: Get all correlated verses for a given verse.
 */
export function getCorrelations(bookId: number, chapter: number, verse: number): Verse[] {
  const db = getDB();
  
  return db.getAllSync<Verse>(
    `SELECT v.*, b.name_pt as book_name, b.name_en as book_name_en, b.abbrev as book_abbrev
     FROM correlations c
     JOIN verses v ON (v.book_id = c.to_book_id AND v.chapter = c.to_chapter AND v.verse = c.to_verse)
     JOIN books b ON b.id = v.book_id
     WHERE c.from_book_id = ? AND c.from_chapter = ? AND c.from_verse = ?
     
     UNION
     
     SELECT v.*, b.name_pt as book_name, b.name_en as book_name_en, b.abbrev as book_abbrev
     FROM correlations c
     JOIN verses v ON (v.book_id = c.from_book_id AND v.chapter = c.from_chapter AND v.verse = c.from_verse)
     JOIN books b ON b.id = v.book_id
     WHERE c.to_book_id = ? AND c.to_chapter = ? AND c.to_verse = ?`,
    bookId, chapter, verse,
    bookId, chapter, verse
  );
}

// ─── Note Groups ────────────────────────────────────────────────────────────

export interface NoteGroup {
  id: number;
  content: string;
  created_at: string;
  updated_at: string;
  verses?: Array<{ book_id: number; chapter: number; verse: number; book_name?: string; book_name_en?: string }>;
}

export function addNoteGroup(
  content: string,
  verses: Array<{ book_id: number; chapter: number; verse: number }>
): number {
  const db = getDB();
  db.runSync(
    `INSERT INTO note_groups (content, created_at, updated_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    content
  );
  const id = (db.getFirstSync<{ id: number }>(`SELECT last_insert_rowid() as id`) as any).id as number;
  for (const v of verses) {
    db.runSync(
      `INSERT OR IGNORE INTO note_group_verses (group_id, book_id, chapter, verse) VALUES (?, ?, ?, ?)`,
      id, v.book_id, v.chapter, v.verse
    );
  }
  return id;
}

export function updateNoteGroup(id: number, content: string): void {
  const db = getDB();
  if (content.trim() === '') {
    deleteNoteGroup(id);
    return;
  }
  db.runSync(`UPDATE note_groups SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, content, id);
}

export function parseGroupNotes(content: string): string[] {
  if (!content?.trim()) return [];
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed.map(s => String(s)).filter(s => s.trim());
  } catch {}
  return [content];
}

export function getGroupIdsForVerses(verses: Array<{ book_id: number; chapter: number; verse: number }>): number[] {
  const db = getDB();
  const ids = new Set<number>();
  for (const v of verses) {
    const rows = db.getAllSync<{ group_id: number }>(
      `SELECT group_id FROM note_group_verses WHERE book_id = ? AND chapter = ? AND verse = ?`,
      v.book_id, v.chapter, v.verse
    );
    for (const r of rows) ids.add(r.group_id);
  }
  return Array.from(ids);
}

export function getSaveGroupIdsForVerses(verses: { book_id: number; chapter: number; verse: number }[]): number[] {
  const db = getDB();
  const ids = new Set<number>();
  for (const v of verses) {
    const rows = db.getAllSync<{ group_id: number }>(
      `SELECT ng.id as group_id FROM note_groups ng
       JOIN note_group_verses ngv ON ng.id = ngv.group_id
       WHERE ngv.book_id = ? AND ngv.chapter = ? AND ngv.verse = ?
         AND (ng.content IS NULL OR ng.content = '' OR ng.content = '[]')`,
      v.book_id, v.chapter, v.verse
    );
    for (const r of rows) ids.add(r.group_id);
  }
  return Array.from(ids);
}

export function mergeNoteGroups(
  groupIds: number[],
  newVerses: Array<{ book_id: number; chapter: number; verse: number }>,
  content: string
): number {
  const db = getDB();
  
  // Query all groups to be merged, ordered by creation date (oldest to newest)
  const groupsToMerge = db.getAllSync<{ id: number; content: string; created_at: string }>(
    `SELECT id, content, created_at FROM note_groups WHERE id IN (${groupIds.map(() => '?').join(',')}) ORDER BY created_at ASC`,
    ...groupIds
  );

  if (groupsToMerge.length === 0) return groupIds[0] || 0;

  const keepId = groupsToMerge[0].id;
  const deleteIds = groupsToMerge.slice(1).map(g => g.id);

  // Combine content from all groups in order of creation, separated by a visual divider
  const allContents = groupsToMerge.flatMap(g => parseGroupNotes(g.content));
  const mergedNoteText = allContents.filter(n => n.trim()).join('\n\n───────────────────\n\n');
  const mergedContent = mergedNoteText ? JSON.stringify([mergedNoteText]) : '';

  // collect all existing verses from all groups
  const existingVerses = db.getAllSync<{ book_id: number; chapter: number; verse: number }>(
    `SELECT book_id, chapter, verse FROM note_group_verses WHERE group_id IN (${groupIds.map(() => '?').join(',')})`,
    ...groupIds
  );

  // delete other groups
  for (const gid of deleteIds) {
    db.runSync(`DELETE FROM note_group_verses WHERE group_id = ?`, gid);
    db.runSync(`DELETE FROM note_groups WHERE id = ?`, gid);
  }

  // update kept group with merged content
  db.runSync(`UPDATE note_groups SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, mergedContent, keepId);

  // remove all verses from kept group and re-insert union
  db.runSync(`DELETE FROM note_group_verses WHERE group_id = ?`, keepId);
  const allVerses = new Map<string, { book_id: number; chapter: number; verse: number }>();
  for (const v of [...existingVerses, ...newVerses]) {
    allVerses.set(`${v.book_id}-${v.chapter}-${v.verse}`, v);
  }
  for (const v of allVerses.values()) {
    db.runSync(
      `INSERT OR IGNORE INTO note_group_verses (group_id, book_id, chapter, verse) VALUES (?, ?, ?, ?)`,
      keepId, v.book_id, v.chapter, v.verse
    );
  }
  return keepId;
}

export function deleteNoteGroup(id: number): void {
  const db = getDB();
  db.runSync(`DELETE FROM note_group_verses WHERE group_id = ?`, id);
  db.runSync(`DELETE FROM note_groups WHERE id = ?`, id);
}

export function getNoteGroupsByVerse(bookId: number, chapter: number, verse: number): NoteGroup[] {
  const db = getDB();
  const groups = db.getAllSync<NoteGroup>(
    `SELECT ng.* FROM note_groups ng
     JOIN note_group_verses ngv ON ngv.group_id = ng.id
     WHERE ngv.book_id = ? AND ngv.chapter = ? AND ngv.verse = ?
     ORDER BY ng.created_at ASC`,
    bookId, chapter, verse
  );
  for (const g of groups) {
    g.verses = db.getAllSync<{ book_id: number; chapter: number; verse: number }>(
      `SELECT book_id, chapter, verse FROM note_group_verses WHERE group_id = ? ORDER BY book_id, chapter, verse`,
      g.id
    );
  }
  return groups;
}

export function countNoteGroupsByChapter(bookId: number, chapter: number): number {
  const db = getDB();
  const row = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(DISTINCT ng.id) as count FROM note_groups ng
     JOIN note_group_verses ngv ON ngv.group_id = ng.id
     WHERE ngv.book_id = ? AND ngv.chapter = ?`,
    bookId, chapter
  );
  return row?.count ?? 0;
}

export function getNoteGroupsForChapter(bookId: number, chapter: number): Map<number, NoteGroup[]> {
  const db = getDB();
  const rows = db.getAllSync<{ verse: number; group_id: number; content: string; created_at: string; updated_at: string }>(
    `SELECT ngv.verse, ng.id as group_id, ng.content, ng.created_at, ng.updated_at
     FROM note_group_verses ngv
     JOIN note_groups ng ON ng.id = ngv.group_id
     WHERE ngv.book_id = ? AND ngv.chapter = ?`,
    bookId, chapter
  );
  const map = new Map<number, NoteGroup[]>();
  for (const r of rows) {
    if (!map.has(r.verse)) map.set(r.verse, []);
    map.get(r.verse)!.push({ id: r.group_id, content: r.content, created_at: r.created_at, updated_at: r.updated_at });
  }
  return map;
}

export function getSaveGroupVerseNumsForChapter(bookId: number, chapter: number): Set<number> {
  const db = getDB();
  const rows = db.getAllSync<{ verse: number }>(
    `SELECT DISTINCT ngv.verse
     FROM note_group_verses ngv
     JOIN note_groups ng ON ng.id = ngv.group_id
     WHERE ngv.book_id = ? AND ngv.chapter = ?
       AND (ng.content IS NULL OR ng.content = '' OR ng.content = '[]')`,
    bookId, chapter
  );
  return new Set(rows.map(r => r.verse));
}

// ─── Correlation Groups ──────────────────────────────────────────────────────

export interface CorrelationGroup {
  id: number;
  to_book_id: number;
  to_chapter: number;
  to_verse: number;
  created_at: string;
  sourceVerses?: Array<{ book_id: number; chapter: number; verse: number }>;
  targetVerse?: { book_id: number; chapter: number; verse: number; book_name?: string; book_abbrev?: string; text_ara?: string; text_arc?: string; text_kjv?: string; text_dby?: string };
}

export function addCorrelationGroup(
  sourceVerses: Array<{ book_id: number; chapter: number; verse: number }>,
  toBookId: number, toChapter: number, toVerse: number
): number {
  const db = getDB();
  db.runSync(
    `INSERT INTO correlation_groups (to_book_id, to_chapter, to_verse, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
    toBookId, toChapter, toVerse
  );
  const id = (db.getFirstSync<{ id: number }>(`SELECT last_insert_rowid() as id`) as any).id as number;
  for (const v of sourceVerses) {
    db.runSync(
      `INSERT OR IGNORE INTO correlation_group_verses (group_id, book_id, chapter, verse) VALUES (?, ?, ?, ?)`,
      id, v.book_id, v.chapter, v.verse
    );
  }
  return id;
}

export function deleteCorrelationGroup(id: number): void {
  const db = getDB();
  db.runSync(`DELETE FROM correlation_group_verses WHERE group_id = ?`, id);
  db.runSync(`DELETE FROM correlation_groups WHERE id = ?`, id);
}

export function getCorrelationGroupsByVerse(bookId: number, chapter: number, verse: number): CorrelationGroup[] {
  const db = getDB();
  const groups = db.getAllSync<CorrelationGroup>(
    `SELECT cg.* FROM correlation_groups cg
     JOIN correlation_group_verses cgv ON cgv.group_id = cg.id
     WHERE cgv.book_id = ? AND cgv.chapter = ? AND cgv.verse = ?
     ORDER BY cg.created_at ASC`,
    bookId, chapter, verse
  );
  for (const g of groups) {
    g.sourceVerses = db.getAllSync<{ book_id: number; chapter: number; verse: number }>(
      `SELECT book_id, chapter, verse FROM correlation_group_verses WHERE group_id = ? ORDER BY book_id, chapter, verse`,
      g.id
    );
    g.targetVerse = db.getFirstSync<any>(
      `SELECT v.book_id, v.chapter, v.verse, b.name_pt as book_name, b.abbrev as book_abbrev,
              v.text_ara, v.text_arc, v.text_kjv, v.text_dby
       FROM verses v JOIN books b ON b.id = v.book_id
       WHERE v.book_id = ? AND v.chapter = ? AND v.verse = ?`,
      g.to_book_id, g.to_chapter, g.to_verse
    ) ?? undefined;
  }
  return groups;
}

export function getCorrelationGroupsForChapter(bookId: number, chapter: number): Map<number, number[]> {
  const db = getDB();
  const rows = db.getAllSync<{ verse: number; group_id: number }>(
    `SELECT cgv.verse, cg.id as group_id
     FROM correlation_group_verses cgv
     JOIN correlation_groups cg ON cg.id = cgv.group_id
     WHERE cgv.book_id = ? AND cgv.chapter = ?`,
    bookId, chapter
  );
  const map = new Map<number, number[]>();
  for (const r of rows) {
    if (!map.has(r.verse)) map.set(r.verse, []);
    map.get(r.verse)!.push(r.group_id);
  }
  return map;
}

// ─── Block Links ─────────────────────────────────────────────────────────────

export interface BlockLink {
  id: number;
  src_book_id: number;
  src_chapter: number;
  src_verses: number[];   // parsed JSON array
  tgt_book_id: number;
  tgt_chapter: number;
  tgt_verses: number[];   // parsed JSON array
  created_at: string;
  // enriched
  tgt_book_name?: string;
  tgt_book_abbrev?: string;
  src_book_name?: string;
  src_book_abbrev?: string;
  tgt_verse_texts?: Record<number, string>; // verse -> text
}

export function addBlockLink(
  srcBookId: number, srcChapter: number, srcVerses: number[],
  tgtBookId: number, tgtChapter: number, tgtVerses: number[]
): number {
  const db = getDB();
  db.runSync(
    `INSERT INTO block_links (src_book_id, src_chapter, src_verses, tgt_book_id, tgt_chapter, tgt_verses, created_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    srcBookId, srcChapter, JSON.stringify(srcVerses),
    tgtBookId, tgtChapter, JSON.stringify(tgtVerses)
  );
  const id = (db.getAllSync<{id: number}>(`SELECT last_insert_rowid() as id`)[0]?.id) ?? 0;
  for (const v of srcVerses) {
    db.runSync(`INSERT OR IGNORE INTO block_link_src_verses (link_id, book_id, chapter, verse) VALUES (?, ?, ?, ?)`, id, srcBookId, srcChapter, v);
  }
  for (const v of tgtVerses) {
    db.runSync(`INSERT OR IGNORE INTO block_link_tgt_verses (link_id, book_id, chapter, verse) VALUES (?, ?, ?, ?)`, id, tgtBookId, tgtChapter, v);
  }
  return id;
}

export function removeBlockLink(id: number): void {
  const db = getDB();
  db.runSync(`DELETE FROM block_link_src_verses WHERE link_id = ?`, id);
  db.runSync(`DELETE FROM block_link_tgt_verses WHERE link_id = ?`, id);
  db.runSync(`DELETE FROM block_links WHERE id = ?`, id);
}

function parseBlockLink(row: any): BlockLink {
  return {
    ...row,
    src_verses: JSON.parse(row.src_verses ?? '[]'),
    tgt_verses: JSON.parse(row.tgt_verses ?? '[]'),
  };
}

/** Outgoing links: links where this verse (or its group) is the source */
export function getBlockLinksFromVerse(bookId: number, chapter: number, verse: number): BlockLink[] {
  const db = getDB();
  const rows = db.getAllSync<any>(
    `SELECT bl.*, b.name_pt as tgt_book_name, b.abbrev as tgt_book_abbrev
     FROM block_link_src_verses sv
     JOIN block_links bl ON bl.id = sv.link_id
     LEFT JOIN books b ON b.id = bl.tgt_book_id
     WHERE sv.book_id = ? AND sv.chapter = ? AND sv.verse = ?
     ORDER BY bl.created_at DESC`,
    bookId, chapter, verse
  );
  return rows.map(parseBlockLink);
}

/** Outgoing links for a source block (all verses in src must match exactly) */
export function getBlockLinksFromBlock(srcVerses: Array<{book_id: number; chapter: number; verse: number}>): BlockLink[] {
  if (srcVerses.length === 0) return [];
  const { book_id, chapter } = srcVerses[0];
  const db = getDB();
  // get all links that have at least one of these src verses
  const rows = db.getAllSync<any>(
    `SELECT DISTINCT bl.*, b.name_pt as tgt_book_name, b.abbrev as tgt_book_abbrev
     FROM block_link_src_verses sv
     JOIN block_links bl ON bl.id = sv.link_id
     LEFT JOIN books b ON b.id = bl.tgt_book_id
     WHERE sv.book_id = ? AND sv.chapter = ? AND sv.verse IN (${srcVerses.map(() => '?').join(',')})
     ORDER BY bl.created_at DESC`,
    book_id, chapter, ...srcVerses.map(v => v.verse)
  );
  // filter to exact match of src_verses
  const verseSet = new Set(srcVerses.map(v => v.verse));
  return rows.map(parseBlockLink).filter(bl =>
    bl.src_verses.length === verseSet.size && bl.src_verses.every((v: number) => verseSet.has(v))
  );
}

/** Incoming links: links where this verse is in the target block */
export function getBlockLinksToVerse(bookId: number, chapter: number, verse: number): BlockLink[] {
  const db = getDB();
  const rows = db.getAllSync<any>(
    `SELECT bl.*, b.name_pt as src_book_name, b.abbrev as src_book_abbrev
     FROM block_link_tgt_verses tv
     JOIN block_links bl ON bl.id = tv.link_id
     LEFT JOIN books b ON b.id = bl.src_book_id
     WHERE tv.book_id = ? AND tv.chapter = ? AND tv.verse = ?
     ORDER BY bl.created_at DESC`,
    bookId, chapter, verse
  );
  return rows.map(parseBlockLink);
}

/** All source verse numbers in a chapter that have outgoing block links (individual only: src_verses with only 1 verse) */
export function getBlockLinkSrcVerseNumsForChapter(bookId: number, chapter: number): Set<number> {
  const db = getDB();
  const rows = db.getAllSync<{verse: number}>(
    `SELECT DISTINCT blsv.verse FROM block_link_src_verses blsv
     JOIN block_links bl ON bl.id = blsv.link_id
     WHERE blsv.book_id = ? AND blsv.chapter = ?
     AND (SELECT COUNT(*) FROM block_link_src_verses WHERE link_id = bl.id) = 1`,
    bookId, chapter
  );
  return new Set(rows.map(r => r.verse));
}

/** Source verse numbers in a chapter that have outgoing GROUP block links (src_verses with 2+ verses) */
export function getBlockLinkGroupSrcVerseNumsForChapter(bookId: number, chapter: number): Set<number> {
  const db = getDB();
  const rows = db.getAllSync<{verse: number}>(
    `SELECT DISTINCT blsv.verse FROM block_link_src_verses blsv
     JOIN block_links bl ON bl.id = blsv.link_id
     WHERE blsv.book_id = ? AND blsv.chapter = ?
     AND (SELECT COUNT(*) FROM block_link_src_verses WHERE link_id = bl.id) > 1`,
    bookId, chapter
  );
  return new Set(rows.map(r => r.verse));
}

/** All verse numbers in a chapter that are referenced as targets by block links */
export function getBlockLinkTgtVerseNumsForChapter(bookId: number, chapter: number): Set<number> {
  const db = getDB();
  const rows = db.getAllSync<{verse: number}>(
    `SELECT DISTINCT verse FROM block_link_tgt_verses WHERE book_id = ? AND chapter = ?`,
    bookId, chapter
  );
  return new Set(rows.map(r => r.verse));
}

export type TgtVerseType = 'individual' | 'group' | 'both';

/** Para cada versículo de destino no capítulo, retorna o tipo de vínculo:
 *  'individual' = só links com src=1 e tgt=1
 *  'group'      = só links com src>1 ou tgt>1
 *  'both'       = os dois tipos */
export function getBlockLinkTgtVerseTypesForChapter(bookId: number, chapter: number): Map<number, TgtVerseType> {
  const db = getDB();
  const rows = db.getAllSync<{ verse: number; ind: number; grp: number }>(
    `SELECT tv.verse,
       SUM(CASE WHEN src_c.cnt = 1 AND tgt_c.cnt = 1 THEN 1 ELSE 0 END) AS ind,
       SUM(CASE WHEN src_c.cnt > 1 OR  tgt_c.cnt > 1 THEN 1 ELSE 0 END) AS grp
     FROM block_link_tgt_verses tv
     JOIN (SELECT link_id, COUNT(*) AS cnt FROM block_link_src_verses GROUP BY link_id) src_c ON src_c.link_id = tv.link_id
     JOIN (SELECT link_id, COUNT(*) AS cnt FROM block_link_tgt_verses  GROUP BY link_id) tgt_c ON tgt_c.link_id = tv.link_id
     WHERE tv.book_id = ? AND tv.chapter = ?
     GROUP BY tv.verse`,
    bookId, chapter
  );
  const result = new Map<number, TgtVerseType>();
  rows.forEach(r => {
    const hasInd = r.ind > 0;
    const hasGrp = r.grp > 0;
    result.set(r.verse, hasInd && hasGrp ? 'both' : hasGrp ? 'group' : 'individual');
  });
  return result;
}

/** Count of outgoing block links for a source block (for limit check) */
export function countBlockLinksFromBlock(srcVerses: Array<{book_id: number; chapter: number; verse: number}>): number {
  return getBlockLinksFromBlock(srcVerses).length;
}

/**
 * Lexicon CRUD: Search Strong's Greek/Hebrew dictionary.
 * Supports exact strong's number query (e.g. "H1", "G12") or FTS term search (e.g. "father").
 */
export async function searchStrongs(queryText: string): Promise<StrongEntry[]> {
  const db = getDB();
  const cleaned = queryText.trim();
  if (!cleaned) return [];

  // Number query: H430, H0430, h430g, G1234 etc
  const strongsNumberRegex = /^([HG])0*(\d+)/i;
  const numMatch = cleaned.match(strongsNumberRegex);
  if (numMatch) {
    const prefix = numMatch[1].toUpperCase();
    const num = parseInt(numMatch[2], 10).toString();
    const normalized = `${prefix}${num}`;
    const results = await db.getAllAsync<StrongEntry>(
      `SELECT * FROM strongs WHERE number = ?`,
      normalized
    );
    if (results.length > 0) return results;
  }

  const lower = cleaned.toLowerCase();

  // Priority 1a: interlinear gloss exact match, ordered by usage frequency
  const exactGlossResults = await db.getAllAsync<StrongEntry>(
    `SELECT s.*, count(i.id) as usage_count
     FROM strongs s
     JOIN interlinear i ON substr(i.strong_number,1,1) || printf('%d', cast(substr(i.strong_number,2) AS INTEGER)) = s.number
     WHERE lower(trim(i.gloss)) = ?
     GROUP BY s.id
     ORDER BY usage_count DESC
     LIMIT 20`,
    lower
  );

  const seenIds = new Set<number>(exactGlossResults.map(r => r.id));

  // Priority 1b: xlit/pronounce exact match
  const xlitExact = (await db.getAllAsync<StrongEntry>(
    `SELECT * FROM strongs WHERE lower(xlit) = ? OR lower(pronounce) = ? ORDER BY number ASC LIMIT 10`,
    lower, lower
  )).filter(r => !seenIds.has(r.id));
  xlitExact.forEach(r => seenIds.add(r.id));

  // Priority 2: description contains the term
  const likePattern = `%${cleaned}%`;
  const descResults = (await db.getAllAsync<StrongEntry>(
    `SELECT * FROM strongs WHERE description LIKE ? OR xlit LIKE ? ORDER BY number ASC LIMIT 50`,
    likePattern, likePattern
  )).filter(r => !seenIds.has(r.id));

  return [...exactGlossResults, ...xlitExact, ...descResults].slice(0, 50);
}

export interface InterlinearWord {
  word_pos: number;
  orig_word: string;
  translit: string;
  gloss: string;
  gloss_pt: string;
  strong_number: string | null;
  strong_desc: string | null;
  language: 'hebrew' | 'aramaic' | 'greek';
}

const PARTICLE_PT: Record<string, string> = {
  'H0853': '[marcador de objeto direto]',
  'H0854': 'com',
  'H0834': 'que',
  'H0413': 'para',
  'H0430': 'Deus',
  'H3068': 'SENHOR',
  'H3588': 'porque',
  'H0859': 'tu',
  'H1931': 'ele',
  'H3605': 'todo',
  'H0369': 'não há',
  'H3651': 'assim',
  'H2063': 'esta',
  'H2088': 'este',
  'H1992': 'eles',
  'G3588': 'o/a',
  'G2532': 'e',
  'G1161': 'mas/e',
  'G3756': 'não',
  'G3739': 'que/o qual',
  'G1722': 'em',
  'G1519': 'para',
  'G1537': 'de/fora de',
  'G4314': 'para/a',
  'G2596': 'segundo/contra',
  'G3326': 'com/depois',
  'G1223': 'por causa de',
  'G0846': 'ele/ela',
  'G3778': 'este/esta',
  'G1473': 'eu',
  'G4771': 'tu',
  'G2316': 'Deus',
  'G2962': 'Senhor',
};

function cleanTranslit(t: string): string {
  // Remove dots used as syllable separators, slashes from prefixes, brackets
  return t.replace(/\./g, '').replace(/\//g, ' ').replace(/[<>[\]{}()]/g, '').replace(/\s+/g, ' ').trim();
}

function cleanGloss(g: string): string {
  return g
    .replace(/<([^>]+)>/g, '$1')      // <obj.> -> obj.  (keep content, remove angle brackets)
    .replace(/\//g, ' ')              // slash prefixes -> space
    .replace(/[[\]{}]/g, '')          // brackets
    .replace(/[֐-׿؀-ۿͰ-Ͽﬀ-﷿]/g, '') // remove Hebrew/Greek/Arabic scripts
    .replace(/\s+/g, ' ')
    .trim();
}

// Aramaic sections: Daniel 2:4b-7:28, Ezra 4:8-6:18, 7:12-26, Jer 10:11, Gen 31:47 (2 words)
const ARAMAIC_RANGES: Array<{ book_id: number; from_chapter: number; from_verse: number; to_chapter: number; to_verse: number }> = [
  { book_id: 27, from_chapter: 2, from_verse: 4, to_chapter: 7, to_verse: 28 },   // Daniel
  { book_id: 15, from_chapter: 4, from_verse: 8, to_chapter: 6, to_verse: 18 },   // Ezra
  { book_id: 15, from_chapter: 7, from_verse: 12, to_chapter: 7, to_verse: 26 },  // Ezra
  { book_id: 24, from_chapter: 10, from_verse: 11, to_chapter: 10, to_verse: 11 }, // Jeremias
  { book_id: 1, from_chapter: 31, from_verse: 47, to_chapter: 31, to_verse: 47 }, // Gênesis
];

function isAramaic(book_id: number, chapter: number, verse: number): boolean {
  return ARAMAIC_RANGES.some(r =>
    r.book_id === book_id &&
    (chapter > r.from_chapter || (chapter === r.from_chapter && verse >= r.from_verse)) &&
    (chapter < r.to_chapter || (chapter === r.to_chapter && verse <= r.to_verse))
  );
}

export function getInterlinearVerse(bookId: number, chapter: number, verse: number): InterlinearWord[] {
  const db = getDB();
  const rows = db.getAllSync<{ word_pos: number; orig_word: string; translit: string; gloss: string; strong_number: string | null; strong_desc: string | null }>(
    `SELECT i.word_pos, i.orig_word, i.translit, i.gloss, i.strong_number, s.description as strong_desc
     FROM interlinear i
     LEFT JOIN strongs s ON s.number = i.strong_number
     WHERE i.book_id = ? AND i.chapter = ? AND i.verse = ?
     ORDER BY i.word_pos`,
    bookId, chapter, verse
  );
  const aramaic = isAramaic(bookId, chapter, verse);
  return rows.map(r => ({
    ...r,
    translit: cleanTranslit(r.translit),
    gloss: cleanGloss(r.gloss),
    gloss_pt: translateGloss(cleanGloss(r.gloss)) || PARTICLE_PT[r.strong_number ?? ''] || PARTICLE_PT[r.strong_number?.replace(/^([HG])0+/, '$1') ?? ''] || '',
    language: bookId >= 40 ? 'greek' : aramaic ? 'aramaic' : 'hebrew',
  }));
}

