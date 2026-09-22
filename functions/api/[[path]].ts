import { handleApiRequest, type AppEnv } from "../../src/lib/api-router";

// Cloudflare Pages Function routing all /api/* calls to the D1 API Router
export const onRequest: PagesFunction<AppEnv> = async (context) => {
  return handleApiRequest(context.request, context.env);
};
