/**
 * App.jsx - O mapa de rotas do sistema.
 *
 * Diz qual componente aparece em cada endereco. Tres camadas de protecao:
 *
 *   Protegido      exige estar logado; sem token, manda para /entrar
 *   ComPermissao   exige uma permissao; sem ela, mostra "sem acesso" no lugar
 *                  da tela (assim ninguem chega numa tela que so daria erro)
 *   Layout         a moldura com barra lateral e topo, comum a todas as telas
 *
 * Duas rotas ficam FORA do Layout de proposito:
 *   /entrar             a tela de login nao tem menu
 *   /checklist/:token   o checklist do QR Code, aberto no celular sem login
 */
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import { useSessao } from "./lib/sessao.jsx";

import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ChecklistQr from "./pages/ChecklistQr.jsx";
import EmConstrucao from "./pages/EmConstrucao.jsx";

import Veiculos from "./pages/frotas/Veiculos.jsx";
import VeiculoQrCode from "./pages/frotas/VeiculoQrCode.jsx";
import VeiculoDetalhe from "./pages/frotas/VeiculoDetalhe.jsx";
import ChecklistDetalhe from "./pages/frotas/ChecklistDetalhe.jsx";
import InspecaoDetalhe from "./pages/frotas/InspecaoDetalhe.jsx";
import Checklists from "./pages/frotas/Checklists.jsx";
import Inspecoes from "./pages/frotas/Inspecoes.jsx";
import Manutencoes from "./pages/frotas/Manutencoes.jsx";
import Documentos from "./pages/frotas/Documentos.jsx";
import Sinistros from "./pages/frotas/Sinistros.jsx";
import Relatorios from "./pages/frotas/Relatorios.jsx";
import RelatorioVer from "./pages/frotas/RelatorioVer.jsx";

import ServicoDiario from "./pages/fiscalizacao/ServicoDiario.jsx";
import Equipes from "./pages/fiscalizacao/Equipes.jsx";
import Viaturas from "./pages/fiscalizacao/Viaturas.jsx";
import Ocorrencias from "./pages/fiscalizacao/Ocorrencias.jsx";
import ManutencoesFisc from "./pages/fiscalizacao/ManutencoesFisc.jsx";
import ChecklistsFiscalizacao from "./pages/fiscalizacao/ChecklistsFiscalizacao.jsx";
import Pontuacao from "./pages/fiscalizacao/Pontuacao.jsx";

import Usuarios from "./pages/admin/Usuarios.jsx";
import Servidores from "./pages/admin/Servidores.jsx";
import Perfis from "./pages/admin/Perfis.jsx";
import Setores from "./pages/admin/Setores.jsx";
import Parametros from "./pages/admin/Parametros.jsx";

import LogsAcesso from "./pages/auditoria/LogsAcesso.jsx";
import LogsAcoes from "./pages/auditoria/LogsAcoes.jsx";
import Alteracoes from "./pages/auditoria/Alteracoes.jsx";
import ExportarLogs from "./pages/auditoria/ExportarLogs.jsx";

function Protegido({ children }) {
  const { usuario, carregando } = useSessao();
  if (carregando) return <div className="carregando">Carregando...</div>;
  if (!usuario) return <Navigate to="/entrar" replace />;
  return children;
}

// Barra a rota inteira quando o perfil nao tem a permissao, para o usuario nao
// chegar numa tela que so vai dar erro de API.
function ComPermissao({ codigo, children }) {
  const { podeVer } = useSessao();
  if (!podeVer(codigo)) {
    return (
      <div className="cartao">
        <div className="vazio">
          Seu perfil nao tem acesso a esta tela. Procure a administracao do sistema.
        </div>
      </div>
    );
  }
  return children;
}

const FROTAS = "FROTAS_VISUALIZAR";
const FISC = "FISCALIZACAO_VISUALIZAR";
const ADMIN = "ADMIN_VISUALIZAR";
const AUDIT = "AUDITORIA_VISUALIZAR";

