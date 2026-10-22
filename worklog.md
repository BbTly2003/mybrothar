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

---
Task ID: 4
Agent: Z.ai Code (main agent)
Task: Rediseño de la mesa con estilo de la app Plato (fieltro verde cenital, avatares alrededor, fichas blancas)

Work Log:
- types.ts: bots renombrados a Lola/Max/Kira (SEAT_NAMES) + añadidos SEAT_AVATARS (😎🐼🦊🐯) y SEAT_AVATAR_CLASS (degradados emerald/rose/amber/violet por asiento).
- globals.css: añadidas clases .plato-table (aro exterior de madera oscura con sombras profundas) y .plato-felt (fieltro verde con degradado radial, textura sutil y sombras internas); eliminada la antigua .domino-felt.
- domino-tile.tsx: reescrita — ficha blanca Plato (degradado blanco→stone, borde negro/15, esquinas redondeadas, pips zinc-800 con sombra interior); nueva prop orientation (vertical|horizontal) con rotación matemática de la cuadrícula de pips (el 6 en horizontal = 2 filas × 3 columnas); tamaños sm/md/lg con variantes por orientación; dorso blanco con emblema esmeralda; atenuación de no jugables suavizada a opacity-60.
- board-chain.tsx: fichas tumbadas en horizontal sobre el fieltro, dobles en cruz (vertical); contenedor transparente sin borde; se centra en la mesa mientras cabe (justify-center + ResizeObserver) y al desbordar pasa a scroll normal con auto-scroll al extremo de la última jugada; placeholder de mesa vacía sin desbordes en móvil (min-w-max solo con fichas).
- seat.tsx (nuevo): asiento estilo Plato — avatar circular con emoji + degradado, badge de conteo, píldora con nombre, pila de fichas boca abajo (h-7 w-3.5 solapadas) y halo ámbar + anillo dorado en el turno activo.
- page.tsx: pantalla de juego reestructurada — fila de estado (píldora de turno coloreada + apuesta + extremos + Salir), mesa plato-table/plato-felt con asientos posicionados (Lola arriba-centro, Max izquierda, Kira derecha en sm+; los 3 en fila superior en móvil; Tú abajo-izquierda), pila de pozo (PotChips: 3 fichas de casino CSS + total) en el borde inferior del fieltro, botón "Pasar turno" abajo-derecha, mano solapando el borde inferior con animación spring escalonada (framer-motion), log translúcido debajo. Header/footer a zinc.
- lobby.tsx: tarjetas redondeadas (rounded-3xl) con mini mesa de fieltro verde (MiniTable: fichas decorativas, badge ámbar del pozo, badge emoji del nivel), botones redondos, stats e historial a zinc.
- game-log.tsx: translúcido (bg-black/35 + backdrop-blur), system de sky a teal (regla anti-azul).
- Eliminado opponent-rail.tsx (sustituido por seat.tsx).
- reducer.ts: log de victoria corregido ("Ganaste el pozo de X tokens").
- Fix anti doble-cobro: lastJoinAtRef con throttle de 800ms en joinTable (el CLI de automatización disparó dos POST /api/game/join con un solo click; verificado en dev.log).
- Verificación con agent-browser (desktop 1280×800 y móvil 375×812): lobby → mesa → apertura con doble más alto → jugadas propias (lado único inmediato + diálogo ¿Dónde colocas la ficha? con extremos) → bots jugando fichas reales por ambos lados → pase automático sin jugada → bloqueo → fin de partida con diálogo (Kira ganó, -100, pozo 400) → volver al lobby. Cadena centrada con patrón H-V-H-V correcto, extremos coincidentes en cada captura. 0 errores de consola y 0 errores de página.
- Limpieza: BD reseteada a estado pristine (jugador "default": 1000 tokens, 0 registros, historial vacío), eliminados autoplay.sh y capturas de verificación.

Stage Summary:
- La mesa ahora imita la app Plato: vista cenital de fieltro verde con aro de madera, avatares de animales alrededor con halo de turno, fichas blancas horizontales con dobles en cruz, pila de pozo de casino en el fieltro y mano del jugador solapando el borde inferior.
- Sin cambios de reglas ni de APIs: el rediseño es solo presentación; motor, reducer y endpoints intactos.
- Protegido el join contra doble click (throttle 800ms) además del guard concurrente existente.
- BD en estado limpio para el usuario: 1000 tokens al entrar.

---
Task ID: 5
Agent: Z.ai Code (main agent)
Task: Arreglar bugs reportados por el usuario ("la mesa sigue igual, bug igual que las fichas")

