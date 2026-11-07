import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cartella di build separata per la prova offline (tests/e2e/offline.e2e.mjs), così non tocca quella di sviluppo
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
