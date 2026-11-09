import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cartella di build separata per la prova offline (tests/e2e/offline.e2e.mjs), così non tocca quella di sviluppo
  distDir: process.env.NEXT_DIST_DIR || '.next',
  experimental: {
    // tornando su una scheda già aperta negli ultimi 60 secondi la pagina si mostra subito dalla memoria del browser;
    // ogni salvataggio (azioni del server con revalidatePath) svuota questa memoria, quindi i dati modificati si vedono aggiornati
    staleTimes: { dynamic: 60, static: 300 },
  },
};

export default nextConfig;
