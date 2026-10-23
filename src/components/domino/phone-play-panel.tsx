'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Smartphone, X, QrCode, Wifi, RefreshCw, Download } from 'lucide-react';

type LanInfo = { name: string; ip: string; url: string; qr: string };
type LanData = { originQr: string | null; lan: LanInfo[]; port: string };

/**
 * Botón flotante + panel con códigos QR para abrir el juego en el teléfono:
 * - QR de la URL actual (útil si se accede por un enlace compartido)
 * - QR de la red local del servidor (para jugar por WiFi desde el PC)
 */
export function PhonePlayPanel() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<LanData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const requested = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await fetch(`/api/lan-info?origin=${encodeURIComponent(origin)}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('bad response');
      setData((await res.json()) as LanData);
      requested.current = true;
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && !requested.current) void load();
  }, [open, load]);

  const sameHostAsOrigin =
    typeof window !== 'undefined' && data?.lan.some((l) => window.location.host === l.url.split('//')[1]);

  return (
    <>
      {/* botón flotante */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="panel-movil"
        className="fixed bottom-3 right-3 z-40 flex items-center gap-1.5 rounded-full border-2 border-[#3b0764] bg-gradient-to-b from-[#a855f7] to-[#7e22ce] px-3 py-2 text-xs font-black uppercase tracking-wide text-white shadow-[0_4px_0_#2e0a49] transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-[2px] active:shadow-none sm:bottom-4 sm:right-4 sm:text-[13px]"
        aria-label="Probar el juego en el teléfono"
      >
        <Smartphone className="size-4" aria-hidden />
        <span className="hidden sm:inline">Probar en el móvil</span>
        <span className="sm:hidden">Móvil</span>
      </button>

      {/* panel */}
      {open && (
        <div
          id="panel-movil"
          data-testid="phone-panel"
          role="dialog"
          aria-label="Cómo jugar en el teléfono"
          className="fixed bottom-16 right-3 z-40 w-[min(92vw,340px)] max-h-[80vh] overflow-y-auto rounded-2xl border-2 border-purple-300/30 bg-[#1c1122]/95 p-4 text-purple-50 shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur-sm sm:bottom-20 sm:right-4"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide">
              <QrCode className="size-4 text-purple-300" aria-hidden />
              Juega en tu teléfono
            </h2>
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar panel del móvil"
              className="rounded-full p-1 text-purple-200 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-purple-200">
              <RefreshCw className="size-4 animate-spin" aria-hidden />
              Generando códigos QR…
            </div>
          )}

          {error && !loading && (
            <div className="py-6 text-center text-sm">
              <p className="mb-3 text-purple-100">No se pudieron generar los QR.</p>
              <button
                onClick={() => void load()}
                className="rounded-xl border-2 border-purple-300/40 bg-purple-500/20 px-4 py-2 text-xs font-bold uppercase hover:bg-purple-500/30"
              >
                Reintentar
              </button>
            </div>
          )}

          {data && !loading && (
            <div className="flex flex-col gap-3">
              {/* QR de la URL actual */}
              {data.originQr ? (
                <section>
                  <h3 className="mb-1.5 text-xs font-bold text-purple-200">
                    1. Escanea con la cámara del teléfono
                  </h3>
                  <div className="flex items-center gap-3">
                    <img
                      src={data.originQr}
                      alt={`Código QR para abrir ${typeof window !== 'undefined' ? window.location.host : 'el juego'} en el teléfono`}
                      className="size-28 rounded-lg bg-white p-1 shadow-md"
                    />
                    <p className="text-[11px] leading-snug text-purple-100/90">
                      Apunta la cámara del teléfono al código y abre el enlace.
                      Si ya estás en el teléfono, sigue el paso 3.
                    </p>
                  </div>
                </section>
              ) : null}

              {/* QR por WiFi (servidor en la red local) */}
              {data.lan.length > 0 && !sameHostAsOrigin && (
                <section className="rounded-xl border border-emerald-300/25 bg-emerald-400/10 p-3">
                  <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-emerald-200">
                    <Wifi className="size-3.5" aria-hidden />
                    2. Jugar por WiFi (juego corriendo en tu PC)
                  </h3>
                  {data.lan.slice(0, 2).map((l) => (
                    <div key={l.ip} className="mt-2 flex items-center gap-3">
                      {l.qr ? (
                        <img
                          src={l.qr}
                          alt={`Código QR para abrir ${l.url} en el teléfono`}
                          className="size-24 rounded-lg bg-white p-1 shadow-md"
                        />
                      ) : null}
                      <div className="min-w-0 text-[11px] leading-snug text-emerald-50/90">
                        <p>
                          Teléfono y PC en el <strong>mismo WiFi</strong>, luego escanea o abre:
                        </p>
                        <p className="mt-1 break-all font-mono text-emerald-200">{l.url}</p>
                      </div>
                    </div>
                  ))}
                </section>
              )}

              {/* instalar como app */}
              <section className="rounded-xl border border-purple-300/25 bg-white/5 p-3">
                <h3 className="mb-1 flex items-center gap-1.5 text-xs font-bold text-purple-200">
                  <Download className="size-3.5" aria-hidden />
                  3. Instálala como app
                </h3>
                <ul className="list-disc space-y-1 pl-4 text-[11px] leading-snug text-purple-100/90">
                  <li>
                    <strong>Android (Chrome):</strong> menú ⋮ → «Añadir a pantalla de inicio»
                  </li>
                  <li>
                    <strong>iPhone (Safari):</strong> botón Compartir → «Añadir a pantalla de inicio»
                  </li>
                </ul>
                <p className="mt-1.5 text-[11px] text-purple-200/80">
                  El juego se instala con icono propio, como una app más.
                </p>
              </section>
            </div>
          )}
        </div>
      )}
    </>
  );
}
