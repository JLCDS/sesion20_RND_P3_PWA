// 8. Multitouch - Pointer Events
// Cada puntero (dedo) se identifica por pointerId; se dibuja un círculo y un rastro por dedo.
import { $ } from '../utils.js';

const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#ff6b9a', '#34495e', '#95a5a6'];

const pointers = new Map(); // pointerId -> { x, y, color, path: [] }
let trails = [];            // rastros de dedos ya levantados
let colorIndex = 0;
let maxTouches = 0;
let ctx;
let rafId = 0;

function resize() {
    const canvas = $('#touch-canvas');
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
    ctx = canvas.getContext('2d');
    ctx.scale(devicePixelRatio, devicePixelRatio);
}

function point(e) {
    const r = e.target.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function updateCount() {
    maxTouches = Math.max(maxTouches, pointers.size);
    $('#touch-count').textContent = pointers.size;
    $('#touch-max').textContent = maxTouches;
}

function down(e) {
    e.preventDefault();
    e.target.setPointerCapture(e.pointerId);
    const p = point(e);
    pointers.set(e.pointerId, { ...p, color: COLORS[colorIndex++ % COLORS.length], path: [p], pressure: e.pressure });
    updateCount();
    if (navigator.vibrate) navigator.vibrate(15);
}

function move(e) {
    const ptr = pointers.get(e.pointerId);
    if (!ptr) return;
    const p = point(e);
    Object.assign(ptr, p, { pressure: e.pressure });
    ptr.path.push(p);
}

function up(e) {
    const ptr = pointers.get(e.pointerId);
    if (ptr) trails.push({ color: ptr.color, path: ptr.path });
    pointers.delete(e.pointerId);
    updateCount();
}

function strokePath(color, path) {
    if (path.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    path.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.stroke();
}

function render() {
    const canvas = $('#touch-canvas');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    trails.forEach((t) => strokePath(t.color, t.path));

    let i = 1;
    pointers.forEach((ptr) => {
        strokePath(ptr.color, ptr.path);
        const radius = 30 + (ptr.pressure || 0.5) * 20;
        ctx.fillStyle = ptr.color + '55';
        ctx.strokeStyle = ptr.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ptr.x, ptr.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i++, ptr.x, ptr.y);
    });
    rafId = requestAnimationFrame(render);
}

function clear() {
    trails = [];
    maxTouches = pointers.size;
    updateCount();
}

export default {
    id: 'touch',
    title: 'Multitouch',
    emoji: '✋',
    support() {
        if (navigator.maxTouchPoints > 1) return 'yes';
        return 'PointerEvent' in window ? 'partial' : 'no';
    },
    setup() {
        const canvas = $('#touch-canvas');
        canvas.addEventListener('pointerdown', down);
        canvas.addEventListener('pointermove', move);
        canvas.addEventListener('pointerup', up);
        canvas.addEventListener('pointercancel', up);
        // Evita el menú contextual por pulsación larga
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        $('#touch-clear').addEventListener('click', clear);
        window.addEventListener('resize', () => { if (!canvas.closest('[hidden]')) resize(); });
    },
    enter() {
        // Al mostrarse la sección el canvas ya tiene tamaño real
        requestAnimationFrame(() => {
            resize();
            cancelAnimationFrame(rafId);
            render();
        });
    },
    leave() {
        cancelAnimationFrame(rafId);
        pointers.clear();
    }
};
