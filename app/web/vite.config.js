import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    /*
     * Escuta em todas as interfaces da maquina, e nao so em localhost.
     *
     * E o que permite abrir o SITRA no celular, na mesma rede, digitando
     * http://<ip-da-maquina>:5173 - e e o unico jeito de TESTAR O QR CODE de
     * verdade: o adesivo leva a uma URL, e "localhost" no celular aponta para o
     * proprio celular, onde nao ha nada rodando.
     *
     * O endereco que vai gravado dentro do QR Code vem de URL_PUBLICA, no .env
     * da API - os dois precisam combinar.
     *
     * Vale so em desenvolvimento (o Vercel serve os arquivos ja construidos).
     * Na primeira vez o Windows pergunta se libera o Node no firewall: sem
     * liberar, o celular nao chega na porta.
     */
    host: true,
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
