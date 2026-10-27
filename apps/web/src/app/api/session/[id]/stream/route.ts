import { NextRequest } from 'next/server';
import { getCameraSession } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let isClosed = false;
  let pollInterval: NodeJS.Timeout | null = null;
  let heartbeatInterval: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (event: string, data: any) => {
        if (isClosed) return;
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch (e) {
          cleanup();
        }
      };

      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        if (pollInterval) clearInterval(pollInterval);
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        try {
          controller.close();
        } catch (_) {}
      };

      req.signal.addEventListener('abort', cleanup);

      // 1. Initial connection acknowledgement
      sendEvent('init', { sessionId: id, status: 'listening' });

      // 2. Heartbeat to keep connection alive through proxies/firewalls
      heartbeatInterval = setInterval(() => {
        sendEvent('ping', { timestamp: Date.now() });
      }, 10000);

      // 3. State polling loop against Turso
      let lastReportedStatus: string = 'pending';

      pollInterval = setInterval(async () => {
        if (isClosed) return;

        try {
          const session = await getCameraSession(id);
          if (!session) {
            sendEvent('expired', { message: 'Session expired or not found' });
            cleanup();
            return;
          }

          if (session.status !== lastReportedStatus) {
            lastReportedStatus = session.status;
            sendEvent('status-change', { status: session.status });
          }

          if (session.status === 'completed' && session.image_data) {
            sendEvent('photo-captured', {
              sessionId: id,
              imageData: session.image_data,
            });
            // Complete session delivery
            cleanup();
          }
        } catch (err) {
          console.error('[SSE Stream Error]:', err);
        }
      }, 800);
    },
    cancel() {
      isClosed = true;
      if (pollInterval) clearInterval(pollInterval);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disables proxy buffering on NGINX/Vercel
    },
  });
}
