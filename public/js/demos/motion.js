// 7. Motion - DeviceMotionEvent (acelerómetro y giroscopio)
// En iOS 13+ hay que pedir permiso con DeviceMotionEvent.requestPermission().
import { $, setStatus, describeError } from '../utils.js';

const SHAKE_THRESHOLD = 15;   // m/s² de aceleración (sin gravedad)
const SHAKE_COOLDOWN = 800;   // ms entre sacudidas

let listening = false;
let shakes = 0;
let lastShake = 0;
let gotData = false;
const ball = { x: 0, y: 0, vx: 0, vy: 0 };

function makeBars(container, labels, max) {
    container.innerHTML = labels.map((l) => `
        <div class="bar" data-axis="${l}" data-max="${max}">
            <span>${l}</span>
            <div class="track"><div class="fill"></div></div>
            <span class="val">0.00</span>
        </div>`).join('');
}

function setBars(container, obj) {
    if (!obj) return;
    container.querySelectorAll('.bar').forEach((bar) => {
        const v = obj[bar.dataset.axis] || 0;
        const max = +bar.dataset.max;
        const pct = Math.max(-1, Math.min(1, v / max)) * 50;
        const fill = bar.querySelector('.fill');
        fill.style.left = pct < 0 ? `${50 + pct}%` : '50%';
        fill.style.width = `${Math.abs(pct)}%`;
        bar.querySelector('.val').textContent = v.toFixed(2);
    });
}

function moveBall(g) {
    if (!g) return;
    const box = $('#motion-ball').parentElement;
    const maxX = box.clientWidth / 2 - 15;
    const maxY = box.clientHeight / 2 - 15;
    // La gravedad en X/Y indica hacia dónde está inclinado el teléfono
    ball.vx = (ball.vx - (g.x || 0) * 0.5) * 0.9;
    ball.vy = (ball.vy + (g.y || 0) * 0.5) * 0.9;
    ball.x = Math.max(-maxX, Math.min(maxX, ball.x + ball.vx));
    ball.y = Math.max(-maxY, Math.min(maxY, ball.y + ball.vy));
    $('#motion-ball').style.transform = `translate(${ball.x}px, ${ball.y}px)`;
}

function onMotion(e) {
    gotData = true;
    setBars($('#motion-acc'), e.acceleration);
    setBars($('#motion-grav'), e.accelerationIncludingGravity);
    setBars($('#motion-rot'), e.rotationRate);
    moveBall(e.accelerationIncludingGravity);

    const a = e.acceleration;
    if (a && a.x != null) {
        const force = Math.hypot(a.x, a.y, a.z);
        const now = Date.now();
        if (force > SHAKE_THRESHOLD && now - lastShake > SHAKE_COOLDOWN) {
            lastShake = now;
            shakes++;
            $('#motion-shakes').textContent = shakes;
            const box = $('#motion-shake');
            box.classList.add('hit');
            setTimeout(() => box.classList.remove('hit'), 300);
            if (navigator.vibrate) navigator.vibrate(150);
        }
    }
}

async function enable() {
    const status = $('#motion-status');
    try {
        if (typeof DeviceMotionEvent !== 'undefined' &&
            typeof DeviceMotionEvent.requestPermission === 'function') {
            const res = await DeviceMotionEvent.requestPermission();
            if (res !== 'granted') throw new Error('Permiso de movimiento denegado');
        }
        if (!listening) {
            window.addEventListener('devicemotion', onMotion);
            listening = true;
        }
        setStatus(status, 'Sensores activos. Mueve o agita el teléfono.', 'ok');
        setTimeout(() => {
            if (!gotData) setStatus(status, 'No llegan datos: este dispositivo no tiene acelerómetro.', 'err');
        }, 2000);
    } catch (err) {
        setStatus(status, 'Error: ' + describeError(err), 'err');
    }
}

function stop() {
    window.removeEventListener('devicemotion', onMotion);
    listening = false;
}

export default {
    id: 'motion',
    title: 'Motion',
    emoji: '📳',
    support() {
        return 'DeviceMotionEvent' in window ? 'yes' : 'no';
    },
    setup() {
        makeBars($('#motion-acc'), ['x', 'y', 'z'], 20);
        makeBars($('#motion-grav'), ['x', 'y', 'z'], 20);
        makeBars($('#motion-rot'), ['alpha', 'beta', 'gamma'], 360);
        $('#motion-start').addEventListener('click', enable);
        if (!('DeviceMotionEvent' in window)) {
            setStatus($('#motion-status'), 'DeviceMotionEvent no soportado.', 'err');
        }
    },
    leave: stop
};
