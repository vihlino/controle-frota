/**
 * menu.js - A arvore do menu lateral.
 *
 * Reflete a estrutura definida para o SITRA. Cada item pode declarar uma
 * permissao; sem ela, o item nao aparece para quem nao tem acesso.
 *
 * "Movimentacoes" NAO esta aqui de proposito: entrada, saida e quilometragem
 * vem dos checklists e aparecem no relatorio de Entrada e Saida de Veiculos.
 *
 * PARA ACRESCENTAR UMA TELA: adicione o item aqui e a rota em App.jsx. Se
 * esquecer a rota, o menu leva para a pagina "em construcao".
 */
// Estrutura definida no resumo geral do SITRA.
// - "Movimentacoes" saiu do menu de Frotas: entrada, saida e quilometragem
//   continuam vindo dos checklists e aparecem no relatorio de Entrada e Saida.
// - "permissao" controla quem enxerga o item; "somenteGestor" marca telas
//   restritas ao gestor do modulo (caso da Pontuacao da Fiscalizacao).
export const MENU = [
  {
    itens: [
      { rotulo: "Dashboard", para: "/dashboard", icone: "nav-dashboard", fim: true },
    ],
  },
  {
    grupo: "Frotas",
    permissao: "FROTAS_VISUALIZAR",
    itens: [
      { rotulo: "Veiculos", para: "/frotas/veiculos", icone: "kpi-car" },
      { rotulo: "Checklists", para: "/frotas/checklists", icone: "checklist" },
      { rotulo: "Inspecoes", para: "/frotas/inspecoes", icone: "calendar" },
      { rotulo: "Manutencoes", para: "/frotas/manutencoes", icone: "kpi-wrench" },
      { rotulo: "Documentos", para: "/frotas/documentos", icone: "nav-gestao" },
      { rotulo: "Sinistros", para: "/frotas/sinistros", icone: "alert-triangle" },
      { rotulo: "Relatorios", para: "/frotas/relatorios", icone: "chart-line" },
    ],
  },
  {
    grupo: "Fiscalizacao",
    permissao: "FISCALIZACAO_VISUALIZAR",
    itens: [
      { rotulo: "Servico Diario", para: "/fiscalizacao/servico-diario", icone: "calendar" },
      { rotulo: "Equipes", para: "/fiscalizacao/equipes", icone: "fisc-servidores" },
      { rotulo: "Viaturas", para: "/fiscalizacao/viaturas", icone: "fisc-viatura" },
      { rotulo: "Ocorrencias", para: "/fiscalizacao/ocorrencias", icone: "fisc-ocorrencias" },
      { rotulo: "Manutencoes", para: "/fiscalizacao/manutencoes", icone: "kpi-wrench" },
      { rotulo: "Checklists", para: "/fiscalizacao/checklists", icone: "checklist" },
      {
        rotulo: "Pontuacao",
        para: "/fiscalizacao/pontuacao",
        icone: "fisc-bolt",
        permissao: "FISCALIZACAO_GERENCIAR_PONTUACAO",
        cadeado: true,
      },
      { rotulo: "Relatorios", para: "/fiscalizacao/relatorios", icone: "chart-line" },
    ],
  },
  {
    grupo: "Administracao",
    permissao: "ADMIN_VISUALIZAR",
    itens: [
      { rotulo: "Usuarios", para: "/admin/usuarios", icone: "user" },
      { rotulo: "Servidores", para: "/admin/servidores", icone: "fisc-servidores" },
      { rotulo: "Perfis e Permissoes", para: "/admin/perfis", icone: "nav-administracao" },
      { rotulo: "Setores", para: "/admin/setores", icone: "nav-gestao" },
      { rotulo: "Parametros do Sistema", para: "/admin/parametros", icone: "nav-administracao" },
    ],
  },
  {
    grupo: "Auditoria",
    permissao: "AUDITORIA_VISUALIZAR",
    itens: [
      { rotulo: "Logs de Acesso", para: "/auditoria/acessos", icone: "nav-gestao" },
      { rotulo: "Logs de Acoes", para: "/auditoria/acoes", icone: "nav-gestao" },
      { rotulo: "Alteracoes de Registros", para: "/auditoria/alteracoes", icone: "movements" },
      { rotulo: "Exportar Logs", para: "/auditoria/exportar", icone: "arrow-up" },
    ],
  },
];

// Rotas que existem mas nao aparecem no menu (detalhes, formularios, etc).
export const ROTAS_EXTRAS = [
  "/frotas/veiculos/:id",
  "/frotas/veiculos/:id/qrcode",
  "/frotas/checklists/:id",
  "/frotas/inspecoes/:id",
  "/frotas/manutencoes/:id",
  "/frotas/sinistros/:id",
  "/frotas/relatorios/gerar",
  "/frotas/relatorios/:id",
  "/admin/parametros/:aba",
];
