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
  book_abbrev?: string;
}

export interface Favorite {
  id: number;
  book_id: number;
  chapter: number;
  verse: number;
  created_at: string;
  book_name?: string;
  book_abbrev?: string;
  text_ara?: string;
  text_arc?: string;
  text_kjv?: string;
  text_dby?: string;
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
  if (_versesCache.size >= 15) {
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
    `SELECT v.*, b.name_pt as book_name, b.abbrev as book_abbrev
     FROM correlations c
     JOIN verses v ON (v.book_id = c.to_book_id AND v.chapter = c.to_chapter AND v.verse = c.to_verse)
     JOIN books b ON b.id = v.book_id
     WHERE c.from_book_id = ? AND c.from_chapter = ? AND c.from_verse = ?
     UNION
     SELECT v.*, b.name_pt as book_name, b.abbrev as book_abbrev
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
    SELECT v.*, b.name_pt as book_name, b.abbrev as book_abbrev
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
 */
export function searchTerms(queryText: string, testamentFilter?: 'old' | 'new'): Verse[] {
  const db = getDB();
  const cleanQuery = queryText.trim();
  if (!cleanQuery) return [];
  
  // Build standard FTS match expression: split by spaces and append asterisk for prefix matching, join with AND
  const words = cleanQuery
    .split(/\s+/)
    .map(w => w.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(w => w.length > 0)
    .map(w => `${w}*`);
    
  if (words.length === 0) return [];
  
  const ftsMatchExpression = words.join(' AND ');
  
  let sql = `
    SELECT v.*, b.name_pt as book_name, b.abbrev as book_abbrev
    FROM verses_fts fts
    JOIN verses v ON v.id = fts.rowid
    JOIN books b ON b.id = v.book_id
    WHERE verses_fts MATCH ?
  `;
  const params: any[] = [ftsMatchExpression];
  
  if (testamentFilter) {
    sql += ' AND b.testament = ?';
    params.push(testamentFilter);
  }
  
  sql += ' ORDER BY b.id ASC, v.chapter ASC, v.verse ASC LIMIT 100';
  
  return db.getAllSync<Verse>(sql, ...params);
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
    `SELECT n.*, b.name_pt as book_name, b.abbrev as book_abbrev
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
    `SELECT f.*, b.name_pt as book_name, b.abbrev as book_abbrev, v.text_ara, v.text_arc, v.text_kjv, v.text_dby
     FROM favorites f
     JOIN books b ON b.id = f.book_id
     JOIN verses v ON (v.book_id = f.book_id AND v.chapter = f.chapter AND v.verse = f.verse)
     ORDER BY f.created_at DESC`
  );
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
    `SELECT v.*, b.name_pt as book_name, b.abbrev as book_abbrev
     FROM correlations c
     JOIN verses v ON (v.book_id = c.to_book_id AND v.chapter = c.to_chapter AND v.verse = c.to_verse)
     JOIN books b ON b.id = v.book_id
     WHERE c.from_book_id = ? AND c.from_chapter = ? AND c.from_verse = ?
     
     UNION
     
     SELECT v.*, b.name_pt as book_name, b.abbrev as book_abbrev
     FROM correlations c
     JOIN verses v ON (v.book_id = c.from_book_id AND v.chapter = c.from_chapter AND v.verse = c.from_verse)
     JOIN books b ON b.id = v.book_id
     WHERE c.to_book_id = ? AND c.to_chapter = ? AND c.to_verse = ?`,
    bookId, chapter, verse,
    bookId, chapter, verse
  );
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
    const results = await db.getAllAsync<StrongEntry>(
      `SELECT * FROM strongs WHERE number LIKE ?`,
      `${prefix}%${num}`
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

