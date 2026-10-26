// 9. ViewTransition - View Transition API (document.startViewTransition)
// Toda la navegación de la app ya usa transiciones (ver utils.withTransition).
// Aquí se muestran transiciones de "elemento compartido" usando view-transition-name.
import { $, setStatus, withTransition } from '../utils.js';

const HEROES = [
    { name: 'Iron Man', emoji: '🦾', color: '#c0392b', power: 'Armadura de alta tecnología' },
    { name: 'Spider-Man', emoji: '🕷️', color: '#2980b9', power: 'Sentido arácnido' },
    { name: 'Thor', emoji: '⚡', color: '#8e44ad', power: 'Control del trueno' },
    { name: 'Hulk', emoji: '💪', color: '#27ae60', power: 'Fuerza ilimitada' },
    { name: 'Wolverine', emoji: '🐺', color: '#d35400', power: 'Factor de curación' },
    { name: 'Black Panther', emoji: '🐆', color: '#2c3e50', power: 'Traje de vibranium' }
];

let order = HEROES.map((_, i) => i);
let gridView = false;
let selected = null;

const vtName = (i) => `hero-${i}`;

function renderList() {
    const list = $('#vt-list');
    list.classList.toggle('grid-view', gridView);
    list.hidden = selected !== null;
    list.innerHTML = '';
    order.forEach((i) => {
        const h = HEROES[i];
        const li = document.createElement('li');
        li.className = 'vt-item';
        // Cada tarjeta tiene un nombre único: el navegador anima su posición entre estados
        li.style.viewTransitionName = selected === i ? 'none' : vtName(i) + '-card';
        li.innerHTML = `
            <div class="vt-avatar" style="background:${h.color};view-transition-name:${selected === i ? 'none' : vtName(i)}">${h.emoji}</div>
            <div><strong>${h.name}</strong><br><small>${h.power}</small></div>`;
        li.addEventListener('click', () => open(i));
        list.appendChild(li);
    });
}

function renderDetail() {
    const detail = $('#vt-detail');
    detail.hidden = selected === null;
    if (selected === null) {
        detail.innerHTML = '';
        return;
    }
    const h = HEROES[selected];
    detail.innerHTML = `
        <div class="vt-avatar" style="background:${h.color};view-transition-name:${vtName(selected)}">${h.emoji}</div>
        <h2>${h.name}</h2>
        <p>${h.power}</p>
        <button class="btn">Cerrar</button>`;
    detail.querySelector('button').addEventListener('click', close);
}

function render() {
    renderList();
    renderDetail();
}

function open(i) {
    withTransition(() => { selected = i; render(); });
}

function close() {
    withTransition(() => { selected = null; render(); });
}

function shuffle() {
    withTransition(() => {
        for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [order[i], order[j]] = [order[j], order[i]];
        }
        renderList();
    });
}

function toggleView() {
    withTransition(() => {
        gridView = !gridView;
        renderList();
    });
}

export default {
    id: 'viewtransition',
    title: 'ViewTransition',
    emoji: '✨',
    support() {
        return document.startViewTransition ? 'yes' : 'no';
    },
    setup() {
        $('#vt-shuffle').addEventListener('click', shuffle);
        $('#vt-toggle').addEventListener('click', toggleView);
        setStatus($('#vt-status'), document.startViewTransition
            ? 'View Transition API soportada: los cambios se animan.'
            : 'Tu navegador no soporta View Transitions: los cambios ocurren sin animación.',
        document.startViewTransition ? 'ok' : 'err');
    },
    enter: render,
    leave() {
        selected = null;
    }
};
