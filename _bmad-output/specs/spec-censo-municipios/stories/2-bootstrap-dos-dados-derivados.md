---
title: 'Bootstrap dos dados derivados'
type: 'feature'
created: '2026-09-28'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'ef93018a97347cb22f08d937e4fb33bcd9df738e'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/specs/spec-censo-municipios/regras-de-dados.md'
  - '{project-root}/_bmad-output/specs/spec-censo-municipios/stack.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O `censo.sqlite` vem cru: sem índices, sem coluna de busca normalizada, sem agregados, e com as armadilhas R1 a R3 que toda consulta teria de repetir. Alterar o arquivo entregue é proibido.

**Approach:** Ao subir a API, copiar o arquivo para um caminho de trabalho e criar ali índices, a coluna `nm_mun_busca`, a tabela `mun_agg` e o mapa de siglas, tudo síncrono antes de a porta abrir. Uma única função `normalizar()` serve o bootstrap e, depois, a busca. Implementa R1 a R5 e R7 de `regras-de-dados.md`.

## Boundaries & Constraints

**Always:**
- Copiar `DB_SOURCE_PATH` para `DB_WORK_PATH` sempre, sobrescrevendo; nunca abrir o arquivo de origem para escrita.
- Bootstrap síncrono em `onModuleInit` do módulo de banco (`better-sqlite3` é síncrono); `/api/health` só responde depois, porque o Nest só escuta após os módulos iniciarem.
- Idempotente: `CREATE INDEX IF NOT EXISTS`, coluna só adicionada se ausente (`PRAGMA table_info`), `mun_agg` recriada com `DROP TABLE IF EXISTS` seguido de `CREATE TABLE` e `INSERT ... SELECT` numa transação.
- `mun_agg` inclui a linha `cd_mun = '.'`; nenhum filtro R1 aqui.
- `normalizar()` é a única implementação: NFD, remove diacríticos, minúsculas, colapsa espaços, `trim`. Vive em `api/src/common/normalizar.ts`.
- Caminhos: `DB_SOURCE_PATH` default `<raiz do repo>/censo.sqlite` resolvido a partir de `process.cwd()` (`../censo.sqlite`), `DB_WORK_PATH` default `<cwd>/.data/censo.work.sqlite`; na imagem, `ENV DB_SOURCE_PATH=/app/censo.sqlite DB_WORK_PATH=/data/censo.work.sqlite` com `/data` criado e de dono `node`, e `USER node` antes do `CMD`.
- Área e densidade nunca são arredondadas em `mun_agg`: o arredondamento (R7) é do service que responde, nas stories 3 e 4.

**Never:**
- Nenhum endpoint de negócio, nenhum service de município ou UF: stories 3 e 4.
- Nenhuma alteração em `censo.sqlite`, `docs/enunciado.md` ou no `web/`.
- Não usar ORM nem migrations; SQL direto em um arquivo `.sql` lido pelo bootstrap.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Primeira subida | `DB_WORK_PATH` não existe | Arquivo copiado, índices, coluna, `mun_agg` criados; log com duração | N/A |
| Segunda subida | `DB_WORK_PATH` já existe com derivados | Sobrescrito e recriado; mesmo resultado, sem duplicatas | N/A |
| Origem ausente | `DB_SOURCE_PATH` inexistente | App não sobe; erro claro com o caminho | `throw` em `onModuleInit` |
| Diretório de trabalho ausente | Pasta de `DB_WORK_PATH` não existe | Criada com `mkdirSync({ recursive: true })` | N/A |
| Totais do IBGE | `mun_agg` preenchida | Valores de referência de `regras-de-dados.md` batem | teste de integração |
| `normalizar('São Gonçalo')` | | `'sao goncalo'` | N/A |
| `normalizar('  Bom   Jesus ')` | | `'bom jesus'` | N/A |
| Sigla de UF | `cd_uf = '35'` | `'SP'`; código desconhecido devolve `undefined` | N/A |

</frozen-after-approval>

## Code Map

- `api/src/app.module.ts` -- importa `HealthModule`; passará a importar `DbModule` antes dele.
- `api/src/app.setup.ts` -- `configurarApp()`; não muda.
- `api/src/health/health.controller.ts` -- abre `:memory:`; passará a receber `DbService` e responder `{ status, sqlite, municipios }` com `count(*)` de `mun_agg`, provando o bootstrap.
- `api/test/health.e2e-spec.ts` -- cria a app via `Test.createTestingModule`; passa a definir `DB_WORK_PATH` em `os.tmpdir()` antes de importar o módulo.
- `api/Dockerfile` -- estágio final ganha `ENV`, `mkdir /data` e `USER node`.
- `.gitignore` -- acrescentar `.data/`.
- `_bmad-output/specs/spec-censo-municipios/regras-de-dados.md` -- R5 (colunas de `mun_agg`) e a tabela de valores de referência: os testes copiam os números de lá.

