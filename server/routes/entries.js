import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

const SELECT_ENTRY = `
  SELECT e.id, e.project_id, e.description, e.start_ts, e.end_ts, e.created_at,
         p.name AS project_name, p.color AS project_color
  FROM entries e
  LEFT JOIN projects p ON p.id = e.project_id
`;

function isValidDate(v) {
  return v && !Number.isNaN(new Date(v).getTime());
}

// Alle Eintraege (neueste zuerst)
router.get('/', (req, res) => {
  const rows = db
    .prepare(`${SELECT_ENTRY} WHERE e.user_id = ? ORDER BY e.start_ts DESC`)
    .all(req.user.id);
  res.json({ entries: rows });
});

// Laufender (nicht gestoppter) Eintrag – fuer den Timer
router.get('/running', (req, res) => {
  const row = db
    .prepare(`${SELECT_ENTRY} WHERE e.user_id = ? AND e.end_ts IS NULL ORDER BY e.start_ts DESC LIMIT 1`)
    .get(req.user.id);
  res.json({ entry: row || null });
});

// Timer starten (Einstempeln)
router.post('/start', (req, res) => {
  const running = db
    .prepare('SELECT id FROM entries WHERE user_id = ? AND end_ts IS NULL')
    .get(req.user.id);
  if (running) return res.status(409).json({ error: 'Es laeuft bereits eine Zeiterfassung' });

  const project_id = req.body?.project_id || null;
  const description = (req.body?.description || '').trim();
  const start_ts = new Date().toISOString();

  const info = db
    .prepare('INSERT INTO entries (user_id, project_id, description, start_ts) VALUES (?, ?, ?, ?)')
    .run(req.user.id, project_id, description, start_ts);
  const entry = db.prepare(`${SELECT_ENTRY} WHERE e.id = ?`).get(info.lastInsertRowid);
  res.status(201).json({ entry });
});

// Timer stoppen (Ausstempeln)
router.post('/stop', (req, res) => {
  const running = db
    .prepare('SELECT id FROM entries WHERE user_id = ? AND end_ts IS NULL ORDER BY start_ts DESC LIMIT 1')
    .get(req.user.id);
  if (!running) return res.status(404).json({ error: 'Keine laufende Zeiterfassung' });

  const end_ts = new Date().toISOString();
  db.prepare('UPDATE entries SET end_ts = ? WHERE id = ?').run(end_ts, running.id);
  const entry = db.prepare(`${SELECT_ENTRY} WHERE e.id = ?`).get(running.id);
  res.json({ entry });
});

// Manuellen Eintrag anlegen
router.post('/', (req, res) => {
  const { project_id = null, description = '', start_ts, end_ts } = req.body || {};
  if (!isValidDate(start_ts) || !isValidDate(end_ts)) {
    return res.status(400).json({ error: 'Start- und Endzeit muessen gueltig sein' });
  }
  if (new Date(end_ts) <= new Date(start_ts)) {
    return res.status(400).json({ error: 'Die Endzeit muss nach der Startzeit liegen' });
  }

  const info = db
    .prepare('INSERT INTO entries (user_id, project_id, description, start_ts, end_ts) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.id, project_id || null, String(description).trim(),
         new Date(start_ts).toISOString(), new Date(end_ts).toISOString());
  const entry = db.prepare(`${SELECT_ENTRY} WHERE e.id = ?`).get(info.lastInsertRowid);
  res.status(201).json({ entry });
});

// Eintrag bearbeiten
router.put('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM entries WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Eintrag nicht gefunden' });

  const project_id = req.body?.project_id ?? existing.project_id;
  const description = req.body?.description !== undefined ? String(req.body.description).trim() : existing.description;
  const start_ts = req.body?.start_ts ?? existing.start_ts;
  const end_ts = req.body?.end_ts !== undefined ? req.body.end_ts : existing.end_ts;

  if (!isValidDate(start_ts)) return res.status(400).json({ error: 'Startzeit ungueltig' });
  if (end_ts && !isValidDate(end_ts)) return res.status(400).json({ error: 'Endzeit ungueltig' });
  if (end_ts && new Date(end_ts) <= new Date(start_ts)) {
    return res.status(400).json({ error: 'Die Endzeit muss nach der Startzeit liegen' });
  }

  db.prepare('UPDATE entries SET project_id = ?, description = ?, start_ts = ?, end_ts = ? WHERE id = ?')
    .run(project_id || null, description, new Date(start_ts).toISOString(),
         end_ts ? new Date(end_ts).toISOString() : null, existing.id);
  const entry = db.prepare(`${SELECT_ENTRY} WHERE e.id = ?`).get(existing.id);
  res.json({ entry });
});

// Eintrag loeschen
router.delete('/:id', (req, res) => {
  const info = db
    .prepare('DELETE FROM entries WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Eintrag nicht gefunden' });
  res.json({ ok: true });
});

// CSV-Export (nur abgeschlossene Eintraege)
router.get('/export.csv', (req, res) => {
  const rows = db
    .prepare(`${SELECT_ENTRY} WHERE e.user_id = ? AND e.end_ts IS NOT NULL ORDER BY e.start_ts DESC`)
    .all(req.user.id);

  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['Datum', 'Start', 'Ende', 'Dauer (Std)', 'Projekt', 'Beschreibung'];
  const lines = [header.map(esc).join(';')];

  for (const r of rows) {
    const start = new Date(r.start_ts);
    const end = new Date(r.end_ts);
    const hours = ((end - start) / 3_600_000).toFixed(2).replace('.', ',');
    lines.push([
      start.toLocaleDateString('de-DE'),
      start.toLocaleTimeString('de-DE'),
      end.toLocaleTimeString('de-DE'),
      hours,
      r.project_name || '',
      r.description || '',
    ].map(esc).join(';'));
  }

  const csv = '﻿' + lines.join('\r\n'); // BOM fuer Excel-Umlaute
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="zeiterfassung.csv"');
  res.send(csv);
});

export default router;
