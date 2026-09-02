# Dockerfile da API SITRA
# Usado pelo Render para construir e rodar o servidor Node.js.
#
# O contexto do Docker agora e a pasta "app", e nao apenas "app/api".
# Isso permite que o container tenha acesso tanto ao codigo da API
# quanto aos arquivos SQL localizados em "../db".
#
# Estrutura usada no build:
#
# app/
# ├── api/
# │   ├── package.json
# │   ├── package-lock.json
# │   └── src/
# │
# └── db/
#     ├── 001_sitra_v1.sql
#     ├── 002_sitra_telas.sql
#     └── ... as demais migracoes NNN_*.sql

FROM node:20-alpine

# ---------------------------------------------------------------------------
# Fuso horario
# ---------------------------------------------------------------------------
# O SITRA e usado no Brasil; o container do Render nasce em UTC.
#
# A imagem Alpine NAO traz o banco de fusos horarios. Sem o pacote tzdata,
# definir TZ=America/Sao_Paulo nao da erro nenhum - o Node simplesmente
# continua em UTC, em silencio. Por isso o apk add vem antes do ENV.
RUN apk add --no-cache tzdata
ENV TZ=America/Sao_Paulo

# Todos os arquivos da API serao organizados dentro de /app
# no container.
WORKDIR /app

# Copia apenas os manifestos primeiro.
#
# Se o codigo mudar, mas o package.json/package-lock.json nao,
# o Docker consegue reaproveitar a camada das dependencias,
# deixando o build mais rapido.
COPY api/package*.json ./

# Instala somente as dependencias necessarias para producao.
RUN npm ci --omit=dev

# Copia o codigo da API.
#
# O conteudo de app/api passa a ficar diretamente em /app.
COPY api/ .

# Copia os arquivos SQL para dentro do container.
#
# Eles ficarao disponiveis em:
#
# /app/db/001_sitra_v1.sql
# /app/db/002_sitra_telas.sql
# /app/db/003_... e as demais
#
# O initDatabase.js le essa pasta no start e aplica as migracoes que
# faltarem. E por isso que a pasta inteira e copiada, e nao arquivos
# escolhidos a dedo: migracao nova nao exige mexer neste Dockerfile.
COPY db/ ./db/

# A API usa a porta definida pelo Render atraves da variavel PORT.
# O EXPOSE serve apenas como documentacao da porta utilizada.
EXPOSE 3333

# Inicia a API.
#
# O server.js sera responsavel por iniciar o sistema.
# Depois vamos adicionar a inicializacao/verificacao do banco
# antes de liberar a API para receber requisicoes.
CMD ["node", "src/server.js"]