## Tasks & Acceptance

**Execution:**
- [x] `api/src/common/normalizar.ts`, `normalizar.spec.ts` -- função e testes das linhas da matriz mais `'Mogi-Guaçu'` -> `'mogi-guacu'` (hífen preservado) -- base de R4.
- [x] `api/src/common/ufs.ts`, `ufs.spec.ts` -- mapa `cd_uf` -> `{ sigla, nome }` com as 27 UFs do IBGE e `siglaDaUf(cdUf)` -- A3 da spec.
- [x] `api/src/db/bootstrap.sql` -- índices `idx_setor_mun` em `setor(cd_mun)`, `idx_mun_uf` em `municipio(cd_uf)`, `idx_mun_busca` em `municipio(nm_mun_busca)`; `mun_agg` com as colunas de R5 (`cd_mun` PK, `setores_total`, `setores_urbanos`, `setores_rurais`, `setores_nao_informados`, `populacao`, `area_km2`, `homens`, `mulheres`, `moradores`) via `LEFT JOIN demografia` -- R2, R3, R5.
- [x] `api/src/db/db.service.ts` -- `DbService` com `onModuleInit` síncrono: resolve caminhos, valida origem, `mkdirSync`, `copyFileSync`, abre com `better-sqlite3`, `PRAGMA journal_mode = WAL` não (arquivo efêmero; usar `journal_mode = MEMORY`), adiciona `nm_mun_busca` se ausente e preenche com `normalizar()` numa transação, executa `bootstrap.sql`, loga duração; expõe `get db(): Database` e `onModuleDestroy` fechando -- núcleo da story.
- [x] `api/src/db/db.module.ts` -- `@Global()` exportando `DbService`.
- [x] `api/src/app.module.ts` -- importar `DbModule`.
- [x] `api/src/health/health.controller.ts`, `health.controller.spec.ts` -- injeta `DbService`; resposta ganha `municipios: <count mun_agg>`; unit com `DbService` falso -- prova do bootstrap no health.
- [x] `api/src/db/db.service.integration-spec.ts` (rodado pelo `npm test`, regex `\.(spec|integration-spec)\.ts$`) -- sobe `DbService` real com `DB_WORK_PATH` em `os.tmpdir()` e assere a tabela de valores de referência: soma de população, soma de área com tolerância 0,01, `count` 5.571 e 5.570 sem `'.'`, São Paulo capital (setores 27.301 = 27.037 + 254 + 10, população, área com tolerância 0,01, homens, mulheres, moradores), linha `'.'` presente com população 0, `nm_mun_busca` de `3550308` = `'sao paulo'`; roda duas vezes o bootstrap e confere que nada duplica -- R1, R2, R3, R5, R7.
- [x] `api/test/health.e2e-spec.ts` -- `process.env.DB_WORK_PATH` em `os.tmpdir()` no topo; assere `municipios: 5571`.
- [x] `api/Dockerfile` -- `ENV DB_SOURCE_PATH=/app/censo.sqlite DB_WORK_PATH=/data/censo.work.sqlite`, `RUN mkdir -p /data && chown node:node /data`, `USER node` antes de `CMD`.
- [x] `.gitignore` -- `.data/`.

**Acceptance Criteria:**
- Given `docker compose up --build`, when a API sobe, then o log mostra o bootstrap concluído em menos de 3 s e `/api/health` devolve `municipios: 5571`.
- Given `api/`, when `npm test`, then unit e integração verdes, incluindo os totais do IBGE.
- Given o bootstrap executado duas vezes, when se consulta `mun_agg`, then há exatamente 5.571 linhas.

## Implementation Notes

- Spec acima da faixa de 1600 tokens (~2200) por decisão: o excesso é a lista de valores de referência do IBGE nas asserções do teste de integração, que é o coração da story. Henrique autorizou seguir sem checkpoint.

## Spec Change Log

## Review Triage Log

