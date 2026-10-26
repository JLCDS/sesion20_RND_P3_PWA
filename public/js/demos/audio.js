// 5. Audio Recording - getUserMedia (micrófono) + MediaRecorder + Web Audio API (visualizador)
import { $, setStatus, describeError, stopStream, pickMimeType, formatBytes } from '../utils.js';

let stream = null;
let recorder = null;
let chunks = [];
let audioCtx = null;
let analyser = null;
let rafId = 0;
let startedAt = 0;

const supported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

function drawWave() {
    const canvas = $('#audio-canvas');
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.clientWidth * devicePixelRatio;
    const h = canvas.height = canvas.clientHeight * devicePixelRatio;
    const data = new Uint8Array(analyser.fftSize);

    const render = () => {
        analyser.getByteTimeDomainData(data);
        ctx.clearRect(0, 0, w, h);
        ctx.lineWidth = 2 * devicePixelRatio;
        ctx.strokeStyle = '#3498db';
        ctx.beginPath();
        data.forEach((v, i) => {
            const x = (i / data.length) * w;
            const y = (v / 255) * h;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();

        const secs = ((performance.now() - startedAt) / 1000).toFixed(1);
        setStatus($('#audio-status'), `● Grabando… ${secs}s`, 'ok');
        rafId = requestAnimationFrame(render);
    };
    render();
}

async function rec() {
    const status = $('#audio-status');
    if (recorder && recorder.state === 'recording') return;
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true }
        });

        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        audioCtx.createMediaStreamSource(stream).connect(analyser);

        const mimeType = pickMimeType(['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']);
        recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        chunks = [];
        recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        recorder.onstop = saveRecording;
        recorder.start();
        startedAt = performance.now();
        drawWave();
        $('#audio-rec').disabled = true;
    } catch (err) {
        cleanup();
        setStatus(status, 'Error: ' + describeError(err), 'err');
    }
}

function saveRecording() {
    const type = recorder.mimeType || 'audio/webm';
    const blob = new Blob(chunks, { type });
    const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
    const secs = ((performance.now() - startedAt) / 1000).toFixed(1);
    const url = URL.createObjectURL(blob);
    const name = `audio-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`;

    const li = document.createElement('li');
    li.innerHTML = `<strong>Grabación ${$('#audio-list').children.length + 1}</strong> · ${secs}s · ${formatBytes(blob.size)}`;
    const player = document.createElement('audio');
    player.controls = true;
    player.src = url;
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.textContent = 'Descargar';
    li.append(player, link);

    if (navigator.canShare && navigator.canShare({ files: [new File([blob], name, { type })] })) {
        const share = document.createElement('button');
        share.className = 'btn btn-ghost';
        share.style.marginLeft = '10px';
        share.textContent = 'Compartir';
        share.onclick = () => navigator.share({ files: [new File([blob], name, { type })], title: 'Grabación de audio' }).catch(() => {});
        li.append(share);
    }
    $('#audio-list').prepend(li);
    setStatus($('#audio-status'), `Grabación guardada (${secs}s).`, 'ok');
}

function cleanup() {
    cancelAnimationFrame(rafId);
    stopStream(stream);
    stream = null;
    if (audioCtx) audioCtx.close();
    audioCtx = null;
    $('#audio-rec').disabled = false;
}

function stop() {
    if (recorder && recorder.state === 'recording') recorder.stop();
    cleanup();
}

export default {
    id: 'audio',
    title: 'Audio Recording',
    emoji: '🎙️',
    support() {
        return supported() ? 'yes' : 'no';
    },
    setup() {
        if (!supported()) {
            setStatus($('#audio-status'), 'MediaRecorder o getUserMedia no están disponibles.', 'err');
            $('#audio-rec').disabled = true;
            return;
        }
        $('#audio-rec').addEventListener('click', rec);
        $('#audio-stop').addEventListener('click', stop);
    },
    leave: stop,
    onHidden: stop
};
