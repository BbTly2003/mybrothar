# 🎲 MyBrothar — última versión

## 📲 Instalador Android: `mybrothar.apk`

1. Descarga **`mybrothar.apk`** en tu teléfono y ábrelo
   (la primera vez Android pedirá permitir **"instalar de origen desconocido"** — acéptalo; si Google Play Protect avisa, elige **"Instalar de todas formas"**)
2. Arranca el **servidor MyBrothar en tu PC** (ver abajo)
3. En el PC, pulsa el botón morado **"Probar en el móvil"** del menú: te muestra la dirección (ej. `http://192.168.1.40:3000`)
4. Abre la app **MyBrothar** en el móvil, escribe esa dirección y pulsa **Conectar** — ¡a jugar! 🎲

- El PC y el móvil deben estar en la **misma WiFi**
- La app **guarda la dirección**: la siguiente vez entra directa
- Si cambias de red o IP, usa **"Cambiar dirección"** en la pantalla de error

---

## 🖥️ Servidor en el PC (necesario para jugar)

El APK es el cliente: el juego corre en el PC. Para arrancarlo desde el código:

1. Instala **Node.js** (https://nodejs.org) y **Bun** (https://bun.sh)
2. Descarga el código: botón verde **`< > Code`** → **Download ZIP** (o `git clone https://github.com/BbTly2003/mybrothar.git`)
3. En la carpeta del proyecto:
   ```sh
   bun install
   bun run dev
   ```
4. Abre `http://localhost:3000` — desde ahí puedes jugar en el PC y generar la dirección/QR para el móvil

> Tu progreso (fichas, historial) se guarda en `db/custom.db`.
