/**
 * App.jsx - O mapa de rotas do sistema.
 */
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import { useSessao } from "./lib/sessao.jsx";

import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ChecklistQr from "./pages/ChecklistQr.jsx";
import EmConstrucao from "./pages/EmConstrucao.jsx";
import Ajuda from "./pages/Ajuda.jsx";

import Veiculos from "./pages/frotas/Veiculos.jsx";
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
import ManutencaoDetalhe from "./pages/frotas/ManutencaoDetalhe.jsx";
import EquipeDetalhe from "./pages/fiscalizacao/EquipeDetalhe.jsx";
import ViaturaDetalhe from "./pages/fiscalizacao/ViaturaDetalhe.jsx";
import OcorrenciaDetalhe from "./pages/fiscalizacao/OcorrenciaDetalhe.jsx";
import ChecklistFiscDetalhe from "./pages/fiscalizacao/ChecklistFiscDetalhe.jsx";
import SinistroDetalhe from "./pages/frotas/SinistroDetalhe.jsx";
import DocumentoDetalhe from "./pages/frotas/DocumentoDetalhe.jsx";

import ServicoDiario from "./pages/fiscalizacao/ServicoDiario.jsx";
import ServicoDiarioDetalhe from "./pages/fiscalizacao/ServicoDiarioDetalhe.jsx";
import Equipes from "./pages/fiscalizacao/Equipes.jsx";
import Ocorrencias from "./pages/fiscalizacao/Ocorrencias.jsx";
import ChecklistsFiscalizacao from "./pages/fiscalizacao/ChecklistsFiscalizacao.jsx";
import Pontuacao from "./pages/fiscalizacao/Pontuacao.jsx";
import PontuacaoItens from "./pages/fiscalizacao/PontuacaoItens.jsx";
import Equipamentos from "./pages/fiscalizacao/Equipamentos.jsx";
import EquipamentoDetalhe from "./pages/fiscalizacao/EquipamentoDetalhe.jsx";

import Usuarios from "./pages/admin/Usuarios.jsx";
import Servidores from "./pages/admin/Servidores.jsx";
import Motoristas from "./pages/Motoristas.jsx";
import Fiscais from "./pages/Fiscais.jsx";
import ServidorDetalhe from "./pages/ServidorDetalhe.jsx";
import FiscalDetalhe from "./pages/FiscalDetalhe.jsx";
import TrocarSenha from "./pages/TrocarSenha.jsx";
import Perfis from "./pages/admin/Perfis.jsx";
import Setores from "./pages/admin/Setores.jsx";
import Parametros from "./pages/admin/Parametros.jsx";
import Backups from "./pages/admin/Backups.jsx";

import LogsAcesso from "./pages/auditoria/LogsAcesso.jsx";
import LogsAcoes from "./pages/auditoria/LogsAcoes.jsx";
import Alteracoes from "./pages/auditoria/Alteracoes.jsx";

function Protegido({ children }) {
  const { usuario, carregando } = useSessao();
  if (carregando) return <div className="carregando">Carregando...</div>;
  if (!usuario) return <Navigate to="/entrar" replace />;
  // Senha provisoria: nenhuma tela do sistema antes da troca. A API tambem
  // recusa (auth.js) - aqui e so para a pessoa cair direto no lugar certo.
  if (usuario.trocarSenha) return <Navigate to="/trocar-senha" replace />;
  return children;
}

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

/*
 * A tela de QR Code virou uma aba de Detalhes do Veiculo. O endereco antigo
 * (botao QR Code da lista, links salvos) continua funcionando: cai na aba.
 */
function QrCodeParaAba() {
  const { id } = useParams();
  return <Navigate to={`/frotas/veiculos/${id}?aba=qrcode`} replace />;
}