Work Log:
- Diagnóstico con agent-browser + inspección DOM: la ficha vertical renderizaba sus dos mitades LADO A LADO (flex row) en vez de apiladas → los pips quedaban amontonados en una franja central cruzando el divisor (bug principal de "las fichas").
- domino-tile.tsx reescrito: vertical = flex-col (mitades flex-1 apiladas + divisor horizontal w-[58%]), horizontal = flex-row (mitades flex-1 + divisor vertical h-[58%]); eliminado el apagado opacity-60+saturate-0.7 que hacía las fichas GRISACES sobre fondo oscuro (ahora brightness-0.97 sutil); dorso rediseñado (punto esmeralda central en vez de óvalo); fichas jugables llevan aro esmeralda permanente (no solo hover); pips bg-zinc-900 para máximo contraste.
- page.tsx: PotChips rehecho — pila limpia de 3 fichas de casino (rojo/rosa/ámbar con anillos blancos) en vez de la mancha amarilla.
- globals.css: .plato-table ahora es aro esmeralda brillante tipo juguete (gradiente #34d399→#059669, brillo interior superior) en lugar de madera oscura realista; .plato-felt más vivo (#3ddc84→#1f9e55).
- Bordes #0e2a1d → border-emerald-800 en la mesa principal y en MiniTable del lobby.
- Verificación E2E con agent-browser (desktop 1280×800 y móvil 375×812): partida completa en Mesa Novato — apertura obligatoria [6|6] en cruz, bots juegan fichas reales por ambos lados, [6|4] horizontal con 6 rotado (2 filas × 3 pips) correcto, diálogo ¿Dónde colocas la ficha? con extremos 1/3, pase sin jugada disponible con botón ⏭, fin por mano vacía de Lola con diálogo de resultado, "Jugar otra vez" (nueva partida con descuento correcto), abandono con AlertDialog; 0 errores de consola/página.
- BD reseteada a pristine: jugador "default" con 1000 tokens, 0 partidas, historial vacío.

Stage Summary:
- BUG RAÍZ de las fichas corregido: las mitades ahora se apilan correctamente (6 = 2 columnas × 3 filas en vertical, 2 filas × 3 columnas en horizontal); las fichas son BLANCAS nítidas siempre (sin aspecto gris/muerto) y las jugables destacan con aro esmeralda.
- La mesa ya no parece realista: aro esmeralda brillante estilo juguete + fieltro verde vivo, pozo como pila de fichas de casino, pilas de bots como montoncitos blancos con punto verde.
- Motor, reducer y APIs intactos (solo presentación). BD en estado limpio para el usuario.

---
Task ID: 6
Agent: Z.ai Code (main agent)
Task: "quiero que las fichas se organizen en la mesa" — layout serpenteante para la cadena

Work Log:
- board-chain.tsx reescrito: la cadena ya no es una tira con scroll horizontal; ahora es una SERPENTINA que se organiza sola en filas alternadas (izq→der, luego der→izq, …) sobre el fieltro, sin recortes.
- computeLayout: reparte las fichas en filas midiendo el ancho real del contenedor (ResizeObserver); elige el nivel de tamaño más grande que quepa en el presupuesto de alto: md (88px, escritorio) → sm (64px) → xs (50px, móvil/extremos); si nada cabe, queda xs con scroll interno fino.
- Filas invertidas (der→izq) renderizan las mitades INTERCAMBIADAS (top=right, bottom=left) para que los puntos que se tocan en cada costura sigan coincidiendo; los dobles van en cruz en todas las filas.
- domino-tile.tsx: añadido tamaño xs (50×25, puntos de 3px) para móviles.
- Animación: solo las fichas recién jugadas entran con spring (patrón de ajuste de estado en render: seenIds/freshIds derivados al cambiar la referencia de chain, sin setState en efectos → lint limpio); las que se reacomodan entre filas no parpadean (initial=false).
- page.tsx: mesa móvil más alta (min-h 540px) y cadena centrada (top-1/2) para que las filas extra no choquen con el pozo; presupuesto de alto por breakpoint (236 escritorio / 286 móvil) vía matchMedia.
- Fixes durante verificación: fallback devolvía el nivel más grande (md) cuando ningún nivel cabía → ahora devuelve el más pequeño; xs compactado de 52→50px para que 23 fichas entren en 5 filas exactas en móvil.
- Verificación E2E (1280×800 y 375×812): partida completa con 23 fichas en mesa — escritorio: 3 filas sm; móvil: 5 filas xs sin scroll apreciable, sin solapamientos con asientos ni pozo; costuras de puntos verificadas; fin de partida, diálogo de resultado y "Volver al lobby" OK; 0 errores de consola/página.
- BD reseteada a pristine (1000 tokens, 0 partidas).

Stage Summary:
- Las fichas ahora se organizan solas en serpentina sobre la mesa (estilo tablero real de dominó / Plato), con dobles en cruz, puntos coincidentes en cada unión y tamaño adaptativo según espacio disponible. Motor, reducer y APIs intactos.

---
Task ID: 7
Agent: Z.ai Code (main agent)
Task: "quiero los perfiles de los jugadores afuera de la mesa, igual que las fichas que tienen en la mano; sobre la mesa solamente las fichas jugadas bien organizadas"

Work Log:
- seat.tsx rehecho: cada perfil es ahora una CÁPSULA de cristal (borde + bg-zinc-900/60 + backdrop-blur) que vive FUERA del fieltro; contiene avatar circular más grande (h-11/h-13), píldora de nombre y la PILA de fichas de la mano boca abajo (h-8 w-4 solapadas, max 7) como sosteniéndolas frente al jugador; la cápsula del turno activo se tiñe de ámbar con halo. El humano no lleva pila (sus fichas reales van al lado).
- page.tsx reestructurado (se eliminó el posicionamiento absoluto dentro del felt): Lola arriba-centro sobre la mesa; Max y Kira a izquierda/derecha en md+; en móvil los tres rivales comparten una fila superior (justify-between); el pozo (PotChips → nueva PotPill compacta) salió del fieltro a la fila de controles junto a Apuesta / Extremos / ⏭ Pasar turno / Salir; la sección "Tus fichas" ahora es tu cápsula + la mano real, debajo de la mesa.
- Felt exclusivo de la cadena: plato-felt pasó a flex min-h-[400/440] items-center justify-center con SOLO BoardChain dentro (sin asientos, sin pozo, sin botón de pase).
- board-chain.tsx: filas SIEMPRE centradas (justify-center, serpentina en espiral), eliminado el scroll interno, presupuestos de alto ampliados (390 escritorio / 330 móvil) aprovechando que la mesa ya no comparte espacio; nueva prop glow en DominoTile marca los dos EXTREMOS abiertos de la cadena con aro esmeralda.
- Verificación E2E (1280×800 y 375×812): apertura [6|6], diálogo ¿Dónde colocas la ficha? con extremos, bots jugando por ambos lados, pilas de las cápsulas reduciéndose en vivo (7→6→…), pase con botón ⏭, dos partidas completas; cadena de 24 fichas en 3 filas (escritorio) y 20 fichas en 4 filas (móvil) con costuras verificadas por DOM (right[i]===left[i+1] en el 100% de las uniones); extremos con glow; footer empujado naturalmente; flujo Salir → Abandonar y perder apuesta OK; 0 errores de consola y de página.
- Lint limpio. BD reseteada a pristine (jugador "default": 1000 tokens, 0 partidas, historial vacío) tras las pruebas.

Stage Summary:
- Los perfiles con sus fichas en mano (boca abajo) ahora rodean la mesa por fuera como en la app Plato; el fieltro muestra ÚNICAMENTE las fichas jugadas, organizadas en serpentina centrada con los extremos abiertos marcados en esmeralda.
- Sin cambios de reglas ni de APIs (solo presentación): motor, reducer y endpoints intactos. BD limpia para el usuario.

---
Task ID: 8
Agent: Z.ai Code (main agent)
Task: "busca en la web imágenes de un juego de dominó para que veas cómo se organizan las fichas encima de la mesa" — replicar el acomodo auténtico

Work Log:
- Búsqueda de imágenes reales con image-search (2 consultas, ~12 fotos analizadas): partida real con U-turns en los bordes, guía wikiHow con giros en L, dominó cubano con dobles en cruz y mesa caribeña de 4 jugadores. Conclusiones: fichas toca-toca SIN huecos, dobles SIEMPRE perpendiculares, giros con ficha esquina perpendicular que conecta filas, pips coincidentes visibles en cada costura y giro.
- board-chain.tsx reescrito por completo: la serpentina de filas separadas pasó a ser una SERPIENTE CONTINUA auténtica posicionada con coordenadas absolutas:
  * computeSnake simula el recorrido por niveles (md 88px → sm 64px → xs 50px, lado corto = mitad) y elige el mayor que quepa en el presupuesto de alto (390 escritorio / 330 móvil).
  * Fichas normales tumbadas extremo-con-extremo (gap 0), dobles EN CRUZ (sobresalen media ficha por cada lado de la línea).
  * Al llenarse una fila, la ficha del giro se coloca PERPENDICULAR colgando bajo el extremo de la fila (como el giro en L/U de una mesa real) y la fila siguiente regresa en dirección contraria alineada con la esquina.
  * PITCH ADAPTATIVO: la fila siguiente nace pegada al pie de la esquina; si la ficha que cuelga arriba era un doble en cruz la esquina baja medio lado, y si la primera ficha de la fila nueva es doble necesita medio lado más de aire → cero solapamientos con toque exacto en todos los casos.
  * Filas hacia la izquierda muestran las mitades intercambiadas para que los pips que se tocan (y los del giro) queden alineados; los extremos de la cadena conservan el aro esmeralda.
  * Contenedor con alto real; el bloque se centra horizontalmente (bounding box) y el fieltro crece si la serpiente es larguísima.
- domino-tile.tsx: nueva prop style (la serpiente fuerza el tamaño exacto en px por ficha, eliminando la discrepancia de clases sm/md en móvil).
- Auditoría geométrica por DOM en cada iteración: 24 fichas (escritorio) y 23 (móvil) con 0 solapamientos, distancia 0 entre fichas consecutivas (incluidos giros), todo dentro del fieltro y costuras right[i]===left[i+1] al 100%.
- Fixes durante verificación: (1) faltaba desplazar las Y al normalizar (las fichas de la fila 0 sobresalían 11px por arriba del fieltro); (2) solapamiento de 0.5·tS entre esquina y doble en cruz en los giros → pitch adaptativo; (3) el bucle de automatización pulsaba la ficha en vez de elegir lado cuando el diálogo estaba abierto (error del script de prueba, no del juego).
- Capturas finales comparadas con las fotos reales: patrón idéntico (fila, U-turn perpendicular, fila de regreso, segundo U-turn). 0 errores de consola y de página; lint limpio.
- BD reseteada a pristine (jugador "default": 1000 tokens, 0 partidas).

Stage Summary:
- Las fichas sobre la mesa ahora se organizan EXACTAMENTE como en un juego de dominó real: cadena continua toca-toca, dobles en cruz, giros perpendiculares que conectan las filas y pips coincidentes en cada unión. Motor, reducer y APIs intactos (solo presentación). BD limpia.

---
Task ID: 9
Agent: Z.ai Code (main agent)
Task: "el orden de juego es siempre hacia la derecha o sea como las manecillas del reloj" — el giro de turnos debe ser HORARIO alrededor de la mesa

Work Log:
- Análisis: el motor avanza (turn + 1) % 4 (Tú→Lola→Max→Kira) pero la disposición visual era Lola ARRIBA, Max IZQUIERDA, Kira DERECHA → el resaltado de turno saltaba abajo→arriba→izq→der (no circular, imposible en una mesa real).
- Geometría horaria requerida: Tú(abajo, 6:00) → IZQUIERDA(9:00) → FRENTE(12:00) → DERECHA(3:00). Fix mínimo: INTERCAMBIAR Lola y Max — Lola pasa a la IZQUIERDA y Max al FRENTE (arriba-centro); Kira queda a la derecha. Además coincide con la geometría real del dominó (compañero enfrente, rivales a los lados).
- page.tsx: fila superior móvil ahora Lola|Max|Kira (izq→der = orden de turno); en escritorio solo Max arriba-centro, Lola a la izquierda (hidden md:flex) y Kira a la derecha; comentarios actualizados documentando el giro horario. Mapeo de counts (botCounts) ajustado a cada asiento.
- types.ts: comentario doc en SEAT_NAMES: orden de turno = sentido horario (Tú abajo → Lola izq → Max frente → Kira der).
- seat.tsx y lobby.tsx auditados: sin supuestos de posición (solo page.tsx ubicaba asientos).
- Verificación E2E (1280×800): geometría por DOM — Max x=640 (centro), Lola x=184 (izq), Kira x=1091 (der), Tú abajo. Bitácora de DOS vueltas completas: Lola[6|6] → Max[4|6] → Kira[5|6] → Tú[0|4] → Lola[5|5] → Max[0|0] → Kira[4|5] → Tú — giro horario exacto 9:00→12:00→3:00→6:00.
- Verificación móvil (375×812): Lola x=16 | Max x=151 | Kira x=285 (fila superior leída en orden de turno); jugada [0|1] OK y rotación continuó Tú→Lola[1|6]→Max[2|6]→Kira[2|2].
- 0 errores de consola y de página en ambos viewports; layout y footer intactos.
- Lint limpio. BD reseteada a pristine (jugador "default": 1000 tokens, 0 partidas).

Stage Summary:
- El turno ahora gira SIEMPRE en sentido HORARIO (manecillas del reloj) alrededor de la mesa: Tú(abajo) → Lola(izquierda) → Max(frente) → Kira(derecha) → Tú, verificado dos vueltas completas por bitácora y geometría DOM en escritorio y móvil.
- Sin cambios de reglas ni de APIs: motor, reducer y endpoints intactos (el giro horario se logró reordenando la disposición visual de los asientos). BD limpia para el usuario.
