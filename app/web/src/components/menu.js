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
    // Nos mockups o rotulo deste bloco e "MENU PRINCIPAL", nao "Frotas": o
    // usuario de frotas ve so este grupo, entao chama-lo de "Frotas" seria
    // repetir o obvio.
    grupo: "Menu principal",
    permissao: "FROTAS_VISUALIZAR",
    itens: [
      { rotulo: "Motoristas",     para: "/frotas/motoristas",     icone: "motorista" },
      { rotulo: "Veículos",       para: "/frotas/veiculos",       icone: "kpi-car" },
      { rotulo: "Documentos",     para: "/frotas/documentos",     icone: "documentos" },
      { rotulo: "Checklists",     para: "/frotas/checklists",     icone: "checklist" },
      { rotulo: "Inspeções",      para: "/frotas/inspecoes",      icone: "inspecao" },
      { rotulo: "Manutenções",    para: "/frotas/manutencoes",    icone: "kpi-wrench" },
      { rotulo: "Sinistros",      para: "/frotas/sinistros",      icone: "sinistro" },
      { rotulo: "Relatórios",     para: "/frotas/relatorios",     icone: "chart-line" },
    ],
  },
  {
    grupo: "Fiscalização",
    permissao: "FISCALIZACAO_VISUALIZAR",
    itens: [
      { rotulo: "Serviço Diário", para: "/fiscalizacao/servico-diario", icone: "calendar" },
      { rotulo: "Viaturas",      para: "/fiscalizacao/viaturas",      icone: "fisc-viatura" },
      { rotulo: "Ocorrências",   para: "/fiscalizacao/ocorrencias",   icone: "fisc-ocorrencias" },
      { rotulo: "Checklists",    para: "/fiscalizacao/checklists",    icone: "checklist" },
      { rotulo: "Manutenções",   para: "/fiscalizacao/manutencoes",   icone: "kpi-wrench" },
      {
        rotulo: "Pontuação",
        para: "/fiscalizacao/pontuacao",
        icone: "fisc-bolt",
        permissao: "FISCALIZACAO_GERENCIAR_PONTUACAO",
        cadeado: true,
      },
      { rotulo: "Fiscais",       para: "/fiscalizacao/fiscais",       icone: "motorista" },
      { rotulo: "Equipes",       para: "/fiscalizacao/equipes",       icone: "equipe" },
      { rotulo: "Relatórios", para: "/fiscalizacao/relatorios", icone: "chart-line" },
    ],
  },
  {
    grupo: "Administração",
    permissao: "ADMIN_VISUALIZAR",
    itens: [
      { rotulo: "Servidores",            para: "/admin/servidores", icone: "fisc-servidores" },
      { rotulo: "Setores e Cargos",      para: "/admin/setores",    icone: "setores" },
      { rotulo: "Usuários",              para: "/admin/usuarios",   icone: "usuarios" },
      { rotulo: "Perfis e Permissões",   para: "/admin/perfis",     icone: "perfis" },
      { rotulo: "Parâmetros do Sistema", para: "/admin/parametros", icone: "nav-administracao" },
      { rotulo: "Backups e dados",       para: "/admin/backups",    icone: "administracao-alt" },
    ],
  },
  {
    grupo: "Auditoria",
    permissao: "AUDITORIA_VISUALIZAR",
    itens: [
      { rotulo: "Logs de Acesso",          para: "/auditoria/acessos",    icone: "alterar-senha" },
      { rotulo: "Logs de Ações",           para: "/auditoria/acoes",      icone: "administracao-alt" },
      { rotulo: "Alterações de Registros", para: "/auditoria/alteracoes", icone: "movements" },
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
  "/frotas/documentos/:id",
  "/frotas/relatorios/gerar",
  "/frotas/relatorios/:id",
  "/admin/parametros/:aba",
];
