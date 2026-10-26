# 🎲 MyBrothar

Juego de **dominó para 4 jugadores** (tú + 3 bots: Lola, Max y Kira) con mesa rústica de madera, intro cinematográfica con tormenta y rayo, bandera cubana y fichas de marfil realistas con física completa.

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Prisma (SQLite) · framer-motion

---

## 📦 Descargar la app compilada (sin programar nada)

1. Ve a **[Releases](https://github.com/BbTly2003/mybrothar/releases/latest)**
2. Descarga lo que necesites:
   - 📲 **`mybrothar.apk`** — instalador **Android**: ábrelo en el teléfono, acepta "origen desconocido", escribe la dirección del PC y juega (app con icono propio)
   - 🪟 `mybrothar-windows.zip` — servidor Windows 10/11
   - 🐧 `mybrothar-linux.zip` — servidor Linux x64
   - 🍎 `mybrothar-macos.zip` — servidor macOS (Intel y Apple Silicon)
3. Ejecuta:
   - **Linux/Mac:** `./start.sh`
   - **Windows:** doble clic en `start.bat`
4. Abre `http://localhost:3000` — ¡a jugar!

> El servidor (ZIP) requiere Node.js; tu progreso se guarda en `db/custom.db`. El **APK es el cliente del móvil** y se conecta al PC por WiFi (dirección que muestra el botón morado "Probar en el móvil"). También existe la opción PWA: "Añadir a pantalla de inicio" desde el navegador (~1-2 MB).

También puedes descargar el paquete desde la pestaña **[Actions](https://github.com/BbTly2003/mybrothar/actions)** → último workflow → *Artifacts*.

## 🛠️ Desarrollo local

```sh
bun install
bun run db:push   # crea la base de datos
bun run dev       # servidor de desarrollo en :3000
```

## 🤖 Compilación automática

Cada push a `main` dispara el workflow `.github/workflows/build.yml`, que:
1. Instala dependencias con Bun
2. Prepara la base de datos (Prisma + SQLite)
3. Compila Next.js en modo *standalone*
4. Empaqueta **3 ZIPs portables** (Linux/Mac/Windows), cada uno con solo su motor de Prisma y compresión máxima
5. Compila **`mybrothar.apk`** (cliente Android WebView, sin Gradle: aapt2 + d8 + apksigner)
6. Sube todo como *artifact* y lo publica en *Releases* (`latest`)