export default function App() {
  const { usuario } = useSessao();

  return (
    <Routes>
      <Route path="/entrar" element={usuario ? <Navigate to="/dashboard" replace /> : <Login />} />

      {/* Aberta de proposito: e a tela que o QR Code do veiculo abre no celular. */}
      <Route path="/checklist/:token" element={<ChecklistQr />} />

      <Route element={<Protegido><Layout /></Protegido>}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/frotas/veiculos" element={<ComPermissao codigo={FROTAS}><Veiculos /></ComPermissao>} />
        <Route path="/frotas/veiculos/:id/qrcode" element={<ComPermissao codigo={FROTAS}><VeiculoQrCode /></ComPermissao>} />
        <Route path="/frotas/veiculos/:id" element={<ComPermissao codigo={FROTAS}><VeiculoDetalhe /></ComPermissao>} />
        <Route path="/frotas/checklists" element={<ComPermissao codigo={FROTAS}><Checklists /></ComPermissao>} />
        <Route path="/frotas/checklists/:id" element={<ComPermissao codigo={FROTAS}><ChecklistDetalhe /></ComPermissao>} />
        <Route path="/frotas/inspecoes" element={<ComPermissao codigo={FROTAS}><Inspecoes /></ComPermissao>} />
        <Route path="/frotas/inspecoes/:id" element={<ComPermissao codigo={FROTAS}><InspecaoDetalhe /></ComPermissao>} />
        <Route path="/frotas/manutencoes" element={<ComPermissao codigo={FROTAS}><Manutencoes /></ComPermissao>} />
        <Route path="/frotas/documentos" element={<ComPermissao codigo={FROTAS}><Documentos /></ComPermissao>} />
        <Route path="/frotas/sinistros" element={<ComPermissao codigo={FROTAS}><Sinistros /></ComPermissao>} />
        <Route path="/frotas/relatorios" element={<ComPermissao codigo="RELATORIOS_VISUALIZAR"><Relatorios /></ComPermissao>} />
        <Route path="/frotas/relatorios/:id" element={<ComPermissao codigo="RELATORIOS_VISUALIZAR"><RelatorioVer /></ComPermissao>} />

        <Route path="/fiscalizacao/servico-diario" element={<ComPermissao codigo={FISC}><ServicoDiario /></ComPermissao>} />
        <Route path="/fiscalizacao/equipes" element={<ComPermissao codigo={FISC}><Equipes /></ComPermissao>} />
        <Route path="/fiscalizacao/viaturas" element={<ComPermissao codigo={FISC}><Viaturas /></ComPermissao>} />
        <Route path="/fiscalizacao/ocorrencias" element={<ComPermissao codigo={FISC}><Ocorrencias /></ComPermissao>} />
        <Route path="/fiscalizacao/manutencoes" element={<ComPermissao codigo={FISC}><ManutencoesFisc /></ComPermissao>} />
        <Route path="/fiscalizacao/checklists" element={<ComPermissao codigo={FISC}><ChecklistsFiscalizacao /></ComPermissao>} />
        <Route path="/fiscalizacao/pontuacao" element={<ComPermissao codigo="FISCALIZACAO_GERENCIAR_PONTUACAO"><Pontuacao /></ComPermissao>} />
        <Route path="/fiscalizacao/relatorios" element={<ComPermissao codigo="RELATORIOS_VISUALIZAR"><Relatorios /></ComPermissao>} />

        <Route path="/admin/usuarios" element={<ComPermissao codigo={ADMIN}><Usuarios /></ComPermissao>} />
        <Route path="/admin/servidores" element={<ComPermissao codigo={ADMIN}><Servidores /></ComPermissao>} />
        <Route path="/admin/perfis" element={<ComPermissao codigo="PERFIL_VISUALIZAR"><Perfis /></ComPermissao>} />
        <Route path="/admin/setores" element={<ComPermissao codigo={ADMIN}><Setores /></ComPermissao>} />
        <Route path="/admin/parametros" element={<ComPermissao codigo={ADMIN}><Parametros /></ComPermissao>} />

        <Route path="/auditoria/acessos" element={<ComPermissao codigo={AUDIT}><LogsAcesso /></ComPermissao>} />
        <Route path="/auditoria/acoes" element={<ComPermissao codigo={AUDIT}><LogsAcoes /></ComPermissao>} />
        <Route path="/auditoria/alteracoes" element={<ComPermissao codigo={AUDIT}><Alteracoes /></ComPermissao>} />
        <Route path="/auditoria/exportar" element={<ComPermissao codigo="AUDITORIA_EXPORTAR"><ExportarLogs /></ComPermissao>} />

        <Route path="*" element={<EmConstrucao />} />
      </Route>
    </Routes>
  );
}
