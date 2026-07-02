import express from 'express';
import cookieParser from 'cookie-parser';
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

// API
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/entries', entryRoutes);

// Statische Dateien (Landingpage + App)
app.use(express.static(join(__dirname, '..', 'public')));

// App-Route
app.get('/app', (req, res) => {
  res.sendFile(join(__dirname, '..', 'public', 'app.html'));
});

// Monatsblatt
app.get('/monat', (req, res) => {
  res.sendFile(join(__dirname, '..', 'public', 'monat.html'));
});

app.listen(PORT, () => {
  console.log(`Zeiterfassung laeuft auf http://localhost:${PORT}`);
});
