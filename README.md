# 🎲 MyBrothar

Juego de **dominó para 4 jugadores** (tú + 3 bots: Lola, Max y Kira) con mesa rústica de madera, intro cinematográfica con tormenta y rayo, bandera cubana y fichas de marfil realistas con física completa.

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Prisma (SQLite) · framer-motion

---

## 📲 Instalador Android (APK)

1. Ve a **[Releases](https://github.com/BbTly2003/mybrothar/releases/latest)** y descarga **`mybrothar.apk`**
2. Ábrelo en el teléfono y acepta "instalar de origen desconocido"
3. Arranca el servidor en tu PC (ver abajo), pulsa el botón morado **"Probar en el móvil"** y escribe esa dirección en la app

La app guarda la dirección y entra directa las siguientes veces. Alternativa sin APK: PWA con "Añadir a pantalla de inicio" (~1-2 MB).

## 🖥️ Servidor en el PC (desde el código)

```sh
bun install
bun run db:push   # crea la base de datos
bun run dev       # servidor de desarrollo en :3000
```

Requiere **Node.js** y **[Bun](https://bun.sh)**. Tu progreso se guarda en `db/custom.db`.

También puedes descargar el paquete desde la pestaña **[Actions](https://github.com/BbTly2003/mybrothar/actions)** → último workflow → *Artifacts*.

## 🛠️ Desarrollo local

```sh
bun install
bun run db:push   # crea la base de datos
bun run dev       # servidor de desarrollo en :3000
```

## 🤖 Compilación automática

Cada push a `main` dispara el workflow `.github/workflows/build.yml`, que:
1. Compila **`mybrothar.apk`** (cliente Android WebView, sin Gradle: aapt2 + d8 + apksigner)
2. Lo sube como *artifact* y lo publica en *Releases* (`latest`)
