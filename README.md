# 🎲 MyBrothar

Juego de **dominó para 4 jugadores** (tú + 3 bots: Lola, Max y Kira) con mesa rústica de madera, intro cinematográfica con tormenta y rayo, bandera cubana y fichas de marfil realistas con física completa.

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Prisma (SQLite) · framer-motion

---

## 📦 Descargar la app compilada (sin programar nada)

1. Ve a **[Releases](https://github.com/BbTly2003/mybrothar/releases/latest)**
2. Descarga el ZIP de **tu sistema** (cada paquete incluye solo su motor de base de datos, por eso pesa 3× menos que antes):
   - 🪟 `mybrothar-windows.zip` — Windows 10/11
   - 🐧 `mybrothar-linux.zip` — Linux x64
   - 🍎 `mybrothar-macos.zip` — macOS (Intel y Apple Silicon)
3. Descomprímelo y ejecuta:
   - **Linux/Mac:** `./start.sh`
   - **Windows:** doble clic en `start.bat`
4. Abre `http://localhost:3000` — ¡a jugar!

> Requiere Node.js instalado. Tu progreso se guarda en `db/custom.db`.

**📲 En el móvil no se descarga ningún ZIP:** el servidor corre en el PC y el teléfono se conecta por WiFi (QR en el botón morado del menú) instalando la **PWA** con «Añadir a pantalla de inicio» (~1-2 MB).

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
5. Sube el ZIP como *artifact* y lo publica en *Releases* (`latest`)
