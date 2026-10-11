const PAYMENT_PAGE_CACHE = "ishyura-payment-pages-v1";
const PAYMENT_PAGE_TTL_MS = 24 * 60 * 60 * 1000;
const NETWORK_TIMEOUT_MS = 3000;
const CACHE_TIMESTAMP_HEADER = "X-Ishyura-Cached-At";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !/^\/p\/[^/]+$/.test(url.pathname)
  ) {
    return;
  }

  event.respondWith(handlePaymentPageRequest(request));
});

async function handlePaymentPageRequest(request) {
  const cache = await caches.open(PAYMENT_PAGE_CACHE);
  let cachedResponse = await cache.match(request);

  if (cachedResponse) {
    const cachedAt = Number(cachedResponse.headers.get(CACHE_TIMESTAMP_HEADER));
    if (!Number.isFinite(cachedAt) || Date.now() - cachedAt > PAYMENT_PAGE_TTL_MS) {
      await cache.delete(request);
      cachedResponse = null;
    }
  }

  const networkResponse = fetch(request).then(async (response) => {
    if (response.status >= 500) {
      throw new Error(`Payment page returned ${response.status}.`);
    }
    if (response.status === 200) {
      const headers = new Headers(response.headers);
      headers.set(CACHE_TIMESTAMP_HEADER, String(Date.now()));
      const cachedCopy = new Response(await response.clone().arrayBuffer(), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      try {
        await cache.put(request, cachedCopy);
      } catch (error) {
        console.warn("Could not cache the payment page for offline use.", error);
      }
    }
    return response;
  });

  try {
    if (!cachedResponse) {
      return await networkResponse;
    }

    return await withTimeout(networkResponse, NETWORK_TIMEOUT_MS);
  } catch (error) {
    if (!cachedResponse) {
      console.warn("Payment page is unavailable and has no saved offline copy.", error);
      return new Response("Payment page unavailable. Reconnect and scan again.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return markAsOfflineFallback(cachedResponse);
  }
}

function withTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Payment page network request timed out.")),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

async function markAsOfflineFallback(response) {
  const html = (await response.text()).replace("<body ", '<body data-cached-fallback="true" ');
  const headers = new Headers(response.headers);
  headers.delete(CACHE_TIMESTAMP_HEADER);
  headers.delete("Content-Length");
  headers.delete("Content-Encoding");
  headers.delete("Transfer-Encoding");

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
