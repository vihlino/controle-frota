# Dockerfile da API SITRA
# Usado pelo Render para construir e rodar o servidor Node.js.
#
# Etapas:
#   1. Instala so as dependencias de producao (sem devDependencies)
#   2. Copia o codigo
#   3. Sobe na porta que o Render definir (PORT)

FROM node:20-alpine

WORKDIR /app

# Copia so os manifestos primeiro: se o codigo mudar mas o package.json nao,
# o Docker reaproveita a camada do npm install (mais rapido).
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# O Render injeta PORT automaticamente. O server.js ja le process.env.PORT.
EXPOSE 3333

CMD ["node", "src/server.js"]
