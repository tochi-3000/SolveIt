import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import os from 'os';
import { createCameraSession } from '@/lib/db';

/**
 * Production Safeguard: Resolves the computer's active Wi-Fi/LAN IPv4 address
 * when the desktop browser is accessed via `localhost` or `127.0.0.1`,
 * ensuring mobile phones on the same Wi-Fi/hotspot can reach the dev server.
 */
function resolveReachableOrigin(req: NextRequest): string {
  // 1. Explicit public/tunnel override if configured (e.g., ngrok, Cloudflare Tunnel, or Vercel URL)
  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, '');
  }

  const hostHeader = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
  const protoHeader = req.headers.get('x-forwarded-proto') || 'http';

  const isLocalhost =
    hostHeader.startsWith('localhost') ||
    hostHeader.startsWith('127.0.0.1') ||
    hostHeader.startsWith('[::1]');

  // If already accessed via a real domain, tunnel, or LAN IP, preserve it
  if (!isLocalhost) {
    return `${protoHeader}://${hostHeader}`;
  }

  // Extract port (default 3000)
  const portMatch = hostHeader.match(/:(\d+)$/);
  const port = portMatch ? portMatch[1] : '3000';

  // Discover non-internal IPv4 LAN address (prioritizing Wi-Fi / Ethernet over virtual adapters)
  const interfaces = os.networkInterfaces();
  let fallbackIp: string | null = null;

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    const lowerName = name.toLowerCase();
    const isVirtual =
      lowerName.includes('vethernet') ||
      lowerName.includes('wsl') ||
      lowerName.includes('docker') ||
      lowerName.includes('vmware') ||
      lowerName.includes('virtualbox');

    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal && !addr.address.startsWith('169.254.')) {
        if (!isVirtual) {
          return `http://${addr.address}:${port}`;
        }
        if (!fallbackIp) {
          fallbackIp = addr.address;
        }
      }
    }
  }

  if (fallbackIp) {
    return `http://${fallbackIp}:${port}`;
  }

  return `${protoHeader}://${hostHeader}`;
}

export async function POST(req: NextRequest) {
  try {
    const sessionId = nanoid(8);
    await createCameraSession(sessionId);

    const capturePath = `/capture?session=${sessionId}`;
    const origin = resolveReachableOrigin(req);

    return NextResponse.json({
      success: true,
      sessionId,
      capturePath,
      captureUrl: `${origin}${capturePath}`,
    });
  } catch (err: any) {
    console.error('Failed to create camera session:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to initialize session' },
      { status: 500 }
    );
  }
}
