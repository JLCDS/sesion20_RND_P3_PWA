# Recursos Nativos PWA – Sesión 20 (Parte 3)

Taller *Recursos nativos en dispositivos móviles – Parte 3* (Electiva III – PWA, UPTC).
Implementa los demos de [whatpwacando.today](https://whatpwacando.today/) en una PWA con NodeJS + Express.

| # | Demo | API | Soporte en móvil |
|---|------|-----|------------------|
| 1 | Authentication | Web Authentication (passkeys) | Android Chrome, iOS Safari |
| 2 | Face detection | `FaceDetector` (Shape Detection) + respaldo MediaPipe | Nativo solo con flag en Chrome; el respaldo funciona en todos |
| 3 | Barcode detection | `BarcodeDetector` | Android Chrome (no iOS) |
| 4 | Screen capture | `getDisplayMedia` + `MediaRecorder` | Solo escritorio |
| 5 | Audio Recording | `getUserMedia` + `MediaRecorder` + Web Audio | Android, iOS |
| 6 | Orientation | `deviceorientation`, `screen.orientation` | Android, iOS (pide permiso) |
| 7 | Motion | `devicemotion` | Android, iOS (pide permiso) |
| 8 | Multitouch | Pointer Events | Todos los táctiles |
| 9 | ViewTransition | `document.startViewTransition` | Chrome Android, Safari 18+ |

Cada demo se abre desde una tarjeta en la pantalla principal; la navegación entre pantallas usa View Transitions.

## Ejecutar en local

```bash
npm install
npm start
```

Abrir <http://localhost:3000>. Las APIs de cámara, sensores y WebAuthn necesitan **HTTPS** (o `localhost`), por eso para probar en el celular se usa GitHub Pages.

## Despliegue en GitHub Pages

1. Crear un repositorio en GitHub y subir el proyecto a la rama `main`.
2. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. El workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) publica la carpeta `public/` en cada push.
4. La app queda en `https://<usuario>.github.io/<repositorio>/`.

## Estructura

```
public/
  index.html          pantallas de la app (home + 9 demos)
  css/style.css
  js/app.js           registro de demos, navegación, SW, instalación
  js/utils.js         utilidades compartidas
  js/demos/*.js       un módulo por demo
  sw.js               service worker (offline)
  manifest.json
server/server.js      servidor Express para desarrollo local
```
