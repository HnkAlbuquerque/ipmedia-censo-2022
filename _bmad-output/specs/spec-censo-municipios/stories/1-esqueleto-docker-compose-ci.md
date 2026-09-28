---
title: 'Esqueleto com Docker Compose e CI'
type: 'feature'
created: '2026-09-28'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'cfee2de73780bca06e6d74419afc5208876803a4'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/specs/spec-censo-municipios/stack.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O repositório não tem código. O avaliador precisa clonar, rodar `docker compose up` e ver a aplicação responder; sem esqueleto executável e CI verde, nenhuma story seguinte tem onde pousar.

**Approach:** Criar `api/` (NestJS) com healthcheck, `web/` (React + Vite) com duas rotas vazias, `docker-compose.yml` com nginx servindo o front e fazendo proxy de `/api`, e um workflow do GitHub Actions rodando testes e build. Cada lado nasce com um teste. Cobre CAP-5 e CAP-7.

## Boundaries & Constraints

**Always:**
- `api` em `node:20-bookworm-slim` nos dois estágios. `better-sqlite3` entra já nesta story e o healthcheck abre um banco `:memory:` para provar que o módulo nativo carrega na imagem.
- `api` com `healthcheck` em `/api/health`; `web` com `depends_on: api: condition: service_healthy`.
- Front chama `/api/...` relativo. nginx faz proxy para `api:3000`; `vite.config.ts` faz proxy para `http://localhost:3000` em dev.
- `censo.sqlite` copiado para `/app/censo.sqlite` na imagem da `api`, sem alteração. Contexto de build da `api` é a raiz (`dockerfile: api/Dockerfile`), porque o arquivo fica fora de `api/`.
- Único endereço para o avaliador: `http://localhost:8080`. Porta 3000 não publicada.
- npm, `package-lock.json` versionado, `engines.node >= 20`. Nomes conforme AGENTS.md.

**Never:**
- Módulo de banco, bootstrap, `mun_agg`, endpoints de negócio (stories 2 a 4) ou README (story 5).
- Biblioteca de componentes ou CSS framework; CSS simples num arquivo.
- Alpine na `api`; porta 3000 no compose.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Health OK | `GET /api/health` | 200 `{ "status": "ok", "sqlite": "<versão>" }` via `SELECT sqlite_version()` em `:memory:` | N/A |
| Rota desconhecida | `GET /api/nada` | 404 JSON padrão do Nest | N/A |
| SPA deep link | `GET /estado` no nginx | 200 com `index.html` | `try_files $uri /index.html` |
| Proxy antes da API subir | `web` só inicia após `api` healthy | Primeira requisição já responde, nunca 502 | compose espera o healthcheck |

</frozen-after-approval>

## Code Map

Greenfield, nada a reutilizar. Seguir `stack.md` (estrutura, imagem, prontidão, dev local) e `AGENTS.md` (política, convenções). `.gitignore` da raiz já ignora `node_modules/` e `dist/`.

## Tasks & Acceptance

