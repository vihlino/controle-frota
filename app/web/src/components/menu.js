/**
 * menu.js - A arvore do menu lateral.
 */
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
      { rotulo: "Veículos",    para: "/frotas/veiculos",    icone: "kpi-car" },
      { rotulo: "Checklists",  para: "/frotas/checklists",  icone: "checklist" },
      { rotulo: "Inspeções",   para: "/frotas/inspecoes",   icone: "calendar" },
      { rotulo: "Manutenções", para: "/frotas/manutencoes", icone: "kpi-wrench" },
      { rotulo: "Documentos",  para: "/frotas/documentos",  icone: "nav-gestao" },
      { rotulo: "Sinistros",   para: "/frotas/sinistros",   icone: "alert-triangle" },
      { rotulo: "Relatórios",  para: "/frotas/relatorios",  icone: "chart-line" },
    ],
  },
  {
    grupo: "Fiscalização",
    permissao: "FISCALIZACAO_VISUALIZAR",
    itens: [
      { rotulo: "Serviço Diário", para: "/fiscalizacao/servico-diario", icone: "calendar" },
      { rotulo: "Equipes",        para: "/fiscalizacao/equipes",        icone: "fisc-servidores" },
      { rotulo: "Viaturas",       para: "/fiscalizacao/viaturas",       icone: "fisc-viatura" },
      { rotulo: "Ocorrências",    para: "/fiscalizacao/ocorrencias",    icone: "fisc-ocorrencias" },
      { rotulo: "Manutenções",    para: "/fiscalizacao/manutencoes",    icone: "kpi-wrench" },
      { rotulo: "Checklists",     para: "/fiscalizacao/checklists",     icone: "checklist" },
      {
        rotulo: "Pontuação",
        para: "/fiscalizacao/pontuacao",
        icone: "fisc-bolt",
        permissao: "FISCALIZACAO_GERENCIAR_PONTUACAO",
        cadeado: true,
      },
      { rotulo: "Relatórios", para: "/fiscalizacao/relatorios", icone: "chart-line" },
    ],
  },
  {
    grupo: "Administração",
    permissao: "ADMIN_VISUALIZAR",
    itens: [
      { rotulo: "Usuários",              para: "/admin/usuarios",   icone: "user" },
      { rotulo: "Servidores",            para: "/admin/servidores", icone: "fisc-servidores" },
      { rotulo: "Perfis e Permissões",   para: "/admin/perfis",     icone: "nav-administracao" },
      { rotulo: "Setores",               para: "/admin/setores",    icone: "nav-gestao" },
      { rotulo: "Parâmetros do Sistema", para: "/admin/parametros", icone: "nav-administracao" },
    ],
  },
  {
    grupo: "Auditoria",
    permissao: "AUDITORIA_VISUALIZAR",
    itens: [
      { rotulo: "Logs de Acesso",          para: "/auditoria/acessos",    icone: "nav-gestao" },
      { rotulo: "Logs de Ações",           para: "/auditoria/acoes",      icone: "nav-gestao" },
      { rotulo: "Alterações de Registros", para: "/auditoria/alteracoes", icone: "movements" },
      { rotulo: "Exportar Logs",           para: "/auditoria/exportar",   icone: "arrow-up" },
    ],
  },
];

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
