# Contexto de build é a raiz do repositório (censo.sqlite fica fora de api/).
# node:20-bookworm-slim (glibc) nos dois estágios: better-sqlite3 traz binário
# pré-compilado para glibc; em Alpine (musl) o npm ci tentaria compilar com node-gyp.

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY api/package.json api/package-lock.json ./
RUN npm ci
COPY api/ ./
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
# Dado entregue pelo avaliador, copiado sem alteração. A API nunca o abre para
# escrita: no startup ela o copia para DB_WORK_PATH e cria os derivados lá.
COPY censo.sqlite /app/censo.sqlite
ENV DB_SOURCE_PATH=/app/censo.sqlite DB_WORK_PATH=/data/censo.work.sqlite
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["node", "dist/main"]
