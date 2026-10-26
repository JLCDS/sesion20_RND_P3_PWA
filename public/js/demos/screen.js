// 4. Screen capture - Screen Capture API (getDisplayMedia) + MediaRecorder
// Disponible en navegadores de escritorio. Los navegadores móviles aún no lo implementan,
// por eso la tarjeta se marca como no soportada en el teléfono.
import { $, setStatus, describeError, stopStream, pickMimeType, formatBytes } from '../utils.js';

let stream = null;
let recorder = null;
let chunks = [];

const supported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);

async function start() {
    const status = $('#screen-status');
    stop();
    try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const video = $('#screen-video');
        video.srcObject = stream;
        // Si el usuario deja de compartir desde la barra del navegador
        stream.getVideoTracks()[0].addEventListener('ended', () => {
            stop();
            setStatus(status, 'El usuario dejó de compartir la pantalla.');
        });
        const settings = stream.getVideoTracks()[0].getSettings();
        setStatus(status, `Compartiendo: ${settings.displaySurface || 'pantalla'} (${settings.width}×${settings.height})`, 'ok');
    } catch (err) {
        setStatus(status, 'Error: ' + describeError(err), 'err');
    }
}

function screenshot() {
    const video = $('#screen-video');
    if (!stream) return setStatus($('#screen-status'), 'Primero comparte la pantalla.', 'err');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => addOutput(blob, 'img', 'captura.png'), 'image/png');
}

function record() {
    const status = $('#screen-status');
    if (!stream) return setStatus(status, 'Primero comparte la pantalla.', 'err');
    if (recorder && recorder.state === 'recording') {
        recorder.stop();
        return;
    }
    const mimeType = pickMimeType(['video/webm;codecs=vp9', 'video/webm', 'video/mp4']);
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunks = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType });
        const ext = recorder.mimeType.includes('mp4') ? 'mp4' : 'webm';
        addOutput(blob, 'video', `grabacion-pantalla.${ext}`);
        $('#screen-rec').textContent = 'Grabar';
        setStatus(status, 'Grabación finalizada.', 'ok');
    };
    recorder.start();
    $('#screen-rec').textContent = 'Parar grabación';
    setStatus(status, '● Grabando pantalla…', 'ok');
}

function addOutput(blob, kind, filename) {
    const url = URL.createObjectURL(blob);
    const wrap = document.createElement('div');
    const media = document.createElement(kind);
    media.src = url;
    if (kind === 'video') media.controls = true;
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.textContent = `Descargar ${filename} (${formatBytes(blob.size)})`;
    wrap.append(media, link);
    $('#screen-output').prepend(wrap);
}

function stop() {
    if (recorder && recorder.state === 'recording') recorder.stop();
    stopStream(stream);
    stream = null;
    $('#screen-video').srcObject = null;
}

export default {
    id: 'screen',
    title: 'Screen capture',
    emoji: '🖥️',
    support() {
        return supported() ? 'yes' : 'no';
    },
    setup() {
        if (!supported()) {
            setStatus($('#screen-status'),
                'getDisplayMedia no está disponible en este navegador. Los navegadores móviles (Android/iOS) aún no permiten capturar la pantalla; pruébalo desde Chrome/Edge/Firefox de escritorio.', 'err');
            ['#screen-start', '#screen-shot', '#screen-rec', '#screen-stop'].forEach((s) => { $(s).disabled = true; });
            return;
        }
        $('#screen-start').addEventListener('click', start);
        $('#screen-shot').addEventListener('click', screenshot);
        $('#screen-rec').addEventListener('click', record);
        $('#screen-stop').addEventListener('click', () => {
            stop();
            setStatus($('#screen-status'), 'Captura detenida.');
        });
    },
    leave: stop
};
