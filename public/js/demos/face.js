// 2. Face detection - Shape Detection API (FaceDetector)
// FaceDetector nativo solo existe en Chrome con el flag "Experimental Web Platform features".
// Si no está, se usa MediaPipe Face Detector (WASM) cargado desde CDN como respaldo.
import { $, setStatus, describeError, openCamera, stopStream, syncCanvas } from '../utils.js';

const MP_VERSION = '0.10.14';
const MP_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const MP_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

let stream = null;
let facing = 'user';
let detector = null;     // { name, detect(video) => [{x,y,width,height,landmarks}] }
let rafId = 0;
let busy = false;

async function createDetector() {
    if ('FaceDetector' in window) {
        const fd = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 10 });
        return {
            name: 'FaceDetector nativo',
            async detect(video) {
                const faces = await fd.detect(video);
                return faces.map((f) => ({
                    ...f.boundingBox.toJSON ? f.boundingBox.toJSON() : f.boundingBox,
                    landmarks: (f.landmarks || []).flatMap((l) => l.locations)
                }));
            }
        };
    }

    const { FilesetResolver, FaceDetector } = await import(`${MP_BASE}/vision_bundle.mjs`);
    const vision = await FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
    const mp = await FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MP_MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO'
    });
    return {
        name: 'MediaPipe (respaldo)',
        async detect(video) {
            const res = mp.detectForVideo(video, performance.now());
            return res.detections.map((d) => ({
                x: d.boundingBox.originX,
                y: d.boundingBox.originY,
                width: d.boundingBox.width,
                height: d.boundingBox.height,
                score: d.categories[0] && d.categories[0].score,
                landmarks: (d.keypoints || []).map((k) => ({ x: k.x * video.videoWidth, y: k.y * video.videoHeight }))
            }));
        }
    };
}

function draw(faces) {
    const canvas = $('#face-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = Math.max(2, canvas.width / 200);
    ctx.font = `${Math.max(14, canvas.width / 30)}px system-ui`;

    faces.forEach((f, i) => {
        ctx.strokeStyle = '#2ecc71';
        ctx.strokeRect(f.x, f.y, f.width, f.height);
        ctx.fillStyle = '#2ecc71';
        const label = `Rostro ${i + 1}` + (f.score ? ` ${(f.score * 100).toFixed(0)}%` : '');
        ctx.fillText(label, f.x, Math.max(16, f.y - 6));
        ctx.fillStyle = '#f1c40f';
        f.landmarks.forEach((p) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, ctx.lineWidth * 1.5, 0, Math.PI * 2);
            ctx.fill();
        });
    });
}

async function loop() {
    const video = $('#face-video');
    if (!stream) return;
    if (!busy && video.readyState >= 2) {
        busy = true;
        try {
            const faces = await detector.detect(video);
            draw(faces);
            setStatus($('#face-status'), `${detector.name}: ${faces.length} rostro(s) detectado(s).`, 'ok');
        } catch (err) {
            console.warn(err);
        }
        busy = false;
    }
    rafId = requestAnimationFrame(loop);
}

async function start() {
    const status = $('#face-status');
    const video = $('#face-video');
    stop();
    try {
        setStatus(status, 'Abriendo cámara…');
        stream = await openCamera(video, facing);
        syncCanvas($('#face-canvas'), video);
        if (!detector) {
            setStatus(status, 'Cargando detector de rostros…');
            detector = await createDetector();
        }
        loop();
    } catch (err) {
        stop();
        setStatus(status, 'Error: ' + describeError(err), 'err');
    }
}

function stop() {
    cancelAnimationFrame(rafId);
    stopStream(stream);
    stream = null;
    const canvas = $('#face-canvas');
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

export default {
    id: 'face',
    title: 'Face detection',
    emoji: '🙂',
    support() {
        if ('FaceDetector' in window) return 'yes';
        return navigator.mediaDevices && navigator.mediaDevices.getUserMedia ? 'partial' : 'no';
    },
    setup() {
        $('#face-start').addEventListener('click', start);
        $('#face-stop').addEventListener('click', () => {
            stop();
            setStatus($('#face-status'), 'Cámara detenida.');
        });
        $('#face-switch').addEventListener('click', () => {
            facing = facing === 'user' ? 'environment' : 'user';
            if (stream) start();
        });
        if (!('FaceDetector' in window)) {
            setStatus($('#face-status'),
                'FaceDetector nativo no disponible (en Chrome se activa con chrome://flags → Experimental Web Platform features). Se usará MediaPipe como respaldo.');
        }
    },
    leave: stop,
    onHidden: stop
};
