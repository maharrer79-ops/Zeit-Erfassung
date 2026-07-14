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

function insertPunch(userId, dir, ts, description = '') {
  const label = dir === 'kommen' ? 'Kommen' : 'Gehen';
  const iso = new Date(ts).toISOString();
  const info = db
    .prepare(`INSERT INTO entries (user_id, description, kind_code, kind_label, entry_type, punch_dir, start_ts, end_ts)
              VALUES (?, ?, '0010', ?, 'punch', ?, ?, ?)`)
    .run(userId, String(description || '').trim(), label, dir, iso, iso);
  return db.prepare(`${SELECT_ENTRY} WHERE e.id = ?`).get(info.lastInsertRowid);
}

// Gearbeitete Zeitbloecke (Intervalle + gepaarte Kommen/Gehen) fuer die Ueberlappungspruefung
function userBlocks(userId, excludeIds = []) {
  const rows = db.prepare('SELECT id, entry_type, punch_dir, start_ts, end_ts FROM entries WHERE user_id = ?').all(userId);
  const ex = new Set(excludeIds.map(Number));
  const blocks = [];
  for (const e of rows) {
    if (ex.has(e.id)) continue;
    if (e.entry_type !== 'punch' && e.entry_type !== 'pause' && e.end_ts) {
      blocks.push({ s: +new Date(e.start_ts), e: +new Date(e.end_ts) });
    }
  }
  const punches = rows.filter((r) => r.entry_type === 'punch' && !ex.has(r.id))
    .sort((a, b) => new Date(a.start_ts) - new Date(b.start_ts));
  let open = null;
  for (const p of punches) {
    if (p.punch_dir === 'kommen') open = p;
    else if (p.punch_dir === 'gehen' && open) { blocks.push({ s: +new Date(open.start_ts), e: +new Date(p.start_ts) }); open = null; }
  }
  return blocks;
}
function rangeOverlaps(blocks, startTs, endTs) {
  const s = +new Date(startTs), e = +new Date(endTs);
  return blocks.some((b) => s < b.e && b.s < e);
}
function pointInBlock(blocks, ts) {
  const t = +new Date(ts);
  return blocks.some((b) => t > b.s && t < b.e);
}
const OVERLAP_MSG = 'Diese Zeit überschneidet sich mit einer bereits erfassten Zeit';

// Alle Eintraege (neueste zuerst)
router.get('/', (req, res) => {
  const rows = db
    .prepare(`${SELECT_ENTRY} WHERE e.user_id = ? ORDER BY e.start_ts DESC, e.id DESC`)
    .all(req.user.id);
  res.json({ entries: rows });
});

// Aktueller Anwesenheits-Zustand + laufende Pause – fuer den Live-Timer
router.get('/running', (req, res) => {
  const open = currentOpen(req.user.id);
  const pause = db
    .prepare("SELECT * FROM entries WHERE user_id = ? AND entry_type = 'pause' AND end_ts IS NULL ORDER BY start_ts DESC LIMIT 1")
    .get(req.user.id);
  res.json({ entry: open ? open.row : null, pause: pause || null });
});

// Pause starten (offene Pause) – wird beim Beenden zu einem Pause-Eintrag.
// Optionaler ts im Body erlaubt das Nachtragen zu einem gewaehlten Zeitpunkt.
router.post('/pause/start', (req, res) => {
  const running = db
    .prepare("SELECT id FROM entries WHERE user_id = ? AND entry_type = 'pause' AND end_ts IS NULL")
    .get(req.user.id);
  if (running) return res.status(409).json({ error: 'Es läuft bereits eine Pause' });
  const ts = req.body?.ts;
  if (ts && !isValidDate(ts)) return res.status(400).json({ error: 'Ungueltiger Zeitpunkt' });
  const iso = ts ? new Date(ts).toISOString() : new Date().toISOString();
  const info = db
    .prepare(`INSERT INTO entries (user_id, description, kind_code, kind_label, entry_type, start_ts, end_ts)
              VALUES (?, '', 'pause', 'Pause', 'pause', ?, NULL)`)
    .run(req.user.id, iso);
  res.status(201).json({ entry: db.prepare(`${SELECT_ENTRY} WHERE e.id = ?`).get(info.lastInsertRowid) });
});

