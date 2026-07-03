import express from 'express';
import cookieParser from 'cookie-parser';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import entryRoutes from './routes/entries.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());

// Health-Check (fuer Docker / Monitoring / Reverse-Proxy)
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Version/Build-Kennung (wird beim Deploy in public/BUILD geschrieben)
app.get('/api/version', (req, res) => {
  let version = 'dev';
  try { version = readFileSync(join(__dirname, '..', 'public', 'BUILD'), 'utf8').trim() || 'dev'; } catch { /* keine BUILD-Datei */ }
  res.setHeader('Cache-Control', 'no-cache');
  res.json({ version });
});

// API
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/entries', entryRoutes);

// Statische Dateien (Landingpage + App).
// no-cache erzwingt, dass Browser HTML/JS/CSS nach einem Update per ETag
// revalidieren und geaenderte Dateien sofort neu laden.
app.use(express.static(join(__dirname, '..', 'public'), {
  setHeaders(res, filePath) {
    if (/\.(html|js|css)$/.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
  },
}));

// App-Route
app.get('/app', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(join(__dirname, '..', 'public', 'app.html'));
});

// Monatsblatt
app.get('/monat', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(join(__dirname, '..', 'public', 'monat.html'));
});

app.listen(PORT, () => {
  console.log(`Zeiterfassung laeuft auf http://localhost:${PORT}`);
});
