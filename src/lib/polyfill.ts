// src/lib/polyfill.ts
// Cloudflare Workers runtime global polyfills for Node APIs
export function initPolyfills() {
  const g = globalThis as unknown as { process?: Record<string, unknown> };

  if (typeof g.process === "undefined") {
    g.process = {
      env: {
        NODE_ENV: "production",
        TSS_PRERENDERING: "false",
        TSS_SHELL: "false",
      },
      cwd: () => "/",
      nextTick: (fn: (...args: unknown[]) => void, ...args: unknown[]) =>
        setTimeout(() => fn(...args), 0),
    };
  } else {
    if (!g.process.env) {
      g.process.env = {
        NODE_ENV: "production",
        TSS_PRERENDERING: "false",
        TSS_SHELL: "false",
      };
    }
  }
}

initPolyfills();
