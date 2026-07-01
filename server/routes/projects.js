import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

// Alle Projekte des angemeldeten Accounts
router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT id, name, color, created_at FROM projects WHERE user_id = ? ORDER BY name COLLATE NOCASE')
    .all(req.user.id);
  res.json({ projects: rows });
});

// Projekt anlegen
router.post('/', (req, res) => {
  const name = (req.body?.name || '').trim();
  const color = (req.body?.color || '#4f46e5').trim();
  if (!name) return res.status(400).json({ error: 'Projektname ist erforderlich' });

  const info = db
    .prepare('INSERT INTO projects (user_id, name, color) VALUES (?, ?, ?)')
    .run(req.user.id, name, color);
  const project = db.prepare('SELECT id, name, color, created_at FROM projects WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ project });
});

// Projekt loeschen
router.delete('/:id', (req, res) => {
  const info = db
    .prepare('DELETE FROM projects WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Projekt nicht gefunden' });
  res.json({ ok: true });
});

export default router;
