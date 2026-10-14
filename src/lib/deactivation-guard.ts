import { IshyuraClient } from "@/lib/ishyura-client";

/**
 * When an admin deactivates a merchant who is already signed in, the server answers every request with
 * 403 ACCOUNT_DEACTIVATED. This watches for that answer, signs the person out and sends them to the
 * landing page with a short explanation, instead of leaving them on a page full of failed requests.
 * Sign-in requests are left alone: the sign-in dialog shows the same message itself.
 */
let installed = false;
let handling = false;

export function installDeactivationGuard(): void {
  if (installed || typeof window === "undefined" || typeof window.fetch !== "function") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await originalFetch(input, init);
    if (response.status !== 403 || handling) return response;

    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    if (url.includes("/auth/")) return response;

    try {
      const body = (await response.clone().json()) as { error?: string };
      if (body?.error === "ACCOUNT_DEACTIVATED") {
        handling = true;
        IshyuraClient.logout();
        window.location.assign("/?deactivated=1");
      }
    } catch {
      // not a JSON answer: nothing to do
    }
    return response;
  };
}