**Execution:**
- [x] `api/package.json`, `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json` -- NestJS 10 com scripts `build`, `start`, `start:dev`, `test` (Jest, `src/**/*.spec.ts`), `test:e2e` (`test/jest-e2e.json`, Supertest); deps `@nestjs/{core,common,platform-express,testing}`, `reflect-metadata`, `rxjs`, `better-sqlite3`, `@types/better-sqlite3` -- base das stories 2 a 4.
- [x] `api/src/main.ts`, `app.module.ts` -- `setGlobalPrefix('api')`, porta `PORT ?? 3000`.
- [x] `api/src/health/health.controller.ts`, `health.module.ts`, `health.controller.spec.ts` -- endpoint da matriz; unit confere `status` e `sqlite` no formato `x.y.z`.
- [x] `api/test/health.e2e-spec.ts` -- Supertest do healthcheck e do 404.
- [x] `api/Dockerfile`, `.dockerignore` (raiz: exclui `web/`, `_bmad*`, `docs/`, `.git/`, `node_modules/`) -- multi-stage: build com `npm ci` + `npm run build`; final com `npm ci --omit=dev`, `dist/`, `COPY censo.sqlite /app/censo.sqlite`, `CMD ["node","dist/main"]`.
- [x] `web/package.json`, `tsconfig.json`, `vite.config.ts`, `index.html` -- Vite + React 18 + TS, `react-router-dom`, Vitest + Testing Library + jsdom, `server.proxy` de `/api`.
- [x] `web/src/main.tsx`, `App.tsx`, `styles.css` -- título "Censo 2022", navegação com `/municipio` (Busca de município) e `/estado` (Busca por estado), páginas com um `<h2>`; `/` redireciona para `/municipio`.
- [x] `web/src/App.test.tsx`, `setupTests.ts` -- render mostra o título e os dois links.
- [x] `web/Dockerfile`, `nginx.conf`, `.dockerignore` -- build em `node:20-bookworm-slim`; final `nginx:1.27-alpine` com `try_files` e `location /api/ { proxy_pass http://api:3000/api/; }`.
- [x] `docker-compose.yml` -- `api` (context `.`, healthcheck `node -e` com `fetch` em `http://localhost:3000/api/health`, `interval: 5s`, `retries: 10`) e `web` (`8080:80`, `depends_on` com `service_healthy`).
- [x] `.github/workflows/ci.yml` -- em `push` e `pull_request`: jobs `api` (`npm ci`, `npm test`, `npm run test:e2e`), `web` (`npm ci`, `npm test`, `npm run build`), `docker` (`docker compose build`).
- [x] `.gitignore` -- acrescentar `coverage/` e `*.log`.

**Acceptance Criteria:**
- Given máquina só com Docker, when `docker compose up --build`, then `localhost:8080` mostra o título e os dois links e `localhost:8080/api/health` devolve `status: ok` com a versão do SQLite.
- Given `api/` e `web/`, when `npm test` (e `test:e2e` na api, `build` no web), then tudo verde.
- Given push no GitHub, when o workflow roda, then os três jobs passam.

## Implementation Notes

- `better-sqlite3` 12.10+ não publica binário pré-compilado para Node 20 (ABI 115); o `npm ci --omit=dev` na imagem slim falhava com node-gyp sem python. Fixado `12.9.0` exato (última com `node-v115-linux-x64` e `linux-arm64`). Candidato a pitfall no AGENTS.md.
- Criado `api/src/app.setup.ts` com `configurarApp()` (não previsto): concentra o `setGlobalPrefix('api')` para `main.ts` e para os e2e, que criam a app sem passar pelo `main`.
- `web/src/setupTests.ts` registra `afterEach(cleanup)` explicitamente: sem `globals: true` a Testing Library não limpa entre testes.
- Versões limitadas pelo Node 20: Vitest 3 (não 5), jsdom 26 (não 30), jest-dom 6.9. Vite 7 exige Node >= 20.19; imagem, CI e máquina local atendem.
- Auditoria da matriz: linhas 1 e 2 cobertas por unit + e2e; linhas 3 (deep link) e 4 (prontidão) são comportamento de nginx e compose, cobertas pelo smoke check de `## Verification`, que passou; acrescentado `curl /estado` a esse comando.

## Spec Change Log

## Review Triage Log

