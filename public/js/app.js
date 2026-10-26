import { $, toast, withTransition } from './utils.js';
import auth from './demos/auth.js';
import face from './demos/face.js';
import barcode from './demos/barcode.js';
import screen from './demos/screen.js';
import audio from './demos/audio.js';
import orientation from './demos/orientation.js';
import motion from './demos/motion.js';
import touch from './demos/touch.js';
import viewtransition from './demos/viewtransition.js';

// Cada demo exporta: { id, title, emoji, support(), setup(), leave() }
const DEMOS = [auth, face, barcode, screen, audio, orientation, motion, touch, viewtransition];
const initialized = new Set();
let current = 'home';

// ---------- Service Worker ----------
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .catch((err) => console.warn('SW no registrado', err));
    });
}

// ---------- Instalación (A2HS) ----------
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    $('#install-btn').hidden = false;
});
$('#install-btn').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $('#install-btn').hidden = true;
});

// ---------- Estado de conexión ----------
function updateOnline() {
    const badge = $('#online-badge');
    badge.textContent = navigator.onLine ? 'online' : 'offline';
    badge.classList.toggle('off', !navigator.onLine);
}
window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);
updateOnline();

// ---------- Home: tarjetas ----------
const SUPPORT_TEXT = { yes: 'Soportado', partial: 'Parcial', no: 'No soportado' };

function renderGrid() {
    const grid = $('#demo-grid');
    DEMOS.forEach((demo, i) => {
        const level = demo.support();
        const btn = document.createElement('button');
        btn.className = 'card';
        btn.innerHTML = `
            <span class="num">${i + 1}</span>
            <span class="emoji">${demo.emoji}</span>
            <strong>${demo.title}</strong>
            <span class="support ${level}">${SUPPORT_TEXT[level]}</span>`;
        btn.addEventListener('click', () => go(demo.id));
        grid.appendChild(btn);
    });
}

// ---------- Navegación con View Transitions ----------
function show(id) {
    const prev = DEMOS.find((d) => d.id === current);
    if (prev) prev.leave();

    document.querySelectorAll('.page').forEach((p) => { p.hidden = p.id !== id; });
    const demo = DEMOS.find((d) => d.id === id);
    $('#page-title').textContent = demo ? demo.title : 'Recursos Nativos';
    $('#back-btn').hidden = !demo;

    if (demo && !initialized.has(id)) {
        demo.setup();
        initialized.add(id);
    }
    if (demo && demo.enter) demo.enter();
    current = id;
    window.scrollTo(0, 0);
}

function go(id) {
    if (location.hash.slice(1) === id) return;
    location.hash = id === 'home' ? '' : id;
}

function targetFromHash() {
    const id = location.hash.slice(1);
    return DEMOS.some((d) => d.id === id) ? id : 'home';
}

function route() {
    const target = targetFromHash();
    if (target === current) return;
    const direction = target === 'home' ? 'nav-back' : 'nav-forward';
    // Se lee el hash dentro del callback: si el usuario navega rápido, gana el último destino
    withTransition(() => {
        const latest = targetFromHash();
        if (latest !== current) show(latest);
    }, direction);
}

$('#back-btn').addEventListener('click', () => {
    if (history.length > 1) history.back();
    else go('home');
});
window.addEventListener('hashchange', route);

// Libera cámaras/micrófono si la app pasa a segundo plano
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        const demo = DEMOS.find((d) => d.id === current);
        if (demo && demo.onHidden) demo.onHidden();
    }
});

renderGrid();
if (targetFromHash() !== 'home') show(targetFromHash());
if (!window.isSecureContext) {
    toast('Abre la app por HTTPS o localhost: la mayoría de APIs lo requieren.');
}
