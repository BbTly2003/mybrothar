---
Task ID: 1
Agent: full-stack-developer
Task: Backend — Prisma schema (Player/GameRecord) + API routes for domino game

Work Log:
- Read existing project files (prisma/schema.prisma, src/lib/db.ts, package.json); worklog.md did not exist yet, proceeded fresh.
- Ran the mandatory fullstack init script (curl …/init-fullstack_1775040338514.sh | bash) — completed successfully.
- Appended `Player` (id "default", tokens 1000, gamesPlayed/gamesWon/tokensWon counters) and `GameRecord` (stake, pot, outcome, payout, createdAt) models to prisma/schema.prisma, keeping the existing generator/datasource/User/Post blocks untouched.
- Ran `bun run db:push` (prisma db push --accept-data-loss): SQLite db/custom.db synced and Prisma Client v6.19.2 regenerated. No migrations used, dev server not restarted.
- Created shared helper src/lib/player.ts exporting `getOrCreatePlayer()` (upsert on id "default") and `DEFAULT_PLAYER_ID`.
- Implemented GET /api/profile (export const dynamic = 'force-dynamic'): returns tokens, stats and latest 5 GameRecords (createdAt desc).
- Implemented POST /api/profile/bonus: rescue bonus — grants +500 tokens only when tokens < 100, otherwise returns granted:false.
- Implemented POST /api/game/join: zod validation of stake ∈ {100,200,300,500}, insufficient-funds check (400 with Spanish message), atomic decrement of tokens.
- Implemented POST /api/game/result: zod validation (stake ∈ {100,200,300,500}, outcome enum win/loss/draw/forfeit, payout int 0..stake*4), wrapped balance + counter updates + GameRecord creation in db.$transaction; tokens clamped at min 0.
- Smoke-tested all endpoints with curl against http://localhost:3000 (happy paths + all error paths, see Stage Summary); reset DB to pristine state afterwards (fresh "default" player with 1000 tokens, zero records) so the frontend starts clean.
- Ran `bun run lint` — clean, no errors. Checked dev.log — no server errors.

Stage Summary:
- Artifacts: prisma/schema.prisma (Player + GameRecord added), src/lib/player.ts (shared getOrCreatePlayer), src/app/api/profile/route.ts, src/app/api/profile/bonus/route.ts, src/app/api/game/join/route.ts, src/app/api/game/result/route.ts. All game/profile endpoints operate on a single player row with id "default". DB was left in pristine state (player "default": 1000 tokens, 0 games).
- API contracts (all responses are NextResponse.json; DB errors → 500 {"error":"Error interno"}):
  - GET /api/profile → 200 {"tokens":number,"stats":{"gamesPlayed":number,"gamesWon":number,"tokensWon":number},"recentGames":[{"id":number,"stake":number,"pot":number,"outcome":"win"|"loss"|"draw"|"forfeit","payout":number,"createdAt":string}]} (recentGames = latest 5, [] if none).
  - POST /api/game/join body {"stake":100|200|300|500} → 200 {"tokens":<newBalanceAfterStake>}; 400 {"error":"No tienes suficientes tokens para entrar a esta mesa."} if tokens < stake; 400 {"error":"Apuesta inválida. Debe ser 100, 200, 300 o 500."} for invalid stake/body.
  - POST /api/game/result body {"stake":100|200|300|500,"outcome":"win"|"loss"|"draw"|"forfeit","payout":int 0..stake*4} → 200 {"tokens":number,"stats":{"gamesPlayed":number,"gamesWon":number,"tokensWon":number}} with UPDATED values; tokens = max(0, tokens + payout); gamesWon increments only on "win"; tokensWon increments by payout; pot stored = stake*4; 400 {"error":"Datos de partida inválidos."} on validation failure.
  - POST /api/profile/bonus (no body required) → 200 {"granted":false,"tokens":current} when tokens >= 100; 200 {"granted":true,"tokens":<balance+500>} when tokens < 100.
- Verified curl smoke tests (actual responses): GET /api/profile → {"tokens":1000,"stats":{"gamesPlayed":0,"gamesWon":0,"tokensWon":0},"recentGames":[]}; join {"stake":100} → {"tokens":900}; result {"stake":100,"outcome":"win","payout":400} → {"tokens":1300,"stats":{"gamesPlayed":1,"gamesWon":1,"tokensWon":400}}; bonus with 1300 tokens → {"granted":false,"tokens":1300}; profile then showed recentGames:[{"id":1,"stake":100,"pot":400,"outcome":"win","payout":400,"createdAt":"2026-10-21T21:44:54.642Z"}]; join stake 50 → 400 invalid-stake message; result payout 5000 / outcome "cheat" / missing body → 400; drained tokens 1300→800→300→0 via join 500/500/300; join at 0 tokens → 400 "No tienes suficientes tokens…"; bonus at 0 tokens → {"granted":true,"tokens":500}. All as specified.
- Frontend integration notes: pay 4x pot on win (payout = stake*4), payout 0 on loss/forfeit, payout = stake*2 on draw recommended (any int ≤ stake*4 accepted); call /api/game/result exactly once per finished game; call /api/profile/bonus when showing a "sin tokens" rescue prompt.

---
Task ID: 2-a, 2-b, 2-c
Agent: Z.ai Code (main agent)
Task: Motor de dominó completo + UI frontend + integración con backend

