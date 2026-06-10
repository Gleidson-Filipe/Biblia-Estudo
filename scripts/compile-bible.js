const fs = require('fs');
const path = require('path');
const https = require('https');
const { DatabaseSync } = require('node:sqlite');

const PROJECT_DIR = 'C:\\Biblia-de-estudos\\Biblia-Estudo';
const BIBLES_DIR = path.join(PROJECT_DIR, 'assets', 'bibles');
const DB_PATH = path.join(BIBLES_DIR, 'bible.db');

// Ensure bibles directory exists
if (!fs.existsSync(BIBLES_DIR)) {
  fs.mkdirSync(BIBLES_DIR, { recursive: true });
}

// English book names in DBY order (standard Protestant canon)
const DBY_BOOK_NAMES = [
  'Genesis',         'Exodus',           'Leviticus',
  'Numbers',         'Deuteronomy',      'Joshua',
  'Judges',          'Ruth',             'I Samuel',
  'II Samuel',       'I Kings',          'II Kings',
  'I Chronicles',    'II Chronicles',    'Ezra',
  'Nehemiah',        'Esther',           'Job',
  'Psalms',          'Proverbs',         'Ecclesiastes',
  'Song of Solomon', 'Isaiah',           'Jeremiah',
  'Lamentations',    'Ezekiel',          'Daniel',
  'Hosea',           'Joel',             'Amos',
  'Obadiah',         'Jonah',            'Micah',
  'Nahum',           'Habakkuk',         'Zephaniah',
  'Haggai',          'Zechariah',        'Malachi',
  'Matthew',         'Mark',             'Luke',
  'John',            'Acts',             'Romans',
  'I Corinthians',   'II Corinthians',   'Galatians',
  'Ephesians',       'Philippians',      'Colossians',
  'I Thessalonians', 'II Thessalonians', 'I Timothy',
  'II Timothy',      'Titus',            'Philemon',
  'Hebrews',         'James',            'I Peter',
  'II Peter',        'I John',           'II John',
  'III John',        'Jude',             'Revelation of John'
];

const dbyBookToId = {};
DBY_BOOK_NAMES.forEach((name, index) => {
  dbyBookToId[name] = index + 1;
});

function parseCSV(content) {
  const records = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    const next = content[i + 1];
    
    if (inQuotes) {
      if (c === '"') {
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && next === '\n') {
          i++;
        }
        row.push(field);
        if (row.length > 1 || row[0] !== '') {
          records.push(row);
        }
        row = [];
        field = '';
      } else {
        field += c;
      }
    }
  }
  
  if (field || row.length > 0) {
    row.push(field);
    records.push(row);
  }
  
  return records;
}

