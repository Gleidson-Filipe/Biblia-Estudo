import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

const DB_NAME = 'bible.db';
const DB_VERSION_KEY = 'db_initialized_v6';
const DB_VERSION_PATH = `${FileSystem.documentDirectory}${DB_VERSION_KEY}`;
const DB_PATH = `${FileSystem.documentDirectory}SQLite/${DB_NAME}`;

export async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;

  try {
    // Check via a version marker file — faster than stat-ing the 34MB db
    const marker = await FileSystem.getInfoAsync(DB_VERSION_PATH);

    if (!marker.exists) {
      console.log('First launch: copying database...');
      await FileSystem.makeDirectoryAsync(
        `${FileSystem.documentDirectory}SQLite`,
        { intermediates: true }
      );
      const asset = Asset.fromModule(require('../../assets/bibles/bible_slim.db'));
      await asset.downloadAsync();
      if (!asset.localUri) throw new Error('Asset localUri not found');
      await FileSystem.copyAsync({ from: asset.localUri, to: DB_PATH });
      // Write marker so next launch skips the copy
      await FileSystem.writeAsStringAsync(DB_VERSION_PATH, '1');
      console.log('Database copied.');
    }

    console.log('[DB] opening...');
    const t = Date.now();
    dbInstance = SQLite.openDatabaseSync(DB_NAME);
    console.log('[DB] opened in', Date.now() - t, 'ms');

    // Corrige nomes longos de livros
    dbInstance.runSync(`UPDATE books SET name_pt = 'Lamentações' WHERE name_pt = 'Lamentações de Jeremias'`);

    // Migration v2: rebuild notes table with UNIQUE(book_id, chapter, verse, slot)
    const userVersion = dbInstance.getAllSync<{user_version: number}>(`PRAGMA user_version`)[0]?.user_version ?? 0;
    if (userVersion < 2) {
      const noteCols = dbInstance.getAllSync<{name: string}>(`PRAGMA table_info(notes)`).map(c => c.name);
      dbInstance.runSync(`DROP TABLE IF EXISTS notes_new`);
      dbInstance.runSync(`
        CREATE TABLE notes_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          book_id INTEGER NOT NULL,
          chapter INTEGER NOT NULL,
          verse INTEGER NOT NULL,
          slot INTEGER NOT NULL DEFAULT 1,
          content TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(book_id, chapter, verse, slot)
        )
      `);
      if (noteCols.length > 0) {
        const slotExpr = noteCols.includes('slot') ? 'slot' : '1';
        dbInstance.runSync(`INSERT OR IGNORE INTO notes_new (id, book_id, chapter, verse, slot, content, created_at, updated_at) SELECT id, book_id, chapter, verse, ${slotExpr}, content, created_at, updated_at FROM notes`);
        dbInstance.runSync(`DROP TABLE notes`);
      }
      dbInstance.runSync(`ALTER TABLE notes_new RENAME TO notes`);
      dbInstance.runSync(`PRAGMA user_version = 2`);
    }

    dbInstance.runSync(`CREATE INDEX IF NOT EXISTS idx_verses_book_chapter ON verses (book_id, chapter)`);
    dbInstance.runSync(`CREATE INDEX IF NOT EXISTS idx_notes_book_chapter ON notes (book_id, chapter)`);
    dbInstance.runSync(`CREATE INDEX IF NOT EXISTS idx_favs_book_chapter ON favorites (book_id, chapter)`);
    dbInstance.runSync(`CREATE INDEX IF NOT EXISTS idx_corr_from ON correlations (from_book_id, from_chapter)`);
    dbInstance.runSync(`CREATE INDEX IF NOT EXISTS idx_corr_to ON correlations (to_book_id, to_chapter)`);

    // FTS5 virtual table for full-text search on verses
    // v4: rebuild with all 4 columns (ara, arc, kjv, dby) so version filter works for all
    if (userVersion < 4) {
      dbInstance.runSync(`DROP TABLE IF EXISTS verses_fts`);
      dbInstance.runSync(`PRAGMA user_version = 4`);
    }
    const ftsExists = dbInstance.getAllSync<{name: string}>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='verses_fts'`
    ).length > 0;
    if (!ftsExists) {
      console.log('[DB] building verses_fts index...');
      dbInstance.runSync(`
        CREATE VIRTUAL TABLE verses_fts USING fts5(
          text_ara, text_arc, text_kjv, text_dby,
          content='verses', content_rowid='id'
        )
      `);
      dbInstance.runSync(`
        INSERT INTO verses_fts(rowid, text_ara, text_arc, text_kjv, text_dby)
        SELECT id, COALESCE(text_ara,''), COALESCE(text_arc,''), COALESCE(text_kjv,''), COALESCE(text_dby,'')
        FROM verses
      `);
      console.log('[DB] verses_fts built.');
    }

    return dbInstance;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Returns the open database instance. Must only be called AFTER initializeDatabase() has completed.
 */
export function getDB(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    // Fail-safe: open synchronously if not already initialized (not recommended for first boot, but safe fallback)
    dbInstance = SQLite.openDatabaseSync('bible.db');
  }
  return dbInstance;
}