Work Log:
- Creado src/lib/game/types.ts: Tile, PlacedTile (orientada left/right), Side, LogEntry, GameOutcome (win/loss/blocked-win/blocked-loss/forfeit), GameState, SEAT_NAMES, STAKES {100,200,300,500}, TABLE_META.
- Creado src/lib/game/engine.ts (puro, sin React): createDeck (28 fichas doble-6), Fisher-Yates shuffle, dealHands (7×4), getEnds, sidesFor, orientTile (volteo automático para encajar), pipSum, findHighestDouble (regla clásica: el doble más alto abre y es jugada obligatoria), chooseBotMove (IA: prioriza dobles y fichas pesadas; elige el lado que deja el extremo conectado a más fichas propias), resolveBlocked (bloqueo por 4 pases: gana la mano más ligera, empate reparte el pozo con resto por orden de asiento), createGame, potFor.
- Creado src/lib/game/reducer.ts: useReducer puro con SET_GAME / APPLY_PLAY (valida ficha obligatoria en apertura y lado válido; detecta victoria por mano vacía) / APPLY_PASS (valida que no haya jugada disponible; bloqueo a los 4 pases) / RESET. La aleatoriedad (createGame) se ejecuta fuera del reducer por StrictMode.
- Creado src/lib/sfx.ts: sonidos WebAudio sintetizados (click/deal/pass/coin/win/lose) con mute persistido en localStorage.
- Componentes en src/components/domino/: domino-tile.tsx (ficha vertical con puntos reales en cuadrícula 3×3, 6 = 2 columnas × 3 filas, 3 tamaños, cara trasera para bots, estados playable/disabled/highlight/shake), board-chain.tsx (cadena con scroll horizontal, auto-scroll al extremo de la última jugada, animación spring por ficha con framer-motion, fieltro CSS), opponent-rail.tsx (3 bots con pilas boca abajo, turno activo resaltado, badge de conteo en móvil), game-log.tsx (bitácora con aria-live, colores por tipo de evento), lobby.tsx (4 mesas con estados affordable/entrando, stats, últimas 5 partidas, tarjeta de bonus cuando tokens < 100), result-dialog.tsx (sin X, muestra resultado/pozo, "Jugar otra vez" y "Volver al lobby"), side-picker-dialog.tsx (elección izquierda/derecha con valores de extremos).
- Reescrito src/app/page.tsx: orquestador cliente con useReducer; flujo join (POST /api/game/join → createGame fuera del reducer → pantalla de juego), bucle de bots por useEffect con timeout 850-1400ms y limpieza (refs eNN correctos), reporte único de resultado por identidad de objeto (reportedRef) con mapeo win/blocked-win→win, loss/blocked-loss→loss, forfeit; abandono con AlertDialog y pérdida de apuesta; bonus; toggle de sonido; header con saldo; footer pegado (min-h-screen flex-col + mt-auto).
- layout.tsx: lang="es", metadata del salón, Toaster de sonner (position top-center, richColors).
- globals.css: .domino-bg (destellos radiales), .domino-felt (fieltro del tablero), @keyframes domino-shake + .domino-shake, .scrollbar-thin (webkit + firefox).
- Correcciones durante verificación: color de pips faltante (fichas se veían en blanco), orientación del 6, fondos oscuros explícitos en Cards del lobby (shadcn bg-card blanco por defecto), atenuación 55% de fichas no jugables, guardas anti doble-invocación (joinInFlightRef, leavingRef) tras observar registros duplicados generados por el CLI de automatización (clicks con ref vacía), título del header convertido en div no interactivo, showCloseButton={false} en diálogo de resultado, descripciones Radix autovinculadas (sin aria-describedby manual), badge "abriste la cadena" con espacio en el árbol a11y.

Stage Summary:
- Reglas auténticas implementadas: doble más alto abre (jugada obligatoria), extremos left/right con volteo, pase solo sin jugada disponible, bloqueo por 4 pases → gana mano más ligera (empate reparte), pozo = stake×4, abandono pierde la apuesta.
- Los 3 bots juegan fichas reales (el HTML original solo decrementaba contadores) y pasan correctamente.
- Tokens y estadísticas persistidos en SQLite vía las APIs del Task 1; flujo de rescate con bonus de 500 tokens cuando el saldo < 100.

---
Task ID: 3
Agent: Z.ai Code (main agent)
Task: Verificación end-to-end con Agent Browser + fixes

Work Log:
- Lint final: limpio (0 errores, 0 warnings).
- Recorrido completo en navegador (desktop 1280×800 y móvil 375×812): lobby → entrar a Mesa Novato → apertura con [6|6] → diálogo de elección de lado con [0|4] en ambos extremos → partida completa hasta diálogo final.
- Verificado con curl tras cada acción: join descuenta exactamente una vez (1000→900); partida completa registró UN GameRecord (id5, loss, payout 0) y gamesPlayed 1; forfeit del test controlado registró id2; bonus con tokens=50 mostró tarjeta, al reclamar → 550 con toast y mesas re-habilitadas.
- Reglas comprobadas en vivo: log muestra "Bot 2 tiene el doble más alto [6|6] y comienza la partida", bots juegan fichas reales visibles en la cadena, extremos [6]⟷[4] correctos, pase de bot sin jugada.
- Layout: footer pegado al fondo (footerBottom == viewportHeight == 800 en página corta, y empujado naturalmente con contenido largo), responsive móvil OK (rail de oponentes compactado con badge de conteo).
- Consola del navegador: 0 errores (solo warnings dev de Radix, eliminados al final autovinculando descripciones).
- Base de datos reseteada a estado pristine para el usuario (jugador "default" se crea con 1000 tokens al primer uso).

Stage Summary:
- Aplicación verificada de extremo a extremo: render, interacción, persistencia, responsive y accesibilidad. Lista para usar desde el Preview Panel.
