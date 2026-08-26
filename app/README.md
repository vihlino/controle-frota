# SITRA - aplicacao

Front em React (Vite) e API em Node/Express, ligados ao Postgres do
`SITRA_V1.3_COMPLETO_CONSOLIDADO`.

```
app/
  api/   Node + Express + pg   (porta 3333)
  web/   React + Vite          (porta 5173)
  db/    migracoes proprias da aplicacao
```

O front chama `/api/...` e o Vite repassa para a API, entao nao existe URL de
servidor espalhada pelo codigo nem configuracao de CORS para acertar.

## Subir o ambiente

**1. Banco**
```cmd
cd ..\SITRA_V1.3_COMPLETO_CONSOLIDADO\SITRA_V1_3_COMPLETO
docker compose up -d
```

**2. Migracao da aplicacao** (uma vez, depois do banco subir)
```cmd
docker cp ..\app\db\002_sitra_telas.sql sitra-postgres:/tmp/002.sql
docker exec sitra-postgres psql -U sitra -d sitra -f /tmp/002.sql
```

**3. API**
```cmd
cd app\api
copy .env.example .env
npm install
npm run seed         REM cria o usuario admin
npm run seed:demo    REM opcional: dados de exemplo
npm run dev
```

**4. Front**
```cmd
cd app\web
npm install
npm run dev
```

Abre em http://localhost:5173. Login padrao: `admin` / `sitra@2026`.

## Estrutura de telas

```
Dashboard          um so, com abas por perfil (Frotas, Fiscalizacao, TI)
Frotas             Veiculos, Checklists, Inspecoes, Manutencoes,
                   Documentos, Sinistros, Relatorios
Fiscalizacao       Servico Diario, Equipes, Viaturas, Ocorrencias,
                   Manutencoes, Checklists, Pontuacao (restrita), Relatorios
Administracao      Usuarios, Servidores, Perfis e Permissoes, Setores,
                   Parametros do Sistema
Auditoria          Logs de Acesso, Logs de Acoes, Alteracoes de Registros,
                   Exportar Logs
```

"Movimentacoes" nao existe como tela: entrada, saida e quilometragem vem dos
checklists e aparecem no relatorio de Entrada e Saida de Veiculos.

## Decisoes que valem saber

**QR Code e checklist.** O checklist nao tem botao de "novo" nas telas
administrativas. Ele nasce da leitura do QR Code do veiculo, numa tela publica
(`/checklist/:token`) pensada para o celular. O token do QR Code e a credencial;
a matricula do condutor identifica quem esta saindo. O mesmo QR Code, lido de
novo, registra a chegada e fecha o checklist.

**Odometro.** O banco tem um gatilho que exige odometro sempre crescente,
comparando com o maior valor ja registrado do veiculo. A leitura do QR Code
devolve exatamente esse numero, senao o condutor digitaria um KM que parece
valido e levaria erro.

**Relatorios sao documentos.** Cada tipo tem um modelo fixo (colunas e consulta);
o usuario so escolhe periodo e tipo. Ao gerar, o conteudo e congelado num
snapshot e selado com um hash. O relatorio aberto depois mostra o snapshot, nao
uma consulta nova - um relatorio atestado precisa mostrar o que foi atestado.
O hash e calculado sobre uma forma canonica das chaves, porque o JSONB do
Postgres nao preserva a ordem dos campos.

**Atestacao.** Gerar deixa o relatorio em AGUARDANDO_ATESTE. Ao atestar, ficam
gravados no sistema quem atestou, cargo, data, hora e a observacao.

**Permissoes.** O usuario herda as permissoes do perfil. A barra lateral so
mostra o que o perfil pode abrir, e a rota tambem e barrada - ninguem chega numa
tela que so daria erro de API.

**Auditoria.** Toda criacao, edicao e exclusao grava usuario, acao, registro
afetado e o antes/depois em JSON. Senha nunca entra na auditoria, nem como hash.

## Padroes do codigo

- Codigo e nomes em portugues, acompanhando o banco.
- `api/src/crud.js` gera as rotas de listagem e CRUD a partir de uma
  configuracao; `api/src/routes/frotas.js` e os irmaos so declaram os recursos.
- `web/src/components/criarPagina.jsx` faz o mesmo no front: telas de listagem
  simples nascem de uma configuracao. As que tem comportamento proprio
  (Veiculos, Checklists, Relatorios, Usuarios, Perfis) sao escritas a mao.
- Estilo so em `web/src/styles/`: `tokens.css` guarda cores, fontes e formas
  (inclusive o tema escuro); `app.css` tem as classes.
- Icones em `web/public/icons/` sao lidos pelo componente `Icone`, que troca o
  preto fixo dos arquivos por `currentColor` para funcionarem na lateral escura.

## Pendencias conhecidas

- Os icones novos do Figma ("01 - Dashboard - Icones") ainda nao foram
  exportados. O sistema usa os 28 SVGs entregues antes.
- Fotos em checklists, inspecoes e sinistros ainda nao tem upload de arquivo.
- Alertas por e-mail: a tabela `alerta_email` existe, mas o envio nao foi feito.
