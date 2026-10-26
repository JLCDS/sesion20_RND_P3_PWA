// 6. Orientation - DeviceOrientationEvent + Screen Orientation API
// En iOS 13+ hay que pedir permiso explícito con DeviceOrientationEvent.requestPermission().
import { $, setStatus, describeError } from '../utils.js';

let listening = false;

function onOrientation(e) {
    const alpha = e.webkitCompassHeading != null ? 360 - e.webkitCompassHeading : e.alpha;
    const { beta, gamma } = e;
    if (alpha == null && beta == null) return;

    $('#o-alpha').textContent = (alpha || 0).toFixed(1) + '°';
    $('#o-beta').textContent = (beta || 0).toFixed(1) + '°';
    $('#o-gamma').textContent = (gamma || 0).toFixed(1) + '°';

    $('#orient-phone').style.transform =
        `rotateZ(${-(alpha || 0)}deg) rotateX(${beta || 0}deg) rotateY(${-(gamma || 0)}deg)`;
    $('#orient-needle').style.transform = `rotate(${alpha || 0}deg)`;
}

function updateScreen() {
    const o = screen.orientation;
    $('#o-screen').textContent = o ? `${o.type} (${o.angle}°)` : (window.orientation != null ? window.orientation + '°' : 'n/d');
}

async function enable() {
    const status = $('#orient-status');
    try {
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            const res = await DeviceOrientationEvent.requestPermission();
            if (res !== 'granted') throw new Error('Permiso de orientación denegado');
        }
        if (!listening) {
            const evt = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
            window.addEventListener(evt, onOrientation);
            listening = evt;
        }
        setStatus(status, 'Sensores activos. Inclina y gira el teléfono.', 'ok');
        // Si en 2s no llega ningún dato, el equipo no tiene giroscopio (p. ej. un PC)
        setTimeout(() => {
            if ($('#o-beta').textContent === '–') {
                setStatus(status, 'No llegan datos: este dispositivo no tiene sensor de orientación.', 'err');
            }
        }, 2000);
    } catch (err) {
        setStatus(status, 'Error: ' + describeError(err), 'err');
    }
}

async function lock() {
    const status = $('#orient-status');
    try {
        // lock() solo funciona en pantalla completa o con la PWA instalada
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
        }
        const type = screen.orientation.type.startsWith('portrait') ? 'portrait' : 'landscape';
        await screen.orientation.lock(type);
        setStatus(status, `Orientación bloqueada en ${type}.`, 'ok');
    } catch (err) {
        setStatus(status, 'No se pudo bloquear: ' + describeError(err), 'err');
    }
}

function unlock() {
    try { screen.orientation.unlock(); } catch { /* sin soporte */ }
    if (document.fullscreenElement) document.exitFullscreen();
    setStatus($('#orient-status'), 'Orientación desbloqueada.');
}

function stop() {
    if (listening) window.removeEventListener(listening, onOrientation);
    listening = false;
}

export default {
    id: 'orientation',
    title: 'Orientation',
    emoji: '🧭',
    support() {
        return 'DeviceOrientationEvent' in window ? 'yes' : 'no';
    },
    setup() {
        $('#orient-start').addEventListener('click', enable);
        $('#orient-lock').addEventListener('click', lock);
        $('#orient-unlock').addEventListener('click', unlock);
        if (screen.orientation) screen.orientation.addEventListener('change', updateScreen);
        else window.addEventListener('orientationchange', updateScreen);
        updateScreen();
        if (!('DeviceOrientationEvent' in window)) {
            setStatus($('#orient-status'), 'DeviceOrientationEvent no soportado.', 'err');
        }
    },
    leave: stop
};
