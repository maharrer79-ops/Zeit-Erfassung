// Ausdrueckliche Pause-Eintraege (Typ 'pause')
function explicitPauses(entries) {
  return entries
    .filter((e) => e.entry_type === 'pause' && e.end_ts)
    .map((e) => ({ start: new Date(e.start_ts), end: new Date(e.end_ts) }));
}

// Wandelt Eintraege in gearbeitete Zeitbloecke um:
//  - Intervall-Eintraege (Von–Bis) und gepaarte Kommen/Gehen-Stempel = Anwesenheit
//  - ausdrueckliche Pausen (Typ 'pause') werden herausgeschnitten
// Rueckgabe: Array von { start: Date, end: Date, label: string }
window.computeBlocks = function (entries) {
  const presence = [];

  for (const e of entries) {
    if (e.entry_type === 'punch' || e.entry_type === 'pause') continue;
    if (e.end_ts) {
      presence.push({
        start: new Date(e.start_ts),
        end: new Date(e.end_ts),
        label: e.description || e.kind_label || e.project_name || '',
      });
    }
  }

  const punches = entries
    .filter((e) => e.entry_type === 'punch')
    .sort((a, b) => new Date(a.start_ts) - new Date(b.start_ts));
  let open = null;
  for (const p of punches) {
    if (p.punch_dir === 'kommen') open = p;
    else if (p.punch_dir === 'gehen' && open) {
      presence.push({ start: new Date(open.start_ts), end: new Date(p.start_ts), label: open.description || 'Anwesend' });
      open = null;
    }
  }

  const pauses = explicitPauses(entries);
  const blocks = [];
  for (const pr of presence) {
    let segments = [{ start: pr.start, end: pr.end }];
    for (const pz of pauses) {
      const next = [];
      for (const seg of segments) {
        if (pz.end <= seg.start || pz.start >= seg.end) { next.push(seg); continue; }
        if (pz.start > seg.start) next.push({ start: seg.start, end: new Date(Math.min(+pz.start, +seg.end)) });
        if (pz.end < seg.end) next.push({ start: new Date(Math.max(+pz.end, +seg.start)), end: seg.end });
      }
      segments = next;
    }
    for (const seg of segments) if (seg.end > seg.start) blocks.push({ start: seg.start, end: seg.end, label: pr.label });
  }
  return blocks;
};

// Pausen eines Tages = Luecken ZWISCHEN den Arbeitsbloecken (zwischen erstem
// Start und letztem Ende des Tages). Gilt fuer Stempel UND Intervall-Eintraege.
// Ein noch offenes "Kommen" (aktuell anwesend) zaehlt als Endpunkt mit, damit
// die Pause schon waehrend des Tages sichtbar ist.
window.computePauses = function (entries) {
  const segs = window.computeBlocks(entries).map((b) => ({ start: b.start, end: b.end }));

  const punches = entries
    .filter((e) => e.entry_type === 'punch')
    .sort((a, b) => new Date(a.start_ts) - new Date(b.start_ts));
  let open = null;
  for (const p of punches) {
    if (p.punch_dir === 'kommen') open = p;
    else if (p.punch_dir === 'gehen') open = null;
  }
  if (open) { const t = new Date(open.start_ts); segs.push({ start: t, end: t }); }

  const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const byDay = new Map();
  for (const s of segs) {
    const k = dayKey(s.start);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(s);
  }

  const pauses = [];
  for (const day of byDay.values()) {
    day.sort((a, b) => a.start - b.start);
    for (let i = 1; i < day.length; i++) {
      const gapStart = day[i - 1].end;
      const gapEnd = day[i].start;
      if (gapEnd > gapStart) pauses.push({ start: gapStart, end: gapEnd });
    }
  }
  return pauses;
};
