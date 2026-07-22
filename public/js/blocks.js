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
        code: e.kind_code || '',
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
      presence.push({ start: new Date(open.start_ts), end: new Date(p.start_ts), label: open.description || 'Anwesend', code: '0010' });
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
    for (const seg of segments) if (seg.end > seg.start) blocks.push({ start: seg.start, end: seg.end, label: pr.label, code: pr.code });
  }
  return blocks;
};

// Ist ein Block eine Abwesenheit (Urlaub/Gleittag)? -> erfuellt das Soll, keine Plus-Stunden
window.isAbsenceBlock = function (b) {
  return typeof window.isAbsenceCode === 'function' && window.isAbsenceCode(b.code);
};

// Pausen eines Tages = Vereinigung aus
//  a) ausdruecklichen Pause-Buchungen (zaehlen immer) und
//  b) Luecken zwischen den Anwesenheits-Zeiten (zwischen erstem Start und
//     letztem Ende des Tages) – fuer Stempel UND Intervall-Eintraege.
// Ein noch offenes "Kommen" (aktuell anwesend) zaehlt als Endpunkt mit.
window.computePauses = function (entries) {
  const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  // Rohe Anwesenheit (ohne Abzug der Pausen)
  const presence = [];
  for (const e of entries) {
    if (e.entry_type === 'punch' || e.entry_type === 'pause') continue;
    if (e.end_ts) presence.push({ start: new Date(e.start_ts), end: new Date(e.end_ts) });
  }
  const punches = entries
    .filter((e) => e.entry_type === 'punch')
    .sort((a, b) => new Date(a.start_ts) - new Date(b.start_ts));
  let open = null;
  for (const p of punches) {
    if (p.punch_dir === 'kommen') open = p;
    else if (p.punch_dir === 'gehen' && open) {
      presence.push({ start: new Date(open.start_ts), end: new Date(p.start_ts) });
      open = null;
    }
  }
  if (open) { const t = new Date(open.start_ts); presence.push({ start: t, end: t }); }

  // Luecken zwischen Anwesenheits-Segmenten je Tag
  const gaps = [];
  const segByDay = new Map();
  for (const s of presence) {
    const k = dayKey(s.start);
    if (!segByDay.has(k)) segByDay.set(k, []);
    segByDay.get(k).push(s);
  }
  for (const day of segByDay.values()) {
    day.sort((a, b) => a.start - b.start);
    for (let i = 1; i < day.length; i++) {
      if (day[i].start > day[i - 1].end) gaps.push({ start: day[i - 1].end, end: day[i].start });
    }
  }

  // Vereinigung aus Luecken + ausdruecklichen Pausen (ueberlappungsfrei zusammenfassen)
  const all = gaps.concat(explicitPauses(entries));
  const byDay = new Map();
  for (const iv of all) {
    const k = dayKey(iv.start);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(iv);
  }
  const result = [];
  for (const day of byDay.values()) {
    day.sort((a, b) => a.start - b.start);
    let cur = null;
    for (const iv of day) {
      if (!cur) { cur = { start: iv.start, end: iv.end }; continue; }
      if (iv.start <= cur.end) { if (iv.end > cur.end) cur.end = iv.end; }
      else { result.push(cur); cur = { start: iv.start, end: iv.end }; }
    }
    if (cur) result.push(cur);
  }
  return result;
};
