import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Em desenvolvimento, o front chama /api/... e o Vite repassa para a API
    // local. Nao ha CORS nem URL de servidor espalhada pelo codigo.
    proxy: {
      "/api": {
        target: "http://localhost:3333",
        changeOrigin: true,
      },
    },
  },
  // VITE_API_URL so e usada no build de producao (Vercel), onde ela aponta
  // para a API no Render. Em dev a variavel nao existe e o proxy acima
  // cuida de tudo.
  define: {
    __API_URL__: JSON.stringify(process.env.VITE_API_URL || ""),
  },
});
