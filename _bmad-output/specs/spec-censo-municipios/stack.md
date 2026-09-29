# Stack e estrutura

Companheiro de `SPEC.md`. Define o COMO que a spec deixa em aberto. Lido por `bmad-build` antes de qualquer story.

## Escolhas

| Camada | Escolha | Motivo |
|---|---|---|
| Back-end | NestJS 10+, TypeScript, `better-sqlite3` | Estrutura de módulos/controllers/services reconhecível por time Laravel; driver síncrono simplifica código com SQLite |
| Front-end | React 18+, Vite, TypeScript | Listado na vaga; autocomplete simples de fazer sem biblioteca |
| Testes back | Jest + Supertest (padrão do Nest) | Unit da normalização, integração do bootstrap, e2e dos endpoints |
| Testes front | Vitest + Testing Library | Componentes das duas telas com API mockada |
| Containers | Docker Compose, 2 serviços, multi-stage | `api` (Nest) e `web` (nginx servindo o build do React com proxy `/api` para `api`) |
| Imagem base | `node:20-bookworm-slim` nos dois estágios da `api` | `better-sqlite3` é módulo nativo com binário pré-compilado para glibc. Em Alpine (musl) o `npm install` tenta compilar com `node-gyp` e falha sem `python3`, `make` e `g++` |
| Prontidão | `healthcheck` na `api` em `/api/health`; `web` com `depends_on: api: condition: service_healthy` | Sem isso o nginx sobe antes do bootstrap e a primeira requisição devolve 502 |
| Documentação da API | `@nestjs/swagger` 8.x | Gera OpenAPI 3 a partir dos controllers e das classes de resposta. A 8.x é a última que aceita NestJS 10; a 11 exige Nest 11 |
| CI | GitHub Actions | Um workflow: testes back, testes front, `docker compose up --wait` com smoke test dos endpoints pelo nginx |
| Node | 20 LTS | Versão instalada localmente e nas imagens |

## Estrutura de pastas

```
/
  censo.sqlite                 dado entregue, nunca alterado
  docker-compose.yml
  api/                         NestJS
    src/
      db/                      conexão, bootstrap (cópia + índices + mun_agg + nm_mun_busca)
      municipios/              controller + service: autocomplete, agregado
      ufs/                     controller + service: lista, ranking paginado, agregado
      common/                  normalização de texto, mapa cd_uf -> sigla
    test/                      e2e com Supertest
  web/                         React + Vite
    src/
      pages/BuscaMunicipio.tsx
      pages/BuscaUf.tsx
      api/                     cliente HTTP tipado
  .github/workflows/ci.yml
  _bmad/, _bmad-output/        framework e artefatos, versionados
```

## Contrato da API

Movido para o [README](../../../README.md#api) na story 5, porque quem clona não abre `_bmad-output/`. As regras que o contrato aplica continuam aqui e em `regras-de-dados.md`: prefixo `/api`, 400 para parâmetro inválido, 404 para município ou UF inexistente, `areaKm2` e `densidade` com 2 casas (R7).

## Documentação da API

Interface em `/api/docs`, JSON em `/api/docs-json`, configurados em `api/src/app.setup.ts` para valerem no `main.ts` e nos e2e. Expostos também na imagem Docker, atrás do proxy `/api` do nginx.

Respostas são classes em `api/src/**/*.types.ts` com `@ApiProperty` (descrição e exemplo com valor real do Censo). A classe é a fonte única: tipa o service e gera o esquema. `web/src/api/tipos.ts` continua sendo a cópia manual do front.

Cada rota tem `@ApiOperation`, `@ApiQuery`/`@ApiParam` com limites, a resposta de sucesso e as de erro (400, 404).

## Bootstrap do banco (executa a cada subida do `api`)

1. Copiar `DB_SOURCE_PATH` para `DB_WORK_PATH`, sempre, sobrescrevendo. Comparar data é frágil: o `COPY` do Docker e volumes montados mudam o mtime. Na imagem, `ENV DB_SOURCE_PATH=/app/censo.sqlite DB_WORK_PATH=/data/censo.work.sqlite`; fora do Docker, defaults `<cwd>/../censo.sqlite` e `<cwd>/.data/censo.work.sqlite` (pasta ignorada pelo git), pensados para rodar de `api/`.
2. `CREATE INDEX IF NOT EXISTS` em `setor(cd_mun)`, `municipio(cd_uf)` e `municipio(nm_mun_busca)`.
3. Adicionar coluna `municipio.nm_mun_busca` se ausente (`PRAGMA table_info`) e preencher com `normalizar(nm_mun)` numa transação, em JS. A linha `cd_mun = '.'` fica com `''`: excluir por `cd_mun <> '.'`, nunca por `IS NULL`.
4. `mun_agg` conforme `regras-de-dados.md`: `DROP TABLE IF EXISTS` + `CREATE TABLE` + `INSERT ... SELECT` dentro de uma transação, em `api/src/db/bootstrap.sql` (copiado para `dist/` como asset do Nest).
5. Idempotente: rodar duas vezes não duplica nada. Implementado em `api/src/db/db.service.ts`, exposto pelo `DbModule` global.
6. Síncrono, em `onModuleInit` do módulo de banco, antes de o Nest abrir a porta. Assim `/api/health` só responde com os dados prontos e o healthcheck do compose não mente. O health devolve `municipios: 5571` como prova.

Tempo esperado: abaixo de 1 s.

## Desenvolvimento local (não é forma de entrega)

`web/vite.config.ts` com `server.proxy` de `/api` para `http://localhost:3000`, mesma forma do nginx. O front nunca conhece a URL da API. Ao fim de cada story, `docker compose up` na máquina local antes do PR: é assim que o avaliador vai ver.

## Testes e2e do back

Uma instância do app por arquivo de teste (`beforeAll`), com `DB_WORK_PATH` apontando para um arquivo temporário. Cada instância custa um bootstrap (~200 ms).

## Convenções

- Conventional Commits. Um branch e um PR por story. Merge com merge commit, nunca squash.
- `normalizar(texto)`: NFD, remove diacríticos, minúsculas, colapsa espaços, trim. Única implementação, em `api/src/common/`, usada no bootstrap e na busca. Teste unitário obrigatório.
- Siglas de UF: mapa estático `cd_uf -> sigla` com as 27 entradas do IBGE em `api/src/common/`.
- Front consome só `/api`; sem lógica de agregação no cliente.