// Pause beenden – schliesst die offene Pause. Optionaler ts fuers Nachtragen.
router.post('/pause/stop', (req, res) => {
  const running = db
    .prepare("SELECT * FROM entries WHERE user_id = ? AND entry_type = 'pause' AND end_ts IS NULL ORDER BY start_ts DESC LIMIT 1")
    .get(req.user.id);
  if (!running) return res.status(404).json({ error: 'Keine laufende Pause' });
  const ts = req.body?.ts;
  if (ts && !isValidDate(ts)) return res.status(400).json({ error: 'Ungueltiger Zeitpunkt' });
  const endIso = ts ? new Date(ts).toISOString() : new Date().toISOString();
  if (new Date(endIso) <= new Date(running.start_ts)) {
    return res.status(400).json({ error: 'Das Pausenende muss nach dem Pausenbeginn liegen' });
  }
  db.prepare('UPDATE entries SET end_ts = ? WHERE id = ?').run(endIso, running.id);
  res.json({ entry: db.prepare(`${SELECT_ENTRY} WHERE e.id = ?`).get(running.id) });
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
  if (pointInBlock(userBlocks(req.user.id), ts)) return res.status(409).json({ error: OVERLAP_MSG });
  const entry = insertPunch(req.user.id, dir, ts, req.body?.description);
  res.status(201).json({ entry });
});

// Kommen + Gehen als Zeitraum: legt beide Stempel als getrennte Positionen an
router.post('/session', (req, res) => {
  const { start_ts, end_ts, description } = req.body || {};
  if (!isValidDate(start_ts) || !isValidDate(end_ts)) {
    return res.status(400).json({ error: 'Start- und Endzeit muessen gueltig sein' });
  }
  if (new Date(end_ts) <= new Date(start_ts)) {
    return res.status(400).json({ error: 'Die Endzeit (Gehen) muss nach der Startzeit (Kommen) liegen' });
  }
  if (rangeOverlaps(userBlocks(req.user.id), start_ts, end_ts)) return res.status(409).json({ error: OVERLAP_MSG });
  const kommen = insertPunch(req.user.id, 'kommen', start_ts, description);
  const gehen = insertPunch(req.user.id, 'gehen', end_ts, description);
  res.status(201).json({ entries: [kommen, gehen] });
});

// Pause eintragen: eigener Eintrag (Typ 'pause'); wird von der Arbeitszeit abgezogen
router.post('/pause', (req, res) => {
  const { start_ts, end_ts, description } = req.body || {};
  if (!isValidDate(start_ts) || !isValidDate(end_ts)) {
    return res.status(400).json({ error: 'Pausenbeginn und -ende muessen gueltig sein' });
  }
  if (new Date(end_ts) <= new Date(start_ts)) {
    return res.status(400).json({ error: 'Das Pausenende muss nach dem Pausenbeginn liegen' });
  }
  const info = db
    .prepare(`INSERT INTO entries (user_id, description, kind_code, kind_label, entry_type, start_ts, end_ts)
              VALUES (?, ?, 'pause', 'Pause', 'pause', ?, ?)`)
    .run(req.user.id, String(description || '').trim(),
         new Date(start_ts).toISOString(), new Date(end_ts).toISOString());
  const entry = db.prepare(`${SELECT_ENTRY} WHERE e.id = ?`).get(info.lastInsertRowid);
  res.status(201).json({ entry });
});

