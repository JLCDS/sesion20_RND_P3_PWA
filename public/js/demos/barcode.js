// 3. Barcode detection - Shape Detection API (BarcodeDetector)
// Soportado en Chrome para Android y macOS. Detecta QR, EAN, Code128, etc.
import { $, setStatus, describeError, openCamera, stopStream, syncCanvas, toast } from '../utils.js';

let stream = null;
let detector = null;
let timer = 0;
const seen = new Set();

async function getDetector() {
    if (detector) return detector;
    const formats = await window.BarcodeDetector.getSupportedFormats();
    detector = new window.BarcodeDetector({ formats });
    setStatus($('#barcode-status'), 'Formatos soportados: ' + formats.join(', '));
    return detector;
}

function drawBoxes(canvas, codes) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = Math.max(3, canvas.width / 150);
    ctx.strokeStyle = '#e74c3c';
    codes.forEach((c) => {
        const pts = c.cornerPoints;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.stroke();
    });
}

function addResult(code) {
    const key = code.format + ':' + code.rawValue;
    if (seen.has(key)) return;
    seen.add(key);
    if (navigator.vibrate) navigator.vibrate(100);

    const li = document.createElement('li');
    const isUrl = /^https?:\/\//i.test(code.rawValue);
    li.innerHTML = `<small>${code.format}</small><br>`;
    if (isUrl) {
        const a = document.createElement('a');
        a.href = code.rawValue;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = code.rawValue;
        li.appendChild(a);
    } else {
        li.appendChild(document.createTextNode(code.rawValue));
    }
    const copy = document.createElement('button');
    copy.className = 'btn btn-ghost';
    copy.style.marginTop = '6px';
    copy.textContent = 'Copiar';
    copy.onclick = () => navigator.clipboard.writeText(code.rawValue).then(() => toast('Copiado'));
    li.appendChild(document.createElement('br'));
    li.appendChild(copy);
    $('#barcode-results').prepend(li);
}

async function scanFrame() {
    const video = $('#barcode-video');
    if (!stream) return;
    try {
        const codes = await detector.detect(video);
        drawBoxes($('#barcode-canvas'), codes);
        codes.forEach(addResult);
    } catch (err) {
        console.warn(err);
    }
    timer = setTimeout(scanFrame, 250);
}

async function start() {
    stop();
    const status = $('#barcode-status');
    try {
        await getDetector();
        stream = await openCamera($('#barcode-video'), 'environment');
        syncCanvas($('#barcode-canvas'), $('#barcode-video'));
        setStatus(status, 'Apunta la cámara a un código QR o de barras…', 'ok');
        scanFrame();
    } catch (err) {
        stop();
        setStatus(status, 'Error: ' + describeError(err), 'err');
    }
}

function stop() {
    clearTimeout(timer);
    stopStream(stream);
    stream = null;
    const canvas = $('#barcode-canvas');
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

async function fromFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    stop();
    const status = $('#barcode-status');
    try {
        await getDetector();
        const bitmap = await createImageBitmap(file);
        const canvas = $('#barcode-canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const codes = await detector.detect(bitmap);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        const boxes = document.createElement('canvas');
        boxes.width = canvas.width;
        boxes.height = canvas.height;
        drawBoxes(boxes, codes);
        ctx.drawImage(boxes, 0, 0);
        codes.forEach(addResult);
        setStatus(status, codes.length ? `${codes.length} código(s) encontrado(s).` : 'No se encontraron códigos en la imagen.', codes.length ? 'ok' : 'err');
    } catch (err) {
        setStatus(status, 'Error: ' + describeError(err), 'err');
    }
    e.target.value = '';
}

export default {
    id: 'barcode',
    title: 'Barcode detection',
    emoji: '🔳',
    support() {
        return 'BarcodeDetector' in window ? 'yes' : 'no';
    },
    setup() {
        if (!('BarcodeDetector' in window)) {
            setStatus($('#barcode-status'), 'BarcodeDetector no está disponible en este navegador (prueba Chrome en Android).', 'err');
            ['#barcode-start', '#barcode-stop'].forEach((s) => { $(s).disabled = true; });
            $('#barcode-file').disabled = true;
            return;
        }
        $('#barcode-start').addEventListener('click', start);
        $('#barcode-stop').addEventListener('click', () => {
            stop();
            setStatus($('#barcode-status'), 'Escaneo detenido.');
        });
        $('#barcode-file').addEventListener('change', fromFile);
    },
    leave: stop,
    onHidden: stop
};
