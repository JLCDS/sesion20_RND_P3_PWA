// 7. Motion - Acelerómetro y giroscopio
// Se intenta en este orden:
//   1. Generic Sensor API (LinearAccelerationSensor, Accelerometer, Gyroscope) -> Chrome Android.
//      Pide/valida el permiso de "Sensores de movimiento" y reporta errores claros.
//   2. DeviceMotionEvent -> resto de navegadores.
// DeviceMotionEvent.requestPermission() existe en iOS 13+ (muestra diálogo) y en Chrome reciente
// (NO muestra diálogo: devuelve 'denied' si el sitio tiene bloqueados los "Sensores de movimiento").
import { $, setStatus, describeError, sensorPermissionHelp } from '../utils.js';

const SHAKE_THRESHOLD = 15;   // m/s² de aceleración (sin gravedad)
const SHAKE_COOLDOWN = 800;   // ms entre sacudidas
const NO_DATA_TIMEOUT = 3000;
const RAD_TO_DEG = 180 / Math.PI;

let mode = null;        // 'sensor' | 'devicemotion'
let sensors = [];
let shakes = 0;
let lastShake = 0;
let gotData = false;
let noDataTimer = 0;
const latest = { acc: null, grav: null, rot: null };
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

function detectShake(a) {
    if (!a || a.x == null) return;
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

// Punto único donde llegan los datos, vengan del Generic Sensor API o de devicemotion
function render({ acc, grav, rot }) {
    if (!gotData) {
        gotData = true;
        clearTimeout(noDataTimer);
        setStatus($('#motion-status'),
            `Sensores activos (${mode === 'sensor' ? 'Generic Sensor API' : 'DeviceMotionEvent'}). Mueve o agita el teléfono.`, 'ok');
    }
    if (acc) setBars($('#motion-acc'), acc);
    if (grav) setBars($('#motion-grav'), grav);
    if (rot) setBars($('#motion-rot'), rot);
    moveBall(grav);
    detectShake(acc);
}

function onDeviceMotion(e) {
    // Algunos equipos sin sensor disparan el evento con todos los valores en null
    const g = e.accelerationIncludingGravity;
    if (!g || g.x == null) return;
    render({ acc: e.acceleration, grav: g, rot: e.rotationRate });
}

// ---------- Permisos ----------
async function queryPermissions() {
    if (!navigator.permissions) return 'unknown';
    try {
        const names = ['accelerometer', 'gyroscope'];
        const states = await Promise.all(names.map((name) => navigator.permissions.query({ name })));
        if (states.some((s) => s.state === 'denied')) return 'denied';
        if (states.every((s) => s.state === 'granted')) return 'granted';
        return 'prompt';
    } catch {
        return 'unknown';   // el navegador no reconoce esos nombres de permiso
    }
}

function fail(msg) {
    stop();
    setStatus($('#motion-status'), msg + ' ' + sensorPermissionHelp(), 'err');
}

// ---------- Generic Sensor API ----------
function startGenericSensors() {
    return new Promise((resolve, reject) => {
        const freq = { frequency: 60 };
        const linear = 'LinearAccelerationSensor' in window ? new LinearAccelerationSensor(freq) : null;
        const accel = new Accelerometer(freq);
        const gyro = 'Gyroscope' in window ? new Gyroscope(freq) : null;
        sensors = [linear, accel, gyro].filter(Boolean);

        let started = 0;
        sensors.forEach((s) => {
            s.addEventListener('activate', () => { if (++started === 1) resolve(); });
            s.addEventListener('error', (e) => {
                if (!started) return reject(e.error);
                // Un sensor falló después de que otro ya arrancó: solo se avisa si es por permisos
                if (e.error.name === 'NotAllowedError') fail('Permiso de sensores denegado.');
            });
        });

        accel.addEventListener('reading', () => {
            latest.grav = { x: accel.x, y: accel.y, z: accel.z };
            render(latest);
        });
        if (linear) linear.addEventListener('reading', () => {
            latest.acc = { x: linear.x, y: linear.y, z: linear.z };
        });
        if (gyro) gyro.addEventListener('reading', () => {
            // Gyroscope entrega rad/s; devicemotion usa °/s con alpha=Z, beta=X, gamma=Y
            latest.rot = { alpha: gyro.z * RAD_TO_DEG, beta: gyro.x * RAD_TO_DEG, gamma: gyro.y * RAD_TO_DEG };
        });

        sensors.forEach((s) => s.start());
    });
}

// ---------- Activar ----------
async function enable() {
    const status = $('#motion-status');
    stop();
    gotData = false;

    try {
        // iOS: el diálogo de permiso solo aparece si se llama directo desde el toque del usuario
        if (typeof DeviceMotionEvent !== 'undefined' &&
            typeof DeviceMotionEvent.requestPermission === 'function') {
            const res = await DeviceMotionEvent.requestPermission();
            if (res !== 'granted') return fail('Permiso de movimiento denegado.');
        }

        const perm = await queryPermissions();
        if (perm === 'denied') {
            return fail('El permiso de "Sensores de movimiento" está bloqueado para este sitio.');
        }

        setStatus(status, 'Esperando datos de los sensores…');
        // El temporizador va antes de arrancar: algunos equipos nunca activan el sensor ni dan error
        noDataTimer = setTimeout(() => {
            if (!gotData) fail('No llegan datos de los sensores. Si es un PC, no tiene acelerómetro; si es un celular, el permiso puede estar bloqueado.');
        }, NO_DATA_TIMEOUT);

        if ('Accelerometer' in window) {
            try {
                mode = 'sensor';
                const timeout = new Promise((_, reject) => setTimeout(
                    () => reject(new DOMException('El sensor no se activó', 'TimeoutError')), 1500));
                await Promise.race([startGenericSensors(), timeout]);
            } catch (err) {
                stopSensors();
                if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
                    return fail('Permiso de sensores denegado (' + err.name + ').');
                }
                // NotReadableError / NotSupportedError: el equipo no expone ese sensor -> devicemotion
                console.warn('Generic Sensor API no disponible, uso devicemotion', err);
                mode = null;
            }
        }

        if (!mode) {
            mode = 'devicemotion';
            window.addEventListener('devicemotion', onDeviceMotion);
        }
    } catch (err) {
        fail('Error: ' + describeError(err) + '.');
    }
}

function stopSensors() {
    sensors.forEach((s) => { try { s.stop(); } catch { /* ya detenido */ } });
    sensors = [];
}

function stop() {
    clearTimeout(noDataTimer);
    stopSensors();
    window.removeEventListener('devicemotion', onDeviceMotion);
    mode = null;
    latest.acc = latest.grav = latest.rot = null;
}

export default {
    id: 'motion',
    title: 'Motion',
    emoji: '📳',
    support() {
        return 'Accelerometer' in window || 'DeviceMotionEvent' in window ? 'yes' : 'no';
    },
    setup() {
        makeBars($('#motion-acc'), ['x', 'y', 'z'], 20);
        makeBars($('#motion-grav'), ['x', 'y', 'z'], 20);
        makeBars($('#motion-rot'), ['alpha', 'beta', 'gamma'], 360);
        $('#motion-start').addEventListener('click', enable);
        if (!('Accelerometer' in window) && !('DeviceMotionEvent' in window)) {
            setStatus($('#motion-status'), 'Este navegador no soporta sensores de movimiento.', 'err');
        }
    },
    leave: stop,
    onHidden: stop
};
