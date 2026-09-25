import { handleEdgePayPage } from "../../src/lib/edge-pay-renderer";
import { type AppEnv } from "../../src/lib/api-router";

export const onRequest: PagesFunction<AppEnv> = async (context) => {
  return handleEdgePayPage(context.request, context.env);
};
