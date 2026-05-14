import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * BugBouncer Network Proxy (Next.js 16 Standard)
 * 
 * This replaces middleware.ts for network boundary control.
 * It intercepts outgoing requests to inject trace headers and
 * incoming responses to capture latency and payload metadata.
 */

export function proxy(request: NextRequest) {
  const trace_id = crypto.randomUUID();
  const start_time = performance.now();

  // 1. Inject Trace Context into request headers
  const request_headers = new Headers(request.headers);
  request_headers.set('X-BugBouncer-Trace-Id', trace_id);

  // 2. Pass request to destination
  const response = NextResponse.next({
    request: {
      headers: request_headers,
    },
  });

  // 3. Record network metadata (Async/Non-blocking)
  // In a real implementation, this would be sent to the Causal Kernel via SharedArrayBuffer
  // for deterministic recording.
  const end_time = performance.now();
  const latency_ms = end_time - start_time;

  response.headers.set('X-BugBouncer-Latency', latency_ms.toFixed(2));

  return response;
}

// Config to target specific routes
export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
