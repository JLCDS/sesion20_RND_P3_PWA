// 1. Authentication - Web Authentication API (WebAuthn / Passkeys)
// Demo 100% en el cliente: la credencial se crea en el autenticador del dispositivo
// (huella, rostro, PIN) y su id se guarda en localStorage. En producción el challenge
// lo genera el servidor y es el servidor quien verifica la firma.
import { $, setStatus, describeError } from '../utils.js';

const STORAGE_KEY = 'webauthn-credentials';

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (str) => Uint8Array.from(
    atob(str.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

function loadCreds() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}
function saveCreds(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function log(obj) {
    $('#auth-log').textContent = JSON.stringify(obj, null, 2);
}

async function register() {
    const status = $('#auth-status');
    const username = $('#auth-user').value.trim();
    if (!username) return setStatus(status, 'Escribe un nombre de usuario.', 'err');

    try {
        const userId = randomBytes(16);
        const cred = await navigator.credentials.create({
            publicKey: {
                challenge: randomBytes(32),
                rp: { name: 'Recursos Nativos PWA', id: location.hostname },
                user: { id: userId, name: username, displayName: username },
                pubKeyCredParams: [
                    { type: 'public-key', alg: -7 },   // ES256
                    { type: 'public-key', alg: -257 }  // RS256
                ],
                authenticatorSelection: {
                    authenticatorAttachment: 'platform',
                    residentKey: 'preferred',
                    userVerification: 'required'
                },
                excludeCredentials: loadCreds().map((c) => ({ type: 'public-key', id: fromB64url(c.id) })),
                timeout: 60000,
                attestation: 'none'
            }
        });

        const list = loadCreds();
        list.push({ id: cred.id, username, created: new Date().toISOString() });
        saveCreds(list);

        setStatus(status, `Passkey registrada para "${username}".`, 'ok');
        log({
            accion: 'registro',
            id: cred.id,
            tipo: cred.type,
            authenticatorAttachment: cred.authenticatorAttachment,
            transports: cred.response.getTransports ? cred.response.getTransports() : undefined
        });
    } catch (err) {
        setStatus(status, 'Error al registrar: ' + describeError(err), 'err');
    }
}

async function login() {
    const status = $('#auth-status');
    const creds = loadCreds();

    try {
        // Si no hay credenciales guardadas, dejamos que el autenticador ofrezca las passkeys disponibles
        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge: randomBytes(32),
                rpId: location.hostname,
                allowCredentials: creds.map((c) => ({ type: 'public-key', id: fromB64url(c.id) })),
                userVerification: 'required',
                timeout: 60000
            }
        });

        const match = creds.find((c) => c.id === assertion.id);
        const name = match ? match.username : 'usuario desconocido';
        setStatus(status, `Sesión iniciada como "${name}".`, 'ok');
        log({
            accion: 'login',
            id: assertion.id,
            userHandle: assertion.response.userHandle ? b64url(assertion.response.userHandle) : null,
            firma: b64url(assertion.response.signature).slice(0, 40) + '…'
        });
    } catch (err) {
        setStatus(status, 'Error al iniciar sesión: ' + describeError(err), 'err');
    }
}

function clearCreds() {
    saveCreds([]);
    log({});
    setStatus($('#auth-status'), 'Credenciales locales borradas (la passkey sigue en el gestor del dispositivo).');
}

export default {
    id: 'auth',
    title: 'Authentication',
    emoji: '🔐',
    support() {
        return window.PublicKeyCredential ? 'yes' : 'no';
    },
    async setup() {
        $('#auth-register').addEventListener('click', register);
        $('#auth-login').addEventListener('click', login);
        $('#auth-clear').addEventListener('click', clearCreds);

        const status = $('#auth-status');
        if (!window.PublicKeyCredential) {
            setStatus(status, 'Este navegador no soporta WebAuthn.', 'err');
            return;
        }
        const platform = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        const saved = loadCreds();
        setStatus(status,
            (platform ? 'Autenticador del dispositivo disponible.' : 'No hay autenticador biométrico/PIN en el dispositivo.') +
            ` Credenciales guardadas: ${saved.length}.`,
            platform ? 'ok' : 'err');
        if (saved.length) $('#auth-user').value = saved[saved.length - 1].username;
    },
    leave() {}
};
