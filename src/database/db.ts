import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

const DB_NAME = 'bible.db';
const DB_VERSION_KEY = 'db_initialized_v120';
const DB_VERSION_PATH = `${FileSystem.documentDirectory}${DB_VERSION_KEY}`;
const DB_PATH = `${FileSystem.documentDirectory}SQLite/${DB_NAME}`;

export async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;

  try {
    // Check via a version marker file — faster than stat-ing the 34MB db
    const marker = await FileSystem.getInfoAsync(DB_VERSION_PATH);

    const backupPath = `${FileSystem.documentDirectory}SQLite/bible_backup.db`;

    if (!marker.exists) {
      await FileSystem.makeDirectoryAsync(
        `${FileSystem.documentDirectory}SQLite`,
        { intermediates: true }
      );

      // File-level backup of old DB (no SQLite connection needed)
      const oldDbInfo = await FileSystem.getInfoAsync(DB_PATH);
      const backupInfo = await FileSystem.getInfoAsync(backupPath);
      if (oldDbInfo.exists && !backupInfo.exists) {
        await FileSystem.copyAsync({ from: DB_PATH, to: backupPath });
        console.log('[DB] old DB backed up at file level');
      }
      // Limpa WAL/SHM órfãos para evitar "database disk image is malformed"
      await FileSystem.deleteAsync(DB_PATH + '-wal', { idempotent: true });
      await FileSystem.deleteAsync(DB_PATH + '-shm', { idempotent: true });

      const asset = Asset.fromModule(require('../../assets/bibles/bible_slim.db'));
      await asset.downloadAsync();
      if (!asset.localUri) throw new Error('Asset localUri not found');
      
      const sourceInfo = await FileSystem.getInfoAsync(asset.localUri);
      console.log('[DB] Source asset info:', JSON.stringify(sourceInfo));
      
      await FileSystem.copyAsync({ from: asset.localUri, to: DB_PATH });
      
      const destInfo = await FileSystem.getInfoAsync(DB_PATH);
      console.log('[DB] Destination file info:', JSON.stringify(destInfo));
      
      await FileSystem.writeAsStringAsync(DB_VERSION_PATH, '1');
      console.log('[DB] asset copied (v7)');
    }

    console.log('[DB] opening...');
    const t = Date.now();
    dbInstance = SQLite.openDatabaseSync(DB_NAME);
    dbInstance.runSync('PRAGMA foreign_keys = ON');
    console.log('[DB] opened in', Date.now() - t, 'ms');

    // Restore user data from file-level backup via ATTACH (single connection, fast)
    const backupInfo = await FileSystem.getInfoAsync(backupPath);
    if (backupInfo.exists) {
      const rawPath = backupPath.replace(/^file:\/\//, '');
      try {
        console.log('[DB] Attaching backup database...');
        dbInstance.runSync(`ATTACH DATABASE '${rawPath}' AS backup_db`);
        const tables = ['notes', 'favorites', 'note_groups', 'note_group_verses', 'block_links', 'block_link_src_verses', 'block_link_tgt_verses'];
        console.log('[DB] Restoring user tables...');
        dbInstance.runSync('BEGIN');
        for (const t2 of tables) {
          try { dbInstance.runSync(`INSERT OR IGNORE INTO ${t2} SELECT * FROM backup_db.${t2}`); } catch {}
        }
        dbInstance.runSync('COMMIT');
        console.log('[DB] Detaching backup database...');
        dbInstance.runSync('DETACH DATABASE backup_db');
        console.log('[DB] user data restored from backup');
      } catch (e) {
        console.warn('[DB] restore failed:', e);
        try { dbInstance.runSync('ROLLBACK'); } catch {}
      }
      await FileSystem.deleteAsync(backupPath, { idempotent: true });
    }

    console.log('[DB] Fetching user version...');
    const userVersion = dbInstance.getAllSync<{user_version: number}>(`PRAGMA user_version`)[0]?.user_version ?? 0;
    console.log('[DB] Current user_version:', userVersion);

    if (userVersion < 2) {
      console.log('[DB] Migrating to v2 (notes unique)...');
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

    // Migration v5: note_groups and correlation_groups tables
    if (userVersion < 5) {
      console.log('[DB] Migrating to v5 (note_groups)...');
      dbInstance.runSync(`
        CREATE TABLE IF NOT EXISTS note_groups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          content TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      dbInstance.runSync(`
        CREATE TABLE IF NOT EXISTS note_group_verses (
          group_id INTEGER NOT NULL,
          book_id INTEGER NOT NULL,
          chapter INTEGER NOT NULL,
          verse INTEGER NOT NULL,
          PRIMARY KEY (group_id, book_id, chapter, verse),
          FOREIGN KEY (group_id) REFERENCES note_groups(id) ON DELETE CASCADE
        )
      `);
      dbInstance.runSync(`
        CREATE TABLE IF NOT EXISTS correlation_groups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          to_book_id INTEGER NOT NULL,
          to_chapter INTEGER NOT NULL,
          to_verse INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      dbInstance.runSync(`
        CREATE TABLE IF NOT EXISTS correlation_group_verses (
          group_id INTEGER NOT NULL,
          book_id INTEGER NOT NULL,
          chapter INTEGER NOT NULL,
          verse INTEGER NOT NULL,
          PRIMARY KEY (group_id, book_id, chapter, verse),
          FOREIGN KEY (group_id) REFERENCES correlation_groups(id) ON DELETE CASCADE
        )
      `);
      dbInstance.runSync(`CREATE INDEX IF NOT EXISTS idx_ngv_book_chapter ON note_group_verses (book_id, chapter)`);
      dbInstance.runSync(`CREATE INDEX IF NOT EXISTS idx_cgv_book_chapter ON correlation_group_verses (book_id, chapter)`);
      dbInstance.runSync(`PRAGMA user_version = 5`);
    }

    // Migration v6: block_links system (replaces correlations + correlation_groups)
    if (userVersion < 6) {
      console.log('[DB] Migrating to v6 (block_links)...');
      dbInstance.runSync(`DROP TABLE IF EXISTS correlation_group_verses`);
      dbInstance.runSync(`DROP TABLE IF EXISTS correlation_groups`);
      dbInstance.runSync(`DROP TABLE IF EXISTS correlations`);
      dbInstance.runSync(`
        CREATE TABLE IF NOT EXISTS block_links (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          src_book_id INTEGER NOT NULL,
          src_chapter INTEGER NOT NULL,
          src_verses TEXT NOT NULL,
          tgt_book_id INTEGER NOT NULL,
          tgt_chapter INTEGER NOT NULL,
          tgt_verses TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      dbInstance.runSync(`
        CREATE TABLE IF NOT EXISTS block_link_src_verses (
          link_id INTEGER NOT NULL,
          book_id INTEGER NOT NULL,
          chapter INTEGER NOT NULL,
          verse INTEGER NOT NULL,
          PRIMARY KEY (link_id, verse),
          FOREIGN KEY (link_id) REFERENCES block_links(id) ON DELETE CASCADE
        )
      `);
      dbInstance.runSync(`
        CREATE TABLE IF NOT EXISTS block_link_tgt_verses (
          link_id INTEGER NOT NULL,
          book_id INTEGER NOT NULL,
          chapter INTEGER NOT NULL,
          verse INTEGER NOT NULL,
          PRIMARY KEY (link_id, verse),
          FOREIGN KEY (link_id) REFERENCES block_links(id) ON DELETE CASCADE
        )
      `);
      dbInstance.runSync(`CREATE INDEX IF NOT EXISTS idx_blsv_book_chapter ON block_link_src_verses (book_id, chapter)`);
      dbInstance.runSync(`CREATE INDEX IF NOT EXISTS idx_bltv_book_chapter ON block_link_tgt_verses (book_id, chapter)`);
      // limpa linhas órfãs de execuções anteriores sem CASCADE ativo
      dbInstance.runSync(`DELETE FROM block_link_src_verses WHERE link_id NOT IN (SELECT id FROM block_links)`);
      dbInstance.runSync(`DELETE FROM block_link_tgt_verses WHERE link_id NOT IN (SELECT id FROM block_links)`);
      dbInstance.runSync(`PRAGMA user_version = 6`);
    }

    // FTS5 virtual table for full-text search on verses
    // v4: rebuild with all 4 columns (ara, arc, kjv, dby) so version filter works for all
    if (userVersion < 4) {
      console.log('[DB] Dropping verses_fts if userVersion < 4...');
      dbInstance.runSync(`DROP TABLE IF EXISTS verses_fts`);
    }

    // Migration v7: optimizes boot speed by moving constant runtime checks/updates inside the schema version
    const updatedUserVersion = dbInstance.getAllSync<{user_version: number}>(`PRAGMA user_version`)[0]?.user_version ?? 0;
    if (updatedUserVersion < 7) {
      console.log('[DB] Migrating to v7 (optimizing startup)...');

      console.log('[DB] Correcting book names...');
      dbInstance.runSync(`UPDATE books SET name_pt = 'Lamentações' WHERE name_pt = 'Lamentações de Jeremias'`);

      console.log('[DB] Creating indexes...');
      dbInstance.runSync(`CREATE INDEX IF NOT EXISTS idx_verses_book_chapter ON verses (book_id, chapter)`);
      dbInstance.runSync(`CREATE INDEX IF NOT EXISTS idx_notes_book_chapter ON notes (book_id, chapter)`);
      dbInstance.runSync(`CREATE INDEX IF NOT EXISTS idx_favs_book_chapter ON favorites (book_id, chapter)`);

      console.log('[DB] Cleaning orphan links...');
      dbInstance.runSync(`DELETE FROM block_link_src_verses WHERE link_id NOT IN (SELECT id FROM block_links)`);
      dbInstance.runSync(`DELETE FROM block_link_tgt_verses WHERE link_id NOT IN (SELECT id FROM block_links)`);

      console.log('[DB] Checking if verses_fts exists...');
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

      dbInstance.runSync(`PRAGMA user_version = 7`);
      console.log('[DB] Migration to v7 complete.');
    }

    console.log('[DB] Initialization complete.');
    return dbInstance;
  } catch (error) {
    console.error('Failed to initialize database, cleaning up and attempting recovery:', error);
    dbInstance = null;
    try {
      await FileSystem.deleteAsync(DB_PATH, { idempotent: true });
      await FileSystem.deleteAsync(DB_VERSION_PATH, { idempotent: true });
    } catch (cleanupErr) {
      console.error('Error cleaning up corrupted database:', cleanupErr);
    }
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
    dbInstance.runSync('PRAGMA foreign_keys = ON');
  }
  return dbInstance;
}