| # | Origem | Achado | Veredito | Evidência / rota |
|---|---|---|---|---|
| 1 | verification-gap | Job `docker` do CI só faz `build`; prefixo `/api`, `PORT`, proxy do nginx, `try_files` e healthcheck não são exercidos por nenhum teste automatizado | high | Pré-verificado pelo revisor; e2e cria a app sem `main.ts`, `compose build` não roda nginx. Único caminho do avaliador sem verificação. → patch: smoke check do compose no CI |
| 2 | verification-gap | Linhas 3 e 4 da matriz (deep link, prontidão) sem verificação automática | high | Mesma causa raiz do #1 → agrupado |
| 3 | blind-hunter | Matriz 3 e 4 sem cobertura no CI | high | Mesma causa raiz do #1 → agrupado |
| 4 | verification-gap / blind-hunter | Lockfiles ausentes do diff | false | Excluídos do diff de revisão de propósito (ruído); existem em disco, não ignorados, entram no commit |
| 5 | edge-case | `PORT` não numérico vira NaN ou 0 | low | Reproduzível só com env inválida; compose fixa 3000. Fix é guarda nova → rejeitado |
| 6 | edge-case | `PORT` no compose duplica o literal 3000 do healthcheck e do nginx | low | Fonte dupla real: mudar o env quebra o healthcheck. Fix é remover a linha → patch |
| 7 | edge-case | `/api` sem barra ou `/apiX` cai no `try_files` e devolve HTML 200 | low | Front só chama `/api/...`; fix é um `location` extra → rejeitado |
| 8 | edge-case | nginx resolve o IP de `api` no start; recriação do container dá 502 | low | Real em recriação isolada de `api`; no fluxo do avaliador os dois sobem juntos. Fix com `resolver` é complexidade → rejeitado, nota para o README de dev |
| 9 | edge-case | Rota desconhecida renderiza `<main>` vazio | low | Reproduzível digitando URL errada; fix é uma `Route path="*"` → patch |
| 10 | edge-case | `afterAll` chama `close` em `app` indefinido se `beforeAll` falhar | low | Mascara o erro original; fix `app?.close()` → patch |
| 11 | blind-hunter | `@types/express` 5 contra Express 4 do Nest 10 | medium | Verificado: platform-express 10 fixa express 4. Story 2 tipando `@Res()` recebe tipos errados → patch `^4.17` |
| 12 | blind-hunter | `engines.node >=20` abaixo do exigido pelo Vite 7 (`^20.19`) | low | Verificado no `node_modules/vite/package.json`. Fix é a string → patch |
| 13 | blind-hunter | Sem teste da rota `/estado`; `Route` quebrada passa a suíte | medium | `App.test.tsx` só renderiza `/`. Fix é um caso de teste → patch |
| 14 | blind-hunter | `try_files` devolve `index.html` 200 para asset ausente | low | Só após rebuild com cache velho; fix são blocos de cache → rejeitado |
| 15 | blind-hunter | Pitfall do `better-sqlite3` e TODO do AGENTS.md não atualizados | defer | Edita arquivo de contexto de agente → deferred-work.md; resolver via `bmad-project-context record/refresh` |
| 16 | blind-hunter | Imagem roda como root; `npm ci` final baixa binário de novo; `/data` para story 2 | low | Real, mas `USER node` exige `/data` com dono certo, que é da story 2. Rejeitado aqui; story 2 cria `/data` e decide `USER node` |
| 17 | blind-hunter | Healthcheck sem `start_period` e usando `localhost` | low | Story 2 põe bootstrap antes do `listen`; `start_period: 10s` e `127.0.0.1` são correções diretas → patch |
| 18 | blind-hunter | Workflow roda duas vezes por commit de PR | low | `push` sem filtro + `pull_request`. Fix `branches: [master]` e `permissions: contents: read` → patch |
| 19 | blind-hunter | `vite.config.ts` fora do `tsc --noEmit` | low | esbuild compila o config; erro de tipo ali é improvável e o fix pode puxar tipos de Node → rejeitado |
| 20 | blind-hunter | `PORT` NaN e ausência de `enableShutdownHooks` | low | NaN agrupado ao #5. Shutdown hooks importam quando houver handle SQLite aberto → nota para story 2 |
| 21 | blind-hunter | `.dockerignore` da raiz manda `api/test/` e specs para o contexto | low | Invalida cache do `build` a cada teste editado. Fix são duas linhas → patch |
| 22 | blind-hunter | Teste de 404 não assere `message` nem `GET /health` sem prefixo | medium | Sem isso, prefixo ausente passaria no e2e. Fix é asserção → patch |

## Design Notes

`bookworm-slim` não traz `curl`; o healthcheck usa o próprio Node:

```yaml
test: ["CMD", "node", "-e", "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
```

## Verification

**Commands:**
- `cd api && npm ci && npm test && npm run test:e2e` -- expected: verde.
- `cd web && npm ci && npm test && npm run build` -- expected: verde e `dist/` gerado.
- `docker compose build` -- expected: duas imagens, sem erro de `node-gyp`.
- `docker compose up -d && sleep 15 && curl -sf localhost:8080/api/health && curl -sf localhost:8080/ | grep -q 'Censo 2022' && curl -sf -o /dev/null localhost:8080/estado; docker compose down` -- expected: JSON com `status: ok` e página com o título.
