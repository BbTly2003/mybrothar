## 📲 ¿Y para el móvil? (no descargues ZIPs en el teléfono)

La app **no se instala en el móvil con estos ZIPs**. El móvil es solo el mando: se conecta al servidor.

1. Arranca MyBrothar en tu PC (ZIP de abajo) o en la web
2. En el móvil, abre el navegador y entra a la dirección que muestra el **botón morado "Probar en el móvil"** (QR del menú) — mismo WiFi
3. En el navegador del móvil: **«Añadir a pantalla de inicio»** → se instala como app y **ocupa solo ~1-2 MB**

## 💻 ¿Cuál ZIP descargo? (solo para el PC que hace de servidor)

| Archivo | Sistema |
|---|---|
| `mybrothar-windows.zip` | Windows 10 / 11 (x64) |
| `mybrothar-linux.zip` | Linux x64 (Debian, Ubuntu…) |
| `mybrothar-macos.zip` | macOS Intel y Apple Silicon |

Descomprime y ejecuta:
- **Windows:** doble clic en `start.bat`
- **Linux/Mac:** `./start.sh`

Luego abre `http://localhost:3000`. Requiere **Node.js** (https://nodejs.org). Tu progreso se guarda en `db/custom.db`.

> 💡 Antes había un único ZIP de ~111 MB que incluía los motores de base de datos de **todas** las plataformas. Ahora cada paquete incluye solo el suyo y pesa mucho menos.