// Download function
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url}...`);
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: Status Code ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded to ${destPath}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function run() {
  console.log('--- STARTING BIBLE DATABASE COMPILATION ---');
  
  // 1. Check if database file already exists, delete it so we build fresh
  if (fs.existsSync(DB_PATH)) {
    console.log('Deleting existing database to compile fresh...');
    fs.unlinkSync(DB_PATH);
  }
  
  // 2. Open SQLite Database
  const db = new DatabaseSync(DB_PATH);
  
  // 3. Create Tables
  db.exec(`
    CREATE TABLE books (
      id INTEGER PRIMARY KEY,
      abbrev TEXT UNIQUE NOT NULL,
      name_pt TEXT NOT NULL,
      name_en TEXT NOT NULL,
      testament TEXT NOT NULL
    );
    
    CREATE TABLE verses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      text_ara TEXT NOT NULL,
      text_arc TEXT NOT NULL,
      text_kjv TEXT NOT NULL,
      text_dby TEXT NOT NULL,
      FOREIGN KEY (book_id) REFERENCES books(id)
    );
    
    CREATE UNIQUE INDEX idx_verses_bcv ON verses(book_id, chapter, verse);
    
    CREATE TABLE strongs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT UNIQUE NOT NULL,
      lemma TEXT,
      pronounce TEXT,
      xlit TEXT,
      description TEXT
    );
  `);
  
  // User features: Notes, Favorites, Correlations
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(book_id, chapter, verse)
    );
    
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(book_id, chapter, verse)
    );
    
    CREATE TABLE IF NOT EXISTS correlations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_book_id INTEGER NOT NULL,
      from_chapter INTEGER NOT NULL,
      from_verse INTEGER NOT NULL,
      to_book_id INTEGER NOT NULL,
      to_chapter INTEGER NOT NULL,
      to_verse INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(from_book_id, from_chapter, from_verse, to_book_id, to_chapter, to_verse)
    );
  `);
  
  console.log('Tables created successfully.');
  
  // 4. Load & Parse Bible JSONs and CSV
  console.log('Loading bibles JSONs...');
  const araRaw = fs.readFileSync(path.join(BIBLES_DIR, 'ara.json'), 'utf8').replace(/^\uFEFF/, '');
  const arcRaw = fs.readFileSync(path.join(BIBLES_DIR, 'arc.json'), 'utf8').replace(/^\uFEFF/, '');
  const kjvRaw = fs.readFileSync(path.join(BIBLES_DIR, 'kjv.json'), 'utf8').replace(/^\uFEFF/, '');
  
  const ara = JSON.parse(araRaw);
  const arc = JSON.parse(arcRaw);
  const kjv = JSON.parse(kjvRaw);
  
  console.log('Loading Darby CSV...');
  const dbyRaw = fs.readFileSync(path.join(BIBLES_DIR, 'dby.csv'), 'utf8');
  const dbyRecords = parseCSV(dbyRaw);
  console.log(`Loaded ${dbyRecords.length - 1} verses from Darby CSV.`);
  
  // 5. Insert Books
  console.log('Inserting books...');
  const insertBookStmt = db.prepare(`
    INSERT INTO books (id, abbrev, name_pt, name_en, testament)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  for (let i = 0; i < 66; i++) {
    const bookId = i + 1;
    const abbrev = ara[i].abbrev;
    const name_pt = ara[i].name;
    const name_en = kjv[i].name;
    const testament = bookId <= 39 ? 'old' : 'new';
    
    insertBookStmt.run(bookId, abbrev, name_pt, name_en, testament);
  }
  
  console.log('66 books inserted.');
  
  // 6. Build unified verses dictionary
  console.log('Building unified verses map...');
  const versesMap = {};
  
  // Helper to ensure key structure
  const getOrCreate = (bookId, chap, vNum) => {
    const key = `${bookId}:${chap}:${vNum}`;
    if (!versesMap[key]) {
      versesMap[key] = {
        book_id: bookId,
        chapter: chap,
        verse: vNum,
        ara: '',
        arc: '',
        kjv: '',
        dby: ''
      };
    }
    return versesMap[key];
  };
  
  // Populate ARA
  console.log('Mapping ARA...');
  for (let b = 0; b < ara.length; b++) {
    const book = ara[b];
    const bookId = b + 1;
    for (let c = 0; c < book.chapters.length; c++) {
      const chapter = book.chapters[c];
      const chapNum = c + 1;
      for (let v = 0; v < chapter.length; v++) {
        const verseNum = v + 1;
        const entry = getOrCreate(bookId, chapNum, verseNum);
        entry.ara = chapter[v];
      }
    }
  }
  
  // Populate ARC
  console.log('Mapping ARC...');
  for (let b = 0; b < arc.length; b++) {
    const book = arc[b];
    const bookId = b + 1;
    for (let c = 0; c < book.chapters.length; c++) {
      const chapter = book.chapters[c];
      const chapNum = c + 1;
      for (let v = 0; v < chapter.length; v++) {
        const verseNum = v + 1;
        const entry = getOrCreate(bookId, chapNum, verseNum);
        entry.arc = chapter[v];
      }
    }
  }
  
  // Populate KJV
  console.log('Mapping KJV...');
  for (let b = 0; b < kjv.length; b++) {
    const book = kjv[b];
    const bookId = b + 1;
    for (let c = 0; c < book.chapters.length; c++) {
      const chapter = book.chapters[c];
      const chapNum = c + 1;
      for (let v = 0; v < chapter.length; v++) {
        const verseNum = v + 1;
        const entry = getOrCreate(bookId, chapNum, verseNum);
        entry.kjv = chapter[v];
      }
    }
  }
  
  // Populate Darby CSV
  console.log('Mapping Darby CSV...');
  for (let i = 1; i < dbyRecords.length; i++) {
    const record = dbyRecords[i];
    if (record.length < 4) continue;
    const [bookName, chapStr, verseStr, rawText] = record;
    if (!bookName) continue;
    
    const bookId = dbyBookToId[bookName];
    const chapNum = parseInt(chapStr, 10);
    const verseNum = parseInt(verseStr, 10);
    
    if (!bookId || isNaN(chapNum) || isNaN(verseNum)) {
      continue;
    }
    
    // Clean space glitched word "God"
    let text = rawText.trim();
    text = text.replace(/([a-zA-Z])God/g, '$1 God');
    
    const entry = getOrCreate(bookId, chapNum, verseNum);
    entry.dby = text;
  }
  
  const totalVersesKeys = Object.keys(versesMap).length;
  console.log(`Unified mapping complete. Total unique verses: ${totalVersesKeys}`);
  
  // 7. Insert all verses in a single transaction
  console.log('Inserting verses into database...');
  db.exec('BEGIN TRANSACTION;');
  
  const insertVerseStmt = db.prepare(`
    INSERT INTO verses (book_id, chapter, verse, text_ara, text_arc, text_kjv, text_dby)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  for (const key in versesMap) {
    const v = versesMap[key];
    insertVerseStmt.run(
      v.book_id,
      v.chapter,
      v.verse,
      v.ara || '',
      v.arc || '',
      v.kjv || '',
      v.dby || ''
    );
  }
  
  db.exec('COMMIT;');
  console.log('Verses inserted successfully.');
  
  // 8. Create FTS5 Virtual Table for Bibles
  console.log('Creating and populating FTS5 index for bibles...');
  db.exec(`
    CREATE VIRTUAL TABLE verses_fts USING fts5(
      text_ara,
      text_arc,
      text_kjv,
      text_dby,
      content='verses',
      content_rowid='id'
    );
    
    -- Populate FTS5 table
    INSERT INTO verses_fts(rowid, text_ara, text_arc, text_kjv, text_dby)
    SELECT id, text_ara, text_arc, text_kjv, text_dby FROM verses;
    
    -- Keep index updated automatically
    CREATE TRIGGER verses_ai AFTER INSERT ON verses BEGIN
      INSERT INTO verses_fts(rowid, text_ara, text_arc, text_kjv, text_dby)
      VALUES (new.id, new.text_ara, new.text_arc, new.text_kjv, new.text_dby);
    END;
    
    CREATE TRIGGER verses_ad AFTER DELETE ON verses BEGIN
      INSERT INTO verses_fts(verses_fts, rowid, text_ara, text_arc, text_kjv, text_dby)
      VALUES('delete', old.id, old.text_ara, old.text_arc, old.text_kjv, old.text_dby);
    END;
    
    CREATE TRIGGER verses_au AFTER UPDATE ON verses BEGIN
      INSERT INTO verses_fts(verses_fts, rowid, text_ara, text_arc, text_kjv, text_dby)
      VALUES('delete', old.id, old.text_ara, old.text_arc, old.text_kjv, old.text_dby);
      INSERT INTO verses_fts(rowid, text_ara, text_arc, text_kjv, text_dby)
      VALUES (new.id, new.text_ara, new.text_arc, new.text_kjv, new.text_dby);
    END;
  `);
  console.log('FTS5 Bible index created.');
  
  // 9. Download Strong's Concordance
  const strongsJsonPath = path.join(BIBLES_DIR, 'strongs.json');
  if (!fs.existsSync(strongsJsonPath)) {
    const strongsUrl = 'https://raw.githubusercontent.com/mormon-documentation-project/strongs/master/strongs.json';
    await downloadFile(strongsUrl, strongsJsonPath);
  } else {
    console.log('Strongs JSON already exists locally.');
  }
  
  // 10. Load and insert Strong's Lexicon
  console.log('Parsing and inserting Strongs lexicon...');
  const strongsRaw = fs.readFileSync(strongsJsonPath, 'utf8').replace(/^\uFEFF/, '');
  const strongs = JSON.parse(strongsRaw);
  console.log(`Loaded ${strongs.length} Strong's entries.`);
  
  db.exec('BEGIN TRANSACTION;');
  const insertStrongStmt = db.prepare(`
    INSERT INTO strongs (number, lemma, pronounce, xlit, description)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  for (let i = 0; i < strongs.length; i++) {
    const entry = strongs[i];
    insertStrongStmt.run(
      entry.number || '',
      entry.lemma || '',
      entry.pronounce || '',
      entry.xlit || '',
      entry.description || ''
    );
  }
  db.exec('COMMIT;');
  console.log("Strong's entries inserted.");
  
  // 11. Create FTS5 Virtual Table for Strong's Concordance
  console.log("Creating and populating FTS5 index for Strong's Lexicon...");
  db.exec(`
    CREATE VIRTUAL TABLE strongs_fts USING fts5(
      number,
      lemma,
      pronounce,
      xlit,
      description,
      content='strongs',
      content_rowid='id'
    );
    
    INSERT INTO strongs_fts(rowid, number, lemma, pronounce, xlit, description)
    SELECT id, number, lemma, pronounce, xlit, description FROM strongs;
    
    -- Strongs Sync Triggers
    CREATE TRIGGER strongs_ai AFTER INSERT ON strongs BEGIN
      INSERT INTO strongs_fts(rowid, number, lemma, pronounce, xlit, description)
      VALUES (new.id, new.number, new.lemma, new.pronounce, new.xlit, new.description);
    END;
    
    CREATE TRIGGER strongs_ad AFTER DELETE ON strongs BEGIN
      INSERT INTO strongs_fts(strongs_fts, rowid, number, lemma, pronounce, xlit, description)
      VALUES('delete', old.id, old.number, old.lemma, old.pronounce, old.xlit, old.description);
    END;
    
    CREATE TRIGGER strongs_au AFTER UPDATE ON strongs BEGIN
      INSERT INTO strongs_fts(strongs_fts, rowid, number, lemma, pronounce, xlit, description)
      VALUES('delete', old.id, old.number, old.lemma, old.pronounce, old.xlit, old.description);
      INSERT INTO strongs_fts(rowid, number, lemma, pronounce, xlit, description)
      VALUES (new.id, new.number, new.lemma, new.pronounce, new.xlit, new.description);
    END;
  `);
  console.log('Strongs FTS5 index created.');
  
  // Optimize database file size
  console.log('Optimizing database (VACUUM and ANALYZE)...');
  db.exec('VACUUM;');
  db.exec('ANALYZE;');
  
  console.log('--- BIBLE DATABASE COMPILATION COMPLETED SUCCESSFULLY ---');
  console.log(`Database generated at: ${DB_PATH}`);
  const stats = fs.statSync(DB_PATH);
  console.log(`Database file size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
}

run().catch(err => {
  console.error('CRITICAL ERROR DURING COMPILATION:', err);
  process.exit(1);
});
