const fs = require('fs');
const path = require('path');
const https = require('https');

const BIBLES_DIR = path.join(__dirname, '..', 'assets', 'bibles');

const SOURCES = {
  ara: 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/pt_aa.json',
  arc: 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/pt_acf.json',
  kjv: 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json',
  dby: 'https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/csv/Darby.csv'
};

// Create assets/bibles directory if it doesn't exist
if (!fs.existsSync(BIBLES_DIR)) {
  fs.mkdirSync(BIBLES_DIR, { recursive: true });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Iniciando download de: ${url}`);
    const file = fs.createWriteStream(dest);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Falha no download: Código de status ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close(() => {
          console.log(`Download concluído e salvo em: ${dest}`);
          resolve();
        });
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {}); // Delete local file on error
      reject(err);
    });
  });
}

async function start() {
  try {
    for (const [key, url] of Object.entries(SOURCES)) {
      const ext = url.endsWith('.csv') ? 'csv' : 'json';
      const destPath = path.join(BIBLES_DIR, `${key}.${ext}`);
      await downloadFile(url, destPath);
    }
    console.log('\nTodas as versões da Bíblia foram baixadas com sucesso!');
  } catch (error) {
    console.error('Erro durante o download das Bíblias:', error);
    process.exit(1);
  }
}

start();
