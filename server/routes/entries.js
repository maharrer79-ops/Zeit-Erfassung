import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';
import { resolveKind } from '../booking-types.js';

const router = Router();
router.use(requireAuth);

const SELECT_ENTRY = `
  SELECT e.id, e.project_id, e.description, e.kind_code, e.kind_label,
         e.entry_type, e.punch_dir, e.start_ts, e.end_ts, e.created_at,
         p.name AS project_name, p.color AS project_color
  FROM entries e
  LEFT JOIN projects p ON p.id = e.project_id
`;

function isValidDate(v) {
  return v && !Number.isNaN(new Date(v).getTime());
}

// Aktuell "offener" Zustand des Nutzers:
//  - ein noch laufender (alter) Intervall-Eintrag ODER
//  - der letzte Stempel ist ein "Kommen" (Person ist anwesend)
function currentOpen(userId) {
  const openInterval = db
    .prepare("SELECT * FROM entries WHERE user_id = ? AND entry_type = 'interval' AND end_ts IS NULL ORDER BY start_ts DESC LIMIT 1")
    .get(userId);
  if (openInterval) return { type: 'interval', row: openInterval };

  const lastPunch = db
    .prepare("SELECT * FROM entries WHERE user_id = ? AND entry_type = 'punch' ORDER BY start_ts DESC, id DESC LIMIT 1")
    .get(userId);
  if (lastPunch && lastPunch.punch_dir === 'kommen') return { type: 'punch', row: lastPunch };
  return null;
}

function insertPunch(userId, dir, ts) {
  const label = dir === 'kommen' ? 'Kommen' : 'Gehen';
  const iso = new Date(ts).toISOString();
  const info = db
    .prepare(`INSERT INTO entries (user_id, description, kind_code, kind_label, entry_type, punch_dir, start_ts, end_ts)
              VALUES (?, '', '0010', ?, 'punch', ?, ?, ?)`)
    .run(userId, label, dir, iso, iso);
  return db.prepare(`${SELECT_ENTRY} WHERE e.id = ?`).get(info.lastInsertRowid);
}

// Alle Eintraege (neueste zuerst)
router.get('/', (req, res) => {
  const rows = db
    .prepare(`${SELECT_ENTRY} WHERE e.user_id = ? ORDER BY e.start_ts DESC, e.id DESC`)
    .all(req.user.id);
  res.json({ entries: rows });
});

// Aktueller Anwesenheits-Zustand – fuer den Live-Timer
router.get('/running', (req, res) => {
  const open = currentOpen(req.user.id);
  res.json({ entry: open ? open.row : null });
});

// Kommen (Einstempeln) – erzeugt eine eigene Position
router.post('/start', (req, res) => {
  if (currentOpen(req.user.id)) {
    return res.status(409).json({ error: 'Du bist bereits eingestempelt' });
  }
  const entry = insertPunch(req.user.id, 'kommen', new Date().toISOString());
  res.status(201).json({ entry });
});

// Gehen (Ausstempeln) – erzeugt eine eigene Position
router.post('/stop', (req, res) => {
  const open = currentOpen(req.user.id);
  if (!open) return res.status(404).json({ error: 'Du bist nicht eingestempelt' });

  // Alten laufenden Intervall-Eintrag noch sauber schliessen
  if (open.type === 'interval') {
    db.prepare('UPDATE entries SET end_ts = ? WHERE id = ?').run(new Date().toISOString(), open.row.id);
    const entry = db.prepare(`${SELECT_ENTRY} WHERE e.id = ?`).get(open.row.id);
    return res.json({ entry });
  }
  const entry = insertPunch(req.user.id, 'gehen', new Date().toISOString());
  res.json({ entry });
});

// Einzelnen Stempel (Kommen/Gehen) nachtragen
router.post('/punch', (req, res) => {
  const dir = req.body?.dir === 'gehen' ? 'gehen' : (req.body?.dir === 'kommen' ? 'kommen' : null);
  const ts = req.body?.ts;
  if (!dir) return res.status(400).json({ error: 'Bitte Kommen oder Gehen angeben' });
  if (!isValidDate(ts)) return res.status(400).json({ error: 'Ungueltiger Zeitpunkt' });
  const entry = insertPunch(req.user.id, dir, ts);
  res.status(201).json({ entry });
});

// Kommen + Gehen als Zeitraum: legt beide Stempel als getrennte Positionen an
router.post('/session', (req, res) => {
  const { start_ts, end_ts } = req.body || {};
  if (!isValidDate(start_ts) || !isValidDate(end_ts)) {
    return res.status(400).json({ error: 'Start- und Endzeit muessen gueltig sein' });
  }
  if (new Date(end_ts) <= new Date(start_ts)) {
    return res.status(400).json({ error: 'Die Endzeit (Gehen) muss nach der Startzeit (Kommen) liegen' });
  }
  const kommen = insertPunch(req.user.id, 'kommen', start_ts);
  const gehen = insertPunch(req.user.id, 'gehen', end_ts);
  res.status(201).json({ entries: [kommen, gehen] });
});