| # | Origem | Achado | Veredito | Evidência / rota |
|---|---|---|---|---|
| 1 | verification-gap | Nenhum teste garante que o `censo.sqlite` de origem continua sem `mun_agg`, índices e `nm_mun_busca` após o bootstrap | high | Pré-verificado: abrir a origem em vez da cópia passaria toda a suíte. Viola a restrição central da story → patch: teste abre a origem readonly e assere ausência dos derivados |
| 2 | verification-gap | Testes de índice conferem só nomes, não tabela/coluna | medium | Índice na coluna errada passaria. → patch: `pragma index_info` |
| 3 | verification-gap | Default de `DB_WORK_PATH` (`<cwd>/.data/...`) nunca exercitado | low | Todos os testes definem a env; typo no default gravaria 48 MB fora do `.gitignore`. Fix é um `it` sem bootstrap → patch |
| 4 | verification-gap / blind-hunter | Comentário em `app.module.ts` atribui a garantia à ordem dos imports | low | Garantia real é `listen()` após todos os `onModuleInit`. Fix é reescrever o comentário → patch |
| 5 | verification-gap | Limpeza de `-journal/-wal/-shm` inalcançável com `journal_mode = MEMORY` | low | Correto: só protege contra restos de outro processo. Inofensivo → rejeitado, mantido |
| 6 | blind-hunter | Regex de diacríticos escrita com caracteres combinantes literais, invisíveis | medium | Verificado no arquivo (bytes CC80–CDAF). Formatador ou NFC pode corromper silenciosamente → patch `/\p{M}/gu` |
| 7 | blind-hunter | Smoke check do CI só confere `status: ok`, não `municipios: 5571` | medium | CI passaria com `mun_agg` vazia. → patch |
| 8 | blind-hunter | Linha da matriz "diretório de trabalho ausente" sem teste | medium | Auditoria da matriz exige cobertura. → patch: teste com pasta aninhada inexistente |
| 9 | blind-hunter | Teste do mapa de UFs compara só códigos, não nomes | low | Verificado: os 27 nomes batem hoje. Fix é uma asserção → patch |
| 10 | blind-hunter / edge-case | `fechar()` roda antes de validar a origem; re-run com origem sumida derruba a conexão boa | low | Só em re-run programático. Fix é reordenar → patch |
| 11 | blind-hunter | `stack.md` desatualizado: `CREATE IF NOT EXISTS` vs `DROP+CREATE`, default de `DB_WORK_PATH`, 2 vs 3 índices | low | Verificado. Documento é lido pelas stories 3 e 4 → patch documental feito pelo orquestrador, com entrada no memlog da spec |
| 12 | blind-hunter | Code Map da story omite `nest-cli.json`, `tsconfig.build.json`, `.dockerignore` | rejeitado | Fix edita a spec deste build; os motivos estão em Implementation Notes |
| 13 | blind-hunter | AGENTS.md: TODO de comandos, nome `*.integration-spec.ts`, envs `DB_*` e pasta `.data/` não registrados | defer | Arquivo de contexto de agente → deferred-work.md |
| 14 | blind-hunter | Comentário R2 no SQL ignora linhas de `demografia` com valores NULL (8.691 homens, 8.733 mulheres, 8.684 moradores) | medium | Verificado no arquivo; `moradores` NULL implica homens e mulheres NULL. `sum()` ignora, números corretos, mas a story 3 precisa saber → patch no comentário e nota em R2 de `regras-de-dados.md` |
| 15 | blind-hunter | `nm_mun_busca` da linha `'.'` fica `''`; nada assere nem documenta | low | Verificado. Story 3 deve excluir por `cd_mun <> '.'`, não por NULL → patch: asserção + nota no doc do método |
| 16 | edge-case | `DB_SOURCE_PATH` vazio ou diretório passa no `existsSync` e quebra com EISDIR cru | low | `resolve('')` é o cwd. Fix é trocar `existsSync` por `isFile()` → patch |
| 17 | edge-case | Origem e trabalho no mesmo caminho: o arquivo entregue seria aberto para escrita | medium | Só por env errada, mas viola a restrição central. Fix é uma comparação → patch |
| 18 | edge-case | Origem não é SQLite ou não tem `municipio`: erro cru sem caminho | low | Falha alta e cedo é comportamento correto → rejeitado |
| 19 | edge-case | `situacao` com valor fora de Urbana/Rural/NULL quebra R3 em silêncio | false | Verificado: `group_concat(distinct)` = Urbana, Rural, NULL. E o teste de integração assere R3 em todas as linhas, pegaria |
| 20 | edge-case | Health 200 com `mun_agg` vazia | low | Só com origem estranha; integração e e2e asseram 5571 → rejeitado |
| 21 | edge-case | `/data` montado do host como root após `USER node` | low | Compose não monta volume em `/data`; fora do fluxo do avaliador → rejeitado, nota para README de dev |

## Design Notes

Preencher `nm_mun_busca` em JS, não em SQL: o SQLite não remove acentos. Padrão:

```ts
const upd = db.prepare('UPDATE municipio SET nm_mun_busca = ? WHERE cd_mun = ?');
db.transaction((linhas) => { for (const l of linhas) upd.run(normalizar(l.nm_mun), l.cd_mun); })(db.prepare('SELECT cd_mun, nm_mun FROM municipio').all());
```

## Verification

**Commands:**
- `cd api && npm test` -- expected: unit + integração verdes, integração abaixo de 5 s.
- `cd api && npm run test:e2e` -- expected: health com `municipios: 5571`.
- `docker compose build && docker compose up -d --wait && curl -sf localhost:8080/api/health | grep -q '"municipios":5571'; docker compose down -v` -- expected: healthy e contagem correta.
