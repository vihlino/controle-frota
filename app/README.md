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
- Estilo so em `web/src/styles/`: `tokens.css` guarda TODOS os valores -
  cores, escala de espacamento, escala tipografica, raios e sombras; `app.css`
  tem as classes. Nenhum componente escreve um valor cru: se voce precisou de
  um numero que nao esta no tokens.css, o certo e adicionar o token la.
- O sistema tem CORES FIXAS. Nao existe tema escuro (foi removido: era codigo
  morto, sem botao e sem CSS).
- Nome de classe CSS NAO leva acento. O CSS e escrito sem, e um `className`
  acentuado nunca casa - a regra simplesmente nao se aplica, sem erro nenhum.
  Ja aconteceu com 26 classes de uma vez.
- Icones em `web/public/icons/` sao lidos pelo componente `Icone`, que troca o
  preto fixo dos arquivos por `currentColor` para funcionarem na lateral escura.

## Pendencias conhecidas

- A tabela `veiculo` nao tem coluna de foto. A miniatura do veiculo nas
  tabelas usa o icone do tipo; `VeiculoCel` ja prefere a imagem real quando
  a API passar `foto`.
- A logo em `web/public/icons/logo-sitra.svg` e um rascunho desenhado em
  codigo, nao a marca. A logo real esta em `SITRA DESIGN/LOGO` (so PNG).
- Fotos em checklists, inspecoes e sinistros ainda nao tem upload de arquivo.
- Alertas por e-mail: a tabela `alerta_email` existe, mas o envio nao foi feito.

## Deploy

O front fica na **Vercel** e a API no **Render**. (O projeto ja usou Netlify;
o `netlify.toml` foi removido.)

**Front - Vercel**

1. Importe o repositorio na Vercel.
2. Em Settings > General, defina **Root Directory = `app/web`**.
3. Em Settings > Environment Variables, crie `VITE_API_URL` com a URL da API
   no Render (ex.: `https://sitra-api.onrender.com`). Sem ela o front chama
   `/api/...` no proprio dominio da Vercel e nao acha ninguem.
4. Cada push na branch configurada dispara o build sozinho.

O `app/web/vercel.json` manda toda rota para o `index.html`. Sem isso, abrir
`/frotas/veiculos` direto daria 404: o arquivo nao existe, quem cuida da rota
e o React Router.

> Existe um `vercel.json` identico na RAIZ do repositorio. Com Root Directory
> apontando para `app/web`, ele nao e lido - fica ali por seguranca, de quando
> nao se sabia qual dos dois a Vercel usaria. Se voce confirmar a configuracao
> no painel, da para apagar o da raiz.

**API - Render**

Configurada em `app/render.yaml` (servico Docker + Postgres). O contexto do
build e a pasta `app/`, para o Dockerfile alcancar `api/` e `db/`.