// Mehrtaegige Absenz (z.B. Urlaub) ueber einen Zeitraum: ein Eintrag pro Tag
router.post('/absence', (req, res) => {
  const { kind_code, description = '', project_id = null, days } = req.body || {};
  if (!Array.isArray(days) || days.length === 0) {
    return res.status(400).json({ error: 'Kein Zeitraum angegeben' });
  }
  if (days.length > 366) {
    return res.status(400).json({ error: 'Zeitraum zu lang (max. 366 Tage)' });
  }
  const blocks = userBlocks(req.user.id);
  const kind = resolveKind(kind_code);
  const insert = db.prepare(`INSERT INTO entries (user_id, project_id, description, kind_code, kind_label, entry_type, start_ts, end_ts)
              VALUES (?, ?, ?, ?, ?, 'interval', ?, ?)`);
  try {
    const tx = db.transaction((rows) => {
      for (const d of rows) {
        if (!isValidDate(d.start_ts) || !isValidDate(d.end_ts) || new Date(d.end_ts) <= new Date(d.start_ts)) {
          throw new Error('INVALID');
        }
        if (rangeOverlaps(blocks, d.start_ts, d.end_ts)) throw new Error('OVERLAP');
        insert.run(req.user.id, project_id || null, String(description).trim(), kind.code, kind.label,
          new Date(d.start_ts).toISOString(), new Date(d.end_ts).toISOString());
      }
    });
    tx(days);
  } catch (err) {
    if (err.message === 'OVERLAP') return res.status(409).json({ error: OVERLAP_MSG });
    return res.status(400).json({ error: 'Zeitraum ungueltig' });
  }
  res.status(201).json({ count: days.length });
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
  if (rangeOverlaps(userBlocks(req.user.id), start_ts, end_ts)) return res.status(409).json({ error: OVERLAP_MSG });

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

  // Stempel: Zeitpunkt, Richtung und Beschreibung
  if (existing.entry_type === 'punch') {
    const ts = req.body?.start_ts ?? existing.start_ts;
    if (!isValidDate(ts)) return res.status(400).json({ error: 'Zeitpunkt ungueltig' });
    if (pointInBlock(userBlocks(req.user.id, [existing.id]), ts)) return res.status(409).json({ error: OVERLAP_MSG });
    const dir = req.body?.punch_dir === 'gehen' ? 'gehen'
      : (req.body?.punch_dir === 'kommen' ? 'kommen' : existing.punch_dir);
    const description = req.body?.description !== undefined ? String(req.body.description).trim() : existing.description;
    const iso = new Date(ts).toISOString();
    db.prepare('UPDATE entries SET start_ts = ?, end_ts = ?, punch_dir = ?, kind_label = ?, description = ? WHERE id = ?')
      .run(iso, iso, dir, dir === 'kommen' ? 'Kommen' : 'Gehen', description, existing.id);
    return res.json({ entry: db.prepare(`${SELECT_ENTRY} WHERE e.id = ?`).get(existing.id) });
  }

  // Pause: Zeitraum und Beschreibung (ohne Ueberlappungspruefung, Typ bleibt)
  if (existing.entry_type === 'pause') {
    const s = req.body?.start_ts ?? existing.start_ts;
    const e = req.body?.end_ts ?? existing.end_ts;
    if (!isValidDate(s) || !isValidDate(e)) return res.status(400).json({ error: 'Zeit ungueltig' });
    if (new Date(e) <= new Date(s)) return res.status(400).json({ error: 'Das Pausenende muss nach dem Pausenbeginn liegen' });
    const description = req.body?.description !== undefined ? String(req.body.description).trim() : existing.description;
    db.prepare('UPDATE entries SET start_ts = ?, end_ts = ?, description = ? WHERE id = ?')
      .run(new Date(s).toISOString(), new Date(e).toISOString(), description, existing.id);
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
  if (end_ts && rangeOverlaps(userBlocks(req.user.id, [existing.id]), start_ts, end_ts)) {
    return res.status(409).json({ error: OVERLAP_MSG });
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
      lines.push([
        start.toLocaleDateString('de-DE'),
        start.toLocaleTimeString('de-DE'),
        '', '',
        r.kind_label || '', r.kind_code || '',
        '', r.description || '',
      ].map(esc).join(';'));
      continue;
    }
    if (!r.end_ts) continue;
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
