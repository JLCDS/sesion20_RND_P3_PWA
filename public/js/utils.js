// Utilidades compartidas por todos los demos

export const $ = (sel) => document.querySelector(sel);

let toastTimer;
export function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// type: '' | 'ok' | 'err'
export function setStatus(el, msg, type = '') {
    el.textContent = msg;
    el.className = 'status' + (type ? ' ' + type : '');
}

export function stopStream(stream) {
    if (stream) stream.getTracks().forEach((t) => t.stop());
}

// Abre la cámara con la orientación pedida ('user' frontal, 'environment' trasera)
export async function openCamera(video, facingMode = 'environment') {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
    });
    video.srcObject = stream;
    await video.play();
    return stream;
}

// Ajusta el tamaño interno del canvas al del video para dibujar encima
export function syncCanvas(canvas, video) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
}

export function describeError(err) {
    const map = {
        NotAllowedError: 'Permiso denegado por el usuario o el navegador.',
        NotFoundError: 'No se encontró el dispositivo solicitado.',
        NotReadableError: 'El dispositivo está siendo usado por otra aplicación.',
        NotSupportedError: 'Operación no soportada en este navegador.',
        SecurityError: 'Bloqueado por seguridad (se requiere HTTPS).',
        AbortError: 'Operación cancelada.',
        InvalidStateError: 'Estado inválido (¿credencial ya registrada?).'
    };
    return map[err && err.name] || (err && err.message) || String(err);
}

export function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(2) + ' MB';
}

// Elige el primer mimeType que MediaRecorder soporte (Android: webm, iOS: mp4)
export function pickMimeType(candidates) {
    if (!('MediaRecorder' in window)) return '';
    return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

export function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// Ejecuta un cambio de DOM dentro de una View Transition (si el navegador la soporta).
// direction: 'nav-forward' | 'nav-back' agrega la animación de deslizamiento.
export function withTransition(update, direction) {
    if (!document.startViewTransition) {
        update();
        return Promise.resolve();
    }
    const root = document.documentElement;
    if (direction) root.classList.add(direction);
    const vt = document.startViewTransition(update);
    // Si se inicia otra transición antes de que termine esta, 'ready' se rechaza con AbortError: es normal
    vt.ready.catch(() => {});
    return vt.finished.finally(() => root.classList.remove('nav-forward', 'nav-back'));
}

// Instrucciones para desbloquear los sensores de movimiento según la plataforma.
// En Chrome Android requestPermission() no muestra diálogo: responde 'denied' si el sitio los tiene bloqueados.
export function sensorPermissionHelp() {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return ios
        ? 'En iPhone: cierra y vuelve a abrir Safari y acepta el permiso de "Movimiento y orientación".'
        : 'En Chrome: toca el icono junto a la URL → Permisos (o Configuración del sitio) → ' +
          'Sensores de movimiento → Permitir, y recarga la página.';
}
