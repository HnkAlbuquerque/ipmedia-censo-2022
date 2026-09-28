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
# Dado entregue pelo avaliador, copiado sem alteração.
COPY censo.sqlite /app/censo.sqlite
EXPOSE 3000
CMD ["node", "dist/main"]