// Manuellen Eintrag anlegen (Intervall mit Buchungsart, z.B. Urlaub/Dienstreise)
router.post('/', (req, res) => {
  const { project_id = null, description = '', kind_code, start_ts, end_ts } = req.body || {};
  if (!isValidDate(start_ts) || !isValidDate(end_ts)) {
    return res.status(400).json({ error: 'Start- und Endzeit muessen gueltig sein' });
  }
  if (new Date(end_ts) <= new Date(start_ts)) {
    return res.status(400).json({ error: 'Die Endzeit muss nach der Startzeit liegen' });
  }

  const kind = resolveKind(kind_code);
  const info = db
    .prepare(`INSERT INTO entries (user_id, project_id, description, kind_code, kind_label, entry_type, start_ts, end_ts)
              VALUES (?, ?, ?, ?, ?, 'interval', ?, ?)`)
    .run(req.user.id, project_id || null, String(description).trim(), kind.code, kind.label,
         new Date(start_ts).toISOString(), new Date(end_ts).toISOString());
  const entry = db.prepare(`${SELECT_ENTRY} WHERE e.id = ?`).get(info.lastInsertRowid);
  res.status(201).json({ entry });
});

// Eintrag bearbeiten (Intervall ODER Stempel)
router.put('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM entries WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Eintrag nicht gefunden' });

  // Stempel: nur Zeitpunkt und Richtung
  if (existing.entry_type === 'punch') {
    const ts = req.body?.start_ts ?? existing.start_ts;
    if (!isValidDate(ts)) return res.status(400).json({ error: 'Zeitpunkt ungueltig' });
    const dir = req.body?.punch_dir === 'gehen' ? 'gehen'
      : (req.body?.punch_dir === 'kommen' ? 'kommen' : existing.punch_dir);
    const iso = new Date(ts).toISOString();
    db.prepare('UPDATE entries SET start_ts = ?, end_ts = ?, punch_dir = ?, kind_label = ? WHERE id = ?')
      .run(iso, iso, dir, dir === 'kommen' ? 'Kommen' : 'Gehen', existing.id);
    return res.json({ entry: db.prepare(`${SELECT_ENTRY} WHERE e.id = ?`).get(existing.id) });
  }

  const project_id = req.body?.project_id ?? existing.project_id;
  const description = req.body?.description !== undefined ? String(req.body.description).trim() : existing.description;
  const start_ts = req.body?.start_ts ?? existing.start_ts;
  const end_ts = req.body?.end_ts !== undefined ? req.body.end_ts : existing.end_ts;
  const kind = req.body?.kind_code !== undefined
    ? resolveKind(req.body.kind_code)
    : { code: existing.kind_code, label: existing.kind_label };

  if (!isValidDate(start_ts)) return res.status(400).json({ error: 'Startzeit ungueltig' });
  if (end_ts && !isValidDate(end_ts)) return res.status(400).json({ error: 'Endzeit ungueltig' });
  if (end_ts && new Date(end_ts) <= new Date(start_ts)) {
    return res.status(400).json({ error: 'Die Endzeit muss nach der Startzeit liegen' });
  }

  db.prepare('UPDATE entries SET project_id = ?, description = ?, kind_code = ?, kind_label = ?, start_ts = ?, end_ts = ? WHERE id = ?')
    .run(project_id || null, description, kind.code, kind.label, new Date(start_ts).toISOString(),
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

// CSV-Export
router.get('/export.csv', (req, res) => {
  const rows = db
    .prepare(`${SELECT_ENTRY} WHERE e.user_id = ? ORDER BY e.start_ts DESC, e.id DESC`)
    .all(req.user.id);

  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['Datum', 'Start', 'Ende', 'Dauer (Std)', 'Buchungsart', 'Code', 'Projekt', 'Beschreibung'];
  const lines = [header.map(esc).join(';')];

  for (const r of rows) {
    const start = new Date(r.start_ts);
    if (r.entry_type === 'punch') {
      // Stempel: eigene Zeile, keine Dauer
      lines.push([
        start.toLocaleDateString('de-DE'),
        start.toLocaleTimeString('de-DE'),
        '', '',
        r.kind_label || '', r.kind_code || '',
        '', '',
      ].map(esc).join(';'));
      continue;
    }
    if (!r.end_ts) continue; // laufender Intervall-Eintrag: ueberspringen
    const end = new Date(r.end_ts);
    const hours = ((end - start) / 3_600_000).toFixed(2).replace('.', ',');
    lines.push([
      start.toLocaleDateString('de-DE'),
      start.toLocaleTimeString('de-DE'),
      end.toLocaleTimeString('de-DE'),
      hours,
      r.kind_label || '', r.kind_code || '',
      r.project_name || '', r.description || '',
    ].map(esc).join(';'));
  }

  const csv = '﻿' + lines.join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="zeiterfassung.csv"');
  res.send(csv);
});

export default router;
