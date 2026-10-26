# 🎲 MyBrothar — última versión

## 📲 Instalador Android: `mybrothar.apk` (RECOMENDADO para el móvil)

1. Descarga **`mybrothar.apk`** en tu teléfono y ábrelo
   (la primera vez Android pedirá permitir **"instalar de origen desconocido"** — acéptalo)
2. Arranca MyBrothar en tu **PC** (con un ZIP de abajo, o la web)
3. En el PC, pulsa el botón morado **"Probar en el móvil"** del menú: te muestra la dirección (ej. `http://192.168.1.40:3000`)
4. Abre la app **MyBrothar** en el móvil, escribe esa dirección y pulsa **Conectar** — ¡a jugar! 🎲

- El PC y el móvil deben estar en la **misma WiFi**
- La app **guarda la dirección**: la siguiente vez entra directa
- Si cambias de red o IP, usa **"Cambiar dirección"** en la pantalla de error

> ℹ️ El APK es el **cliente**: muestra el juego que corre en tu PC. Firmado en modo debug para instalar fuera de Play Store; si Google Play Protect avisa, elige **"Instalar de todas formas"**.

## 💻 Servidor para PC: ¿cuál ZIP descargo?

| Archivo | Sistema |
|---|---|
| `mybrothar-windows.zip` | Windows 10 / 11 (x64) |
| `mybrothar-linux.zip` | Linux x64 (Debian, Ubuntu…) |
| `mybrothar-macos.zip` | macOS Intel y Apple Silicon |

Descomprime y ejecuta:
- **Windows:** doble clic en `start.bat`
- **Linux/Mac:** `./start.sh`

Luego abre `http://localhost:3000`. Requiere **Node.js** (https://nodejs.org). Tu progreso se guarda en `db/custom.db`.

> 💡 Los ZIP solo incluyen el motor de base de datos de su plataforma (antes había uno único de ~111 MB; ahora pesan ~13-23 MB). Alternativa sin instalar nada: abre la web en el navegador del móvil y usa **"Añadir a pantalla de inicio"** (PWA, ~1-2 MB).
