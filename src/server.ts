import { initPolyfills } from "./lib/polyfill";
initPolyfills();
import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  const captured = consumeLastCapturedError();
  const errorObj = captured ?? new Error(`h3 swallowed SSR error: ${body}`);
  console.error(errorObj);
  const detail =
    errorObj instanceof Error ? `${errorObj.message}\n${errorObj.stack ?? ""}` : String(errorObj);
  return new Response(renderErrorPage(detail), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

import { handleApiRequest } from "./lib/api-router";

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) {
        const mergedEnv = {
          ...(typeof process !== "undefined" ? process.env : {}),
          ...(typeof env === "object" && env !== null ? env : {}),
        };
        return await handleApiRequest(request, mergedEnv);
      }

      // If running on Cloudflare Workers with [assets] binding
      const workerEnv = env as
        { ASSETS?: { fetch: (req: Request) => Promise<Response> } } | undefined;
      if (workerEnv?.ASSETS && typeof workerEnv.ASSETS.fetch === "function") {
        const assetResponse = await workerEnv.ASSETS.fetch(request);
        if (assetResponse.status !== 404) {
          // Content-hashed assets can be cached immutably for 1 year to minimize bandwidth
          if (url.pathname.startsWith("/assets/")) {
            const cachedHeaders = new Headers(assetResponse.headers);
            cachedHeaders.set("Cache-Control", "public, max-age=31536000, immutable");
            return new Response(assetResponse.body, {
              status: assetResponse.status,
              statusText: assetResponse.statusText,
              headers: cachedHeaders,
            });
          }
          return assetResponse;
        }
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);

      // Add HTML freshness header so UI updates reflect immediately without stale cache
      if (normalized.headers.get("content-type")?.includes("text/html")) {
        const freshHeaders = new Headers(normalized.headers);
        freshHeaders.set("Cache-Control", "public, max-age=0, must-revalidate");
        return new Response(normalized.body, {
          status: normalized.status,
          statusText: normalized.statusText,
          headers: freshHeaders,
        });
      }

      return normalized;
    } catch (error) {
      console.error(error);
      const detail =
        error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
      return new Response(renderErrorPage(detail), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
