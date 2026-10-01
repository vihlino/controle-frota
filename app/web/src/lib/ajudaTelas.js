/**
 * ajudaTelas.js - O texto do icone de ajuda (?) ao lado do titulo de cada tela.
 *
 * Um lugar so para todas as telas do menu, pelo endereco. Quem quiser mudar a
 * explicacao de uma tela mexe aqui, sem procurar a pagina. Tela que nao esta
 * aqui usa a descricao que a propria pagina passar (ou fica sem o icone).
 */
export const AJUDA_TELAS = {
  "/dashboard":
    "Resumo do dia: veículos disponíveis e em uso, checklists, inspeções, manutenções e documentos que pedem atenção. Os atalhos levam direto às ações mais usadas.",

  // Frotas
  "/frotas/veiculos":
    "Gerencie os veículos da frota: cadastro, situação (disponível, em uso, em manutenção), quilometragem e o QR Code de cada um. Pelo menu de ações você vê a ficha completa do veículo.",
  "/frotas/motoristas":
    "Servidores habilitados a dirigir os veículos da frota, com a CNH e a validade. CNH vencida ou perto de vencer aparece nos alertas do sino.",
  "/frotas/checklists":
    "Checklists de saída e chegada dos veículos. Eles nascem quando o condutor lê o QR Code do veículo; aqui você acompanha, corrige e vê os chamados de manutenção abertos pelo condutor.",
  "/frotas/inspecoes":
    "Inspeções periódicas dos veículos. Agende pelo botão, e o condutor preenche pelo QR Code. Inspeção com item em Atenção ou Avaria fica \"Em análise\" até a gestão abrir uma OS ou concluir a análise.",
  "/frotas/manutencoes":
    "Histórico das ordens de serviço da frota. Registre a OS quando o veículo for para a oficina e faça o fechamento quando o serviço voltar, com o que foi feito, o custo e o KM.",
  "/frotas/documentos":
    "Documentos dos veículos (CRLV, IPVA, seguro, licenciamento...). A situação é calculada pela data de vencimento, e os vencidos ou vencendo aparecem nos alertas. Em Ações: Visualizar mostra o que foi preenchido, os arquivos e as versões antigas; Atualizar cadastra o documento renovado e guarda o anterior no histórico.",
  "/frotas/sinistros":
    "Registro de sinistros (colisões, avarias, furtos) com os veículos da frota: data, local, condutor, boletim de ocorrência e o que foi feito.",
  "/frotas/relatorios":
    "Gere relatórios da frota por período (uso, manutenções, custos, checklists). Os relatórios gerados ficam guardados aqui para consultar e atestar.",
  "/frotas/servidores":
    "Base de pessoas do SITRA. Um servidor pode ser motorista, fiscal e também virar usuário do sistema.",

  // Fiscalizacao
  "/fiscalizacao/servico-diario":
    "Escala diária da fiscalização: as equipes de cada turno, as viaturas usadas e as ocorrências registradas no serviço.",
  "/fiscalizacao/fiscais":
    "Servidores com o cargo de Fiscal de Trânsito. Para aparecer aqui, o servidor precisa ter esse cargo no cadastro.",
  "/fiscalizacao/equipes":
    "Equipes da fiscalização e os fiscais que fazem parte de cada uma. As equipes são usadas na escala do Serviço Diário.",
  "/fiscalizacao/viaturas":
    "Veículos usados pela fiscalização, com a situação de cada um.",
  "/fiscalizacao/ocorrencias":
    "Ocorrências registradas pela fiscalização durante o serviço, com local, tipo e a equipe responsável.",
  "/fiscalizacao/manutencoes":
    "Ordens de serviço das viaturas usadas pela fiscalização.",
  "/fiscalizacao/checklists":
    "Checklists das viaturas usadas em serviço pela fiscalização.",
  "/fiscalizacao/pontuacao":
    "Itens de pontuação da fiscalização e o valor de cada um. Tela restrita ao gestor.",
  "/fiscalizacao/relatorios":
    "Gere relatórios da fiscalização por período. Os relatórios gerados ficam guardados aqui para consultar e atestar.",

  // Administracao
  "/admin/usuarios":
    "Quem acessa o SITRA. O usuário é criado a partir de um servidor, recebe um perfil de permissões e entra a primeira vez com o CPF como senha, que precisa trocar no primeiro acesso.",
  "/admin/servidores":
    "Base de pessoas do SITRA. Um servidor pode ser motorista, fiscal e também virar usuário do sistema.",
  "/admin/perfis":
    "Perfis de acesso e o que cada um pode fazer. O usuário herda as permissões do perfil: mudou aqui, muda para todos que têm o perfil.",
  "/admin/setores":
    "Setores da CMTT e os cargos que podem ser atribuídos aos servidores. Um cargo pode valer para um setor ou para todos.",
  "/admin/parametros":
    "Configurações que mudam o comportamento do sistema sem mexer no código, como prazos de alerta.",
  "/admin/backups":
    "Situação do banco de dados e da guarda das informações.",

  // Auditoria
  "/auditoria/acessos":
    "Entradas, saídas e tentativas de acesso ao sistema, com data, hora e usuário. O botão Exportar gera o arquivo em PDF ou CSV, escolhendo o período.",
  "/auditoria/acoes":
    "Tudo o que foi criado, alterado, fechado ou excluído no sistema, por quem e com qual justificativa. O botão Exportar gera o arquivo em PDF ou CSV, escolhendo o período.",
  "/auditoria/alteracoes":
    "O que mudou em cada registro, com o valor anterior e o novo, lado a lado. O botão Exportar gera o arquivo em PDF ou CSV, escolhendo o período.",
};

export function ajudaDaTela(caminho) {
  return AJUDA_TELAS[String(caminho || "").replace(/\/+$/, "")] || "";
}
