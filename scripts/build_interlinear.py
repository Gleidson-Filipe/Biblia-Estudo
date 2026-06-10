"""
Build interlinear table in bible_slim.db from STEPBible TAGNT/TAHOT data.
Run: python scripts/build_interlinear.py
"""
import sqlite3
import urllib.request
import re
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'assets', 'bibles', 'bible_slim.db')

BASE_URL = "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/"

FILES = [
    ("TAGNT Mat-Jhn - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt", "NT"),
    ("TAGNT Act-Rev - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt", "NT"),
    ("TAHOT Gen-Deu - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt", "OT"),
    ("TAHOT Jos-Est - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt", "OT"),
    ("TAHOT Job-Sng - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt", "OT"),
    ("TAHOT Isa-Mal - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt", "OT"),
]

# STEPBible book abbrev -> book_id mapping (1-66)
BOOK_MAP = {
    'Gen':1,'Exo':2,'Lev':3,'Num':4,'Deu':5,'Jos':6,'Jdg':7,'Rut':8,
    '1Sa':9,'2Sa':10,'1Ki':11,'2Ki':12,'1Ch':13,'2Ch':14,'Ezr':15,'Neh':16,
    'Est':17,'Job':18,'Psa':19,'Pro':20,'Ecc':21,'Sng':22,'Isa':23,'Jer':24,
    'Lam':25,'Eze':26,'Dan':27,'Hos':28,'Joe':29,'Amo':30,'Oba':31,'Jon':32,
    'Mic':33,'Nah':34,'Hab':35,'Zep':36,'Hag':37,'Zec':38,'Mal':39,
    'Mat':40,'Mrk':41,'Luk':42,'Jhn':43,'Act':44,'Rom':45,'1Co':46,'2Co':47,
    'Gal':48,'Eph':49,'Php':50,'Col':51,'1Th':52,'2Th':53,'1Ti':54,'2Ti':55,
    'Tit':56,'Phm':57,'Heb':58,'Jas':59,'1Pe':60,'2Pe':61,'1Jn':62,'2Jn':63,
    '3Jn':64,'Jud':65,'Rev':66,
}

def parse_ref(ref_field):
    """Parse 'Mat.1.1#01=NKO' or 'Gen.1.1#01=L' -> (book_abbrev, chapter, verse, word_pos)"""
    m = re.match(r'^([A-Z0-9a-z]+)\.(\d+)\.(\d+)#(\d+)', ref_field)
    if not m:
        return None
    book, chap, verse, pos = m.group(1), int(m.group(2)), int(m.group(3)), int(m.group(4))
    return book, chap, verse, pos

def extract_strong(strong_field):
    """Extract primary Strong number from field like 'G0976=N-NSF' or '{H1254A}' or 'H9003/{H7225G}'"""
    # Find all H/G numbers
    nums = re.findall(r'[HG]\d+[A-Z]?', strong_field)
    if not nums:
        return None
    # Prefer the first non-preposition one, or just first
    return nums[0]

def parse_tagnt_line(line):
    """Parse NT line, return dict or None"""
    cols = line.split('\t')
    if len(cols) < 4:
        return None
    ref_field = cols[0].strip()
    parsed = parse_ref(ref_field)
    if not parsed:
        return None
    book, chap, verse, pos = parsed

    # cols[1] = "Βίβλος (Biblos)" -> orig word + transliteration
    word_col = cols[1].strip()
    m = re.match(r'^(.+?)\s*\((.+?)\)', word_col)
    if m:
        orig_word = m.group(1).strip()
        translit = m.group(2).strip()
    else:
        orig_word = word_col
        translit = ''

    # cols[2] = english gloss
    gloss = cols[2].strip() if len(cols) > 2 else ''

    # cols[3] = strong + grammar "G0976=N-NSF"
    strong = extract_strong(cols[3]) if len(cols) > 3 else None

    return {
        'book': book, 'chapter': chap, 'verse': verse, 'pos': pos,
        'orig_word': orig_word, 'translit': translit,
        'gloss': gloss, 'strong': strong,
    }

def parse_tahot_line(line):
    """Parse OT line, return dict or None"""
    cols = line.split('\t')
    if len(cols) < 4:
        return None
    ref_field = cols[0].strip()
    parsed = parse_ref(ref_field)
    if not parsed:
        return None
    book, chap, verse, pos = parsed

    # cols[1] = Hebrew word (may have prefix/suffix with /)
    orig_word = cols[1].strip()

    # cols[2] = transliteration
    translit = cols[2].strip() if len(cols) > 2 else ''

    # cols[3] = gloss
    gloss = cols[3].strip() if len(cols) > 3 else ''

    # cols[4] = strong field
    strong = extract_strong(cols[4]) if len(cols) > 4 else None

    return {
        'book': book, 'chapter': chap, 'verse': verse, 'pos': pos,
        'orig_word': orig_word, 'translit': translit,
        'gloss': gloss, 'strong': strong,
    }

def process_file(url, testament, conn):
    print(f"Downloading {url.split('/')[-1][:50]}...")
    try:
        with urllib.request.urlopen(url, timeout=60) as resp:
            content = resp.read().decode('utf-8', errors='replace')
    except Exception as e:
        print(f"  ERROR downloading: {e}")
        return 0

    rows = []
    skipped = 0
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '\t' not in line:
            continue
        # Skip header/comment lines
        first = line.split('\t')[0]
        if not re.match(r'^[A-Z][a-z0-9]+\.\d+\.\d+', first):
            continue

        if testament == 'NT':
            r = parse_tagnt_line(line)
        else:
            r = parse_tahot_line(line)

        if not r:
            skipped += 1
            continue

        book_id = BOOK_MAP.get(r['book'])
        if not book_id:
            skipped += 1
            continue

        rows.append((
            book_id, r['chapter'], r['verse'], r['pos'],
            r['orig_word'], r['translit'], r['gloss'], r['strong']
        ))

    print(f"  Parsed {len(rows)} words, skipped {skipped}")
    if rows:
        conn.executemany(
            'INSERT OR REPLACE INTO interlinear (book_id, chapter, verse, word_pos, orig_word, translit, gloss, strong_number) VALUES (?,?,?,?,?,?,?,?)',
            rows
        )
        conn.commit()
    return len(rows)

def main():
    print(f"Opening DB: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)

    print("Creating interlinear table...")
    conn.executescript("""
        DROP TABLE IF EXISTS interlinear;
        CREATE TABLE interlinear (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book_id INTEGER NOT NULL,
            chapter INTEGER NOT NULL,
            verse INTEGER NOT NULL,
            word_pos INTEGER NOT NULL,
            orig_word TEXT,
            translit TEXT,
            gloss TEXT,
            strong_number TEXT,
            UNIQUE(book_id, chapter, verse, word_pos)
        );
        CREATE INDEX IF NOT EXISTS idx_interlinear_ref ON interlinear(book_id, chapter, verse);
    """)
    conn.commit()

    total = 0
    for filename, testament in FILES:
        url = BASE_URL + urllib.parse.quote(filename)
        total += process_file(url, testament, conn)

    conn.close()
    print(f"\nDone! Total words inserted: {total}")

import urllib.parse
if __name__ == '__main__':
    main()
