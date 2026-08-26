/**
 * main.jsx - Onde o aplicativo comeca.
 *
 * Monta a arvore de componentes na pagina, na ordem:
 *
 *   StrictMode      avisos extras do React durante o desenvolvimento
 *   BrowserRouter   habilita a navegacao por endereco
 *   ProvedorSessao  disponibiliza usuario e permissoes para tudo abaixo
 *   App             o mapa de rotas
 *
 * Tambem aplica o tema salvo (claro ou escuro) ANTES de desenhar, para a tela
 * nao piscar em branco antes de escurecer.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { ProvedorSessao } from "./lib/sessao.jsx";
import { aplicarTema, temaAtual } from "./lib/tema.js";
import "./styles/app.css";

aplicarTema(temaAtual());

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ProvedorSessao>
        <App />
      </ProvedorSessao>
    </BrowserRouter>
  </React.StrictMode>
);
