import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves project sites from /<repository-name>/.
  // The workflow supplies this value; local development keeps / as the base.
  base: process.env.BASE_PATH || "/",
});
