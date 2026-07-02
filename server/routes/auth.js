import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { signToken, setAuthCookie, clearAuthCookie, requireAuth } from '../auth.js';

const router = Router();

// Maximale Anzahl an Accounts (Standard 30, per Umgebungsvariable anpassbar)
const MAX_USERS = Math.max(1, parseInt(process.env.MAX_USERS ?? '30', 10) || 30);

// Registrierung – legt einen neuen, getrennten Account an
router.post('/register', (req, res) => {
  const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (userCount >= MAX_USERS) {
    return res.status(403).json({
      error: `Die maximale Anzahl an Accounts (${MAX_USERS}) ist erreicht. Bitte wende dich an den Administrator.`,
    });
  }

  const name = (req.body?.name || '').trim();
  const email = (req.body?.email || '').trim().toLowerCase();
  const password = req.body?.password || '';

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, E-Mail und Passwort sind erforderlich' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Das Passwort muss mindestens 6 Zeichen haben' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Bitte eine gueltige E-Mail-Adresse angeben' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Diese E-Mail ist bereits registriert' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)')
    .run(name, email, hash);

  const user = { id: info.lastInsertRowid, name, email };
  const token = signToken(user);
  setAuthCookie(res, token);
  res.status(201).json({ user });
});

// Anmeldung
router.post('/login', (req, res) => {
  const email = (req.body?.email || '').trim().toLowerCase();
  const password = req.body?.password || '';

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!row || !bcrypt.compareSync(password, row.password)) {
    return res.status(401).json({ error: 'E-Mail oder Passwort ist falsch' });
  }

  const user = { id: row.id, name: row.name, email: row.email };
  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ user });
});

// Abmeldung
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// Aktueller Account
router.get('/me', requireAuth, (req, res) => {
  const row = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.user.id);
  if (!row) return res.status(401).json({ error: 'Account nicht gefunden' });
  res.json({ user: row });
});

export default router;