export default function App() {
  const { usuario } = useSessao();

  return (
    <Routes>
      <Route path="/entrar" element={usuario ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/checklist/:token" element={<ChecklistQr />} />
      <Route path="/trocar-senha" element={usuario ? <TrocarSenha /> : <Navigate to="/entrar" replace />} />

      <Route element={<Protegido><Layout /></Protegido>}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/frotas/veiculos" element={<ComPermissao codigo={FROTAS}><Veiculos key="frotas" /></ComPermissao>} />
        <Route path="/frotas/veiculos/:id/qrcode" element={<QrCodeParaAba />} />
        <Route path="/frotas/veiculos/:id" element={<ComPermissao codigo={FROTAS}><VeiculoDetalhe key="frotas" /></ComPermissao>} />
        <Route path="/frotas/checklists" element={<ComPermissao codigo={FROTAS}><Checklists /></ComPermissao>} />
        <Route path="/frotas/checklists/:id" element={<ComPermissao codigo={FROTAS}><ChecklistDetalhe /></ComPermissao>} />
        <Route path="/frotas/inspecoes" element={<ComPermissao codigo={FROTAS}><Inspecoes /></ComPermissao>} />
        {/* Agendar virou pop-up na propria lista; o endereco antigo leva ate ele. */}
        <Route path="/frotas/inspecoes/nova" element={<Navigate to="/frotas/inspecoes?agendar=1" replace />} />
        <Route path="/frotas/inspecoes/:id" element={<ComPermissao codigo={FROTAS}><InspecaoDetalhe /></ComPermissao>} />
        <Route path="/frotas/manutencoes" element={<ComPermissao codigo={FROTAS}><Manutencoes key="frotas" /></ComPermissao>} />
        <Route path="/frotas/manutencoes/agendar" element={<Navigate to="/frotas/manutencoes?registrar=1" replace />} />
        <Route path="/frotas/manutencoes/:id" element={<ComPermissao codigo={FROTAS}><ManutencaoDetalhe key="frotas" /></ComPermissao>} />
        <Route path="/frotas/documentos" element={<ComPermissao codigo={FROTAS}><Documentos /></ComPermissao>} />
        <Route path="/frotas/documentos/novo" element={<Navigate to="/frotas/documentos?novo=1" replace />} />
        <Route path="/frotas/documentos/:id" element={<ComPermissao codigo={FROTAS}><DocumentoDetalhe /></ComPermissao>} />
        <Route path="/frotas/sinistros" element={<ComPermissao codigo={FROTAS}><Sinistros /></ComPermissao>} />
        <Route path="/frotas/sinistros/novo" element={<Navigate to="/frotas/sinistros?novo=1" replace />} />
        <Route path="/frotas/sinistros/:id" element={<ComPermissao codigo={FROTAS}><SinistroDetalhe /></ComPermissao>} />
        <Route path="/frotas/motoristas" element={<ComPermissao codigo={FROTAS}><Motoristas /></ComPermissao>} />
        <Route path="/frotas/servidores" element={<ComPermissao codigo={FROTAS}><Servidores /></ComPermissao>} />
        <Route path="/frotas/motoristas/:id" element={<ComPermissao codigo={FROTAS}><ServidorDetalhe /></ComPermissao>} />
        <Route path="/frotas/servidores/:id" element={<ComPermissao codigo={FROTAS}><ServidorDetalhe /></ComPermissao>} />
        <Route path="/frotas/relatorios" element={<ComPermissao codigo="RELATORIOS_VISUALIZAR"><Relatorios key="frotas" /></ComPermissao>} />
        {/* Sem trava de perfil: quem foi escolhido para atestar abre o
            relatório pelo sino mesmo sem ver a lista. A API decide. */}
        <Route path="/frotas/relatorios/:id" element={<RelatorioVer key="frotas" />} />

        <Route path="/fiscalizacao/servico-diario" element={<ComPermissao codigo={FISC}><ServicoDiario /></ComPermissao>} />
        <Route path="/fiscalizacao/servico-diario/:id" element={<ComPermissao codigo={FISC}><ServicoDiarioDetalhe /></ComPermissao>} />
        <Route path="/fiscalizacao/equipes" element={<ComPermissao codigo={FISC}><Equipes /></ComPermissao>} />
        <Route path="/fiscalizacao/equipes/:id" element={<ComPermissao codigo={FISC}><EquipeDetalhe /></ComPermissao>} />
        {/* Viaturas = a tela de Veiculos so com as viaturas (18/10). */}
        <Route path="/fiscalizacao/viaturas" element={<ComPermissao codigo={FISC}><Veiculos key="fiscalizacao" /></ComPermissao>} />
        <Route path="/fiscalizacao/viaturas/:id" element={<ComPermissao codigo={FISC}><ViaturaDetalhe /></ComPermissao>} />
        {/* Equipamentos das viaturas: quantidades, conferencias, itens e historico (21/10). */}
        <Route path="/fiscalizacao/equipamentos" element={<ComPermissao codigo={FISC}><Equipamentos /></ComPermissao>} />
        <Route path="/fiscalizacao/equipamentos/:id" element={<ComPermissao codigo={FISC}><EquipamentoDetalhe /></ComPermissao>} />
        <Route path="/fiscalizacao/ocorrencias" element={<ComPermissao codigo={FISC}><Ocorrencias /></ComPermissao>} />
        <Route path="/fiscalizacao/ocorrencias/:id" element={<ComPermissao codigo={FISC}><OcorrenciaDetalhe /></ComPermissao>} />
        {/* Fiscalizacao usa a mesma tela de Frotas, so com as viaturas (09/10).
            O key diferente obriga o React a montar a tela de novo ao trocar de
            Frotas para Fiscalizacao (e vice-versa): sem ele a tela era
            reaproveitada e ficava com a lista do modulo anterior. */}
        <Route path="/fiscalizacao/manutencoes" element={<ComPermissao codigo={FISC}><Manutencoes key="fiscalizacao" /></ComPermissao>} />
        <Route path="/fiscalizacao/manutencoes/:id" element={<ComPermissao codigo={FISC}><ManutencaoDetalhe key="fiscalizacao" /></ComPermissao>} />
        <Route path="/fiscalizacao/checklists" element={<ComPermissao codigo={FISC}><ChecklistsFiscalizacao /></ComPermissao>} />
        <Route path="/fiscalizacao/checklists/:id" element={<ComPermissao codigo={FISC}><ChecklistFiscDetalhe /></ComPermissao>} />
        <Route path="/fiscalizacao/fiscais" element={<ComPermissao codigo={FISC}><Fiscais /></ComPermissao>} />
        <Route path="/fiscalizacao/fiscais/:id" element={<ComPermissao codigo={FISC}><FiscalDetalhe /></ComPermissao>} />
        {/* Rota antiga: quem tiver o link salvo continua chegando na tela certa. */}
        <Route path="/fiscalizacao/motoristas" element={<Navigate to="/fiscalizacao/fiscais" replace />} />
        <Route path="/fiscalizacao/pontuacao" element={<ComPermissao codigo="FISCALIZACAO_GERENCIAR_PONTUACAO"><Pontuacao /></ComPermissao>} />
        <Route path="/fiscalizacao/pontuacao/itens" element={<ComPermissao codigo="FISCALIZACAO_GERENCIAR_PONTUACAO"><PontuacaoItens /></ComPermissao>} />
        <Route path="/fiscalizacao/relatorios" element={<ComPermissao codigo="RELATORIOS_VISUALIZAR"><Relatorios key="fiscalizacao" /></ComPermissao>} />
        <Route path="/fiscalizacao/relatorios/:id" element={<RelatorioVer key="fiscalizacao" />} />

        <Route path="/admin/usuarios" element={<ComPermissao codigo={ADMIN}><Usuarios /></ComPermissao>} />
        <Route path="/admin/servidores" element={<ComPermissao codigo={ADMIN}><Servidores /></ComPermissao>} />
        <Route path="/admin/servidores/:id" element={<ComPermissao codigo={ADMIN}><ServidorDetalhe /></ComPermissao>} />
        <Route path="/admin/perfis" element={<ComPermissao codigo="PERFIL_VISUALIZAR"><Perfis /></ComPermissao>} />
        <Route path="/admin/setores" element={<ComPermissao codigo={ADMIN}><Setores /></ComPermissao>} />
        <Route path="/admin/parametros" element={<ComPermissao codigo={ADMIN}><Parametros /></ComPermissao>} />
        <Route path="/admin/backups" element={<ComPermissao codigo={ADMIN}><Backups /></ComPermissao>} />

        <Route path="/auditoria/acessos" element={<ComPermissao codigo={AUDIT}><LogsAcesso /></ComPermissao>} />
        <Route path="/auditoria/acoes" element={<ComPermissao codigo={AUDIT}><LogsAcoes /></ComPermissao>} />
        <Route path="/auditoria/alteracoes" element={<ComPermissao codigo={AUDIT}><Alteracoes /></ComPermissao>} />
        <Route path="/auditoria/exportar" element={<Navigate to="/auditoria/acessos" replace />} />

        {/* Central de Ajuda: todo usuario logado abre (09/10). */}
        <Route path="/ajuda" element={<Ajuda />} />
        <Route path="*" element={<EmConstrucao />} />
      </Route>
    </Routes>
  );
}
