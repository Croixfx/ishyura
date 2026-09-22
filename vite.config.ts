import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default defineConfig({
  define: {
    "process.env.TSS_PRERENDERING": JSON.stringify("false"),
    "process.env.TSS_SHELL": JSON.stringify("false"),
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "production"),
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
    }),
    viteReact(),
  ],
});
