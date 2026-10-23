import { NextResponse } from 'next/server';
import os from 'os';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

const QR_OPTS = {
  width: 512,
  margin: 1,
  color: { dark: '#1b0b2a', light: '#ffffff' },
} as const;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const origin = searchParams.get('origin') ?? '';

    // QR de la URL actual (lo que ve el navegador que pide)
    let originQr: string | null = null;
    if (/^https?:\/\//i.test(origin)) {
      originQr = await QRCode.toDataURL(origin, QR_OPTS);
    }

    // IPs de la red local del servidor (para jugar por WiFi desde el ZIP en tu PC)
    const port = process.env.PORT || '3000';
    const lan: { name: string; ip: string; url: string; qr: string }[] = [];
    for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
      for (const addr of addrs ?? []) {
        if (addr.family !== 'IPv4' || addr.internal) continue;
        // filtra direcciones no privadas (solo rangos LAN típicos)
        if (!/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(addr.address)) continue;
        const url = `http://${addr.address}:${port}`;
        try {
          const qr = await QRCode.toDataURL(url, QR_OPTS);
          lan.push({ name, ip: addr.address, url, qr });
        } catch {
          lan.push({ name, ip: addr.address, url, qr: '' });
        }
        if (lan.length >= 3) break;
      }
      if (lan.length >= 3) break;
    }

    return NextResponse.json(
      { originQr, lan, port },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ originQr: null, lan: [], port: '3000' }, { status: 200 });
  }
}
