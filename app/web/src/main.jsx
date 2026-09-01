/**
 * main.jsx - Onde o aplicativo comeca.
 *
 * Monta a arvore de componentes na pagina, na ordem:
 *
 *   StrictMode      avisos extras do React durante o desenvolvimento
 *   BrowserRouter   habilita a navegacao por endereco
 *   ProvedorSessao  disponibiliza usuário e permissões para tudo abaixo
 *   App             o mapa de rotas
 *
 * O sistema tem cores fixas: nao ha tema para aplicar antes de desenhar.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { ProvedorSessao } from "./lib/sessao.jsx";
import "./styles/app.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ProvedorSessao>
        <App />
      </ProvedorSessao>
    </BrowserRouter>
  </React.StrictMode>
);
