import { getDB } from './db';

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

/**
 * Fetch verses in a specific book chapter with note & favorite statuses.
 */
export function getVerses(bookId: number, chapter: number): Verse[] {
  const db = getDB();
  const verses = db.getAllSync<Verse>(
    `SELECT * FROM verses WHERE book_id = ? AND chapter = ? ORDER BY verse ASC`,
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

    // Fetch linked verses for this specific verse!
    const linked = db.getAllSync<Verse>(
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
      bookId, chapter, v.verse,
      bookId, chapter, v.verse
    );
    v.correlations = linked;
  }
  return verses;
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
 * Notes CRUD: UPSERT a note.
 */
export function saveNote(bookId: number, chapter: number, verse: number, content: string): void {
  const db = getDB();
  db.runSync(
    `INSERT INTO notes (book_id, chapter, verse, content, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(book_id, chapter, verse)
     DO UPDATE SET content = excluded.content, updated_at = CURRENT_TIMESTAMP`,
    bookId,
    chapter,
    verse,
    content
  );
}

/**
 * Notes CRUD: Delete a note.
 */
export function deleteNote(bookId: number, chapter: number, verse: number): void {
  const db = getDB();
  db.runSync(
    'DELETE FROM notes WHERE book_id = ? AND chapter = ? AND verse = ?',
    bookId,
    chapter,
    verse
  );
}

/**
 * Notes CRUD: Get all notes.
 */
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
export function searchStrongs(queryText: string): StrongEntry[] {
  const db = getDB();
  const cleaned = queryText.trim();
  if (!cleaned) return [];
  
  // Exact number query
  const strongsNumberRegex = /^[HG]\d+$/i;
  if (strongsNumberRegex.test(cleaned)) {
    const formatted = cleaned.toUpperCase();
    return db.getAllSync<StrongEntry>(
      'SELECT * FROM strongs WHERE number = ?',
      formatted
    );
  }
  
  // Build FTS prefix search match
  const words = cleaned
    .split(/\s+/)
    .map(w => w.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(w => w.length > 0)
    .map(w => `${w}*`);
    
  if (words.length === 0) return [];
  
  const ftsMatch = words.join(' AND ');
  
  return db.getAllSync<StrongEntry>(
    `SELECT s.*
     FROM strongs_fts fts
     JOIN strongs s ON s.id = fts.rowid
     WHERE strongs_fts MATCH ?
     ORDER BY s.number ASC
     LIMIT 50`,
    ftsMatch
  );
}
