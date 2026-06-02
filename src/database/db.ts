import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

const DB_NAME = 'bible.db';
const DB_VERSION_KEY = 'db_initialized_v2';
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
