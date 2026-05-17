import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, NextRequest } from 'next/server';
import type { NextFetchEvent } from 'next/server';

/**
 * BugBouncer Network Proxy (Next.js 16 Standard)
 * 
 * This integrates Clerk authentication with network boundary control.
 * It intercepts outgoing requests to inject trace headers and
 * incoming responses to capture latency and payload metadata.
 */

const is_public_route = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/ingest(.*)',
  '/api/webhooks(.*)',
  '/api/public(.*)',
]);

const clerk = clerkMiddleware(async (auth, request) => {
  if (!is_public_route(request)) {
    await auth.protect();
  }
});

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const trace_id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const start_time = performance.now();

  try {
    // 1. Inject Trace Context into request headers
    const request_headers = new Headers(request.headers);
    request_headers.set('X-BugBouncer-Trace-Id', trace_id);

    // Create a modified request with the injected trace headers to pass to Clerk
    const modified_request = new NextRequest(request, {
      headers: request_headers,
    });

    // 2. Run Clerk authentication middleware
    const clerk_response = await clerk(modified_request, event);

    const end_time = performance.now();
    const latency_ms = end_time - start_time;

    // 3. Process the response and capture latency
    if (clerk_response) {
      // Check if Clerk returned a redirect or terminal block response
      const is_redirect = clerk_response.headers.get('Location') || 
                          clerk_response.status === 307 || 
                          clerk_response.status === 302;
      
      if (is_redirect) {
        return clerk_response;
      }

      // Inject telemetry latency into the response headers gracefully
      try {
        clerk_response.headers.set('X-BugBouncer-Latency', latency_ms.toFixed(2));
      } catch (err) {
        console.warn('[Telemetry] Failed to set response headers on clerk_response:', err);
      }
      return clerk_response;
    }

    // 4. Otherwise, pass request upstream with trace headers injected
    const response = NextResponse.next({
      request: {
        headers: request_headers,
      },
    });

    try {
      response.headers.set('X-BugBouncer-Latency', latency_ms.toFixed(2));
    } catch (err) {
      console.warn('[Telemetry] Failed to set response headers on next_response:', err);
    }

    return response;
  } catch (error) {
    // Kernel Panic Protocol: catch failures gracefully and return fallback configurations
    console.error('[Telemetry Critical] Proxy pipeline error, falling back to clean pass:', error);
    
    // In case of critical error, try to return a clean NEXT response so we don't break the application
    try {
      return NextResponse.next();
    } catch (fallback_error) {
      console.error('[Telemetry Critical] Fallback failed:', fallback_error);
      // Terminal raw response fallback
      return new Response('Internal Server Error (Observability Fail-safe)', { status: 500 });
    }
  }
}

// Export default to support all Next.js 16 conventions
export default proxy;

// Config to target specific routes, avoiding static assets
export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
