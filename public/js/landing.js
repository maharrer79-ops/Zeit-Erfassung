// Landingpage: Auth-Modal + Login/Registrierung
document.getElementById('year').textContent = new Date().getFullYear();

const modal = document.getElementById('auth-modal');
const form = document.getElementById('auth-form');
const msg = document.getElementById('auth-msg');
const title = document.getElementById('auth-title');
const nameField = document.getElementById('name-field');
const tabs = document.querySelectorAll('.tabs button');
let mode = 'login';

function setMode(next) {
  mode = next;
  tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === next));
  nameField.style.display = next === 'register' ? 'block' : 'none';
  nameField.querySelector('input').required = next === 'register';
  title.textContent = next === 'register' ? 'Account erstellen' : 'Willkommen zurück';
  form.querySelector('input[name=password]').autocomplete =
    next === 'register' ? 'new-password' : 'current-password';
  msg.className = 'form-msg';
  msg.textContent = '';
}

function openModal(next) {
  setMode(next);
  modal.classList.add('open');
}
function closeModal() { modal.classList.remove('open'); }

document.querySelectorAll('[data-auth]').forEach((btn) =>
  btn.addEventListener('click', () => openModal(btn.dataset.auth))
);
tabs.forEach((t) => t.addEventListener('click', () => setMode(t.dataset.tab)));
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;
  msg.className = 'form-msg';

  try {
    const res = await fetch(`/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Etwas ist schiefgelaufen');
    window.location.href = '/app';
  } catch (err) {
    msg.className = 'form-msg error';
    msg.textContent = err.message;
    btn.disabled = false;
  }
});

// Bereits angemeldet? Direkt zur App-Option anbieten
fetch('/api/auth/me').then((r) => {
  if (r.ok) {
    document.querySelectorAll('.nav-links').forEach((n) => {
      n.innerHTML = '<a class="btn btn-light" href="/app">Zur App →</a>';
    });
  }
});

// Kleine Deko: Demo-Timer auf der Landingpage laufen lassen
let s = 2 * 3600 + 14 * 60 + 37;
const demo = document.getElementById('demo-timer');
setInterval(() => {
  s++;
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  if (demo) demo.textContent = `${h}:${m}:${sec}`;
}, 1000);
