---
title: 'Documentação da API com Swagger'
type: 'feature'
created: '2026-09-29'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'c2ebc4fa3cf98f37e6fafe47ca4e89311b8b8457'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/specs/spec-censo-municipios/stack.md'
  - '{project-root}/README.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O contrato da API existe só como tabela no README e como cópia manual de tipos no front. Não há documentação navegável nem contrato legível por máquina, e a vaga cita APIs e integrações REST.

**Approach:** Gerar OpenAPI 3 a partir do próprio código com `@nestjs/swagger`: as interfaces de resposta viram classes anotadas, os controllers ganham decorators de operação, parâmetros e respostas, e a interface fica em `/api/docs`. Cobre CAP-9.

## Boundaries & Constraints

**Always:**
- `@nestjs/swagger` na linha 8.x (`^8.1.1`); a 11 exige NestJS 11.
- Interface em `/api/docs`, JSON em `/api/docs-json`, configurados em `configurarApp()` (`api/src/app.setup.ts`) com `useGlobalPrefix: true`, para valerem no `main.ts`, nos e2e e na imagem Docker.
- Respostas como classes com `@ApiProperty` explícito em cada campo (descrição e `example` com valor real: São Paulo capital `3550308`, UF `35`). Não usar o plugin do Nest CLI: o `ts-jest` dos e2e não o executa e o esquema sairia vazio nos testes.
- Objetos aninhados viram classes nomeadas: `SetoresResumo`, `SexoResumo`. Nomes dos esquemas: `UfResumo`, `Sugestao`, `MunicipioDetalhe`, `UfAgregado`, `RankingItem`, `RankingPagina`, `HealthResposta`, `ErroResposta`.
- Comportamento da API inalterado: mesmas rotas, mesmos status, mesmos corpos. Todos os testes existentes continuam verdes sem editar expectativas.
- A tabela da seção "API" do README permanece e ganha o link para `/api/docs`.
- Commits locais separados, Conventional Commits em português, nesta ordem: (1) `chore:` dependência e configuração; (2) `feat:` classes e decorators; (3) `test:` e2e do OpenAPI; (4) `ci:` smoke; (5) `docs:` README. Cada commit deixa `npm test` e `npm run test:e2e` verdes. Todo commit termina com a linha `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Sem push.

**Never:**
- Não adicionar `class-validator` nem `class-transformer`; a validação continua manual.
- Não alterar `web/` (a cópia de tipos do front fica como está), `censo.sqlite`, `docs/enunciado.md`, `AGENTS.md` nem `SPEC.md`.
- Não proteger a documentação com autenticação nem escondê-la por ambiente.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| JSON do contrato | `GET /api/docs-json` | 200, `openapi` começa com `3.`, `info.title` "Censo 2022 API" | N/A |
| Rotas documentadas | `paths` do JSON | exatamente `/api/health`, `/api/municipios`, `/api/municipios/{cdMun}`, `/api/ufs`, `/api/ufs/{cdUf}`, `/api/ufs/{cdUf}/municipios`, todas com `get` | teste falha se faltar ou sobrar |
| Parâmetros | `/api/municipios` e ranking | `q` obrigatório, `minLength 2`, `maxLength 100`; `page` opcional, `minimum 1`, `maximum 100000`, `default 1`; `pageSize` opcional, `minimum 1`, `maximum 100`, `default 50` | N/A |
| Esquemas | `components.schemas` | contém os oito nomes acima; `MunicipioDetalhe.setores` referencia `SetoresResumo` | N/A |
| Respostas de erro | operações com validação | `400` em `/api/municipios` e no ranking; `404` em `/{cdMun}`, `/{cdUf}` e no ranking, todas com `ErroResposta` | N/A |
| Interface | `GET /api/docs` | 200 HTML contendo `swagger-ui` | N/A |
| Pelo nginx | compose de pé | `localhost:8080/api/docs` e `/api/docs-json` respondem 200 | smoke do CI |
| Regressão | suítes atuais | 57 unit/integração e 54 e2e continuam verdes | N/A |

</frozen-after-approval>

## Code Map

- `api/src/app.setup.ts` -- `configurarApp(app)`, hoje só `setGlobalPrefix('api')`; é chamado por `main.ts` e pelos três e2e. Ponto único para o `SwaggerModule.setup`.
- `api/src/municipios/municipios.types.ts` -- interfaces `UfResumo`, `Sugestao`, `MunicipioDetalhe` (com `setores` e `sexo` inline). Importadas por `municipios.service.ts`, `municipios.controller.ts`, `ufs.types.ts`, `test/municipios.e2e-spec.ts`.
- `api/src/ufs/ufs.types.ts` -- `UfItem` (alias de `UfResumo`), `UfAgregado extends UfResumo`, `RankingItem`, `RankingPagina`. Importadas por `ufs.service.ts`, `ufs.controller.ts`, `test/ufs.e2e-spec.ts`.
- `api/src/health/health.controller.ts` -- `HealthResposta` é interface declarada no próprio controller.
- `api/src/municipios/municipios.controller.ts` -- `buscar(@Query('q') q?: unknown)`, `obter(@Param('cdMun'))`; constantes `Q_MAXIMO = 100`, `CD_MUN`.
- `api/src/ufs/ufs.controller.ts` -- `listar()`, `obter()`, `ranking()`; constantes `PAGE_MAXIMO = 100000`, `PAGE_SIZE_PADRAO = 50`, `PAGE_SIZE_MAXIMO = 100`. Reutilizar as constantes nos decorators, não repetir números.
- `api/tsconfig.json` -- `strict: true`: propriedades de classe sem inicializador exigem `!`.
- `.github/workflows/ci.yml` -- job `docker`, bloco de `curl | grep` após o `up --wait`.
- `README.md` -- seção `## API`, parágrafo antes da tabela.

## Tasks & Acceptance

**Execution:**
- [ ] `api/package.json`, `package-lock.json`, `api/src/app.setup.ts` -- instalar `@nestjs/swagger@^8.1.1`; em `configurarApp`, `DocumentBuilder` (título "Censo 2022 API", descrição de uma frase, versão do `package.json`) e `SwaggerModule.setup('docs', app, documento, { useGlobalPrefix: true, jsonDocumentUrl: 'docs-json' })` -- commit 1.
- [ ] `api/src/common/erro.types.ts` -- classe `ErroResposta` (`statusCode`, `message`, `error`) no formato padrão do Nest -- commit 2.
- [ ] `api/src/municipios/municipios.types.ts`, `api/src/ufs/ufs.types.ts`, `api/src/health/health.types.ts` -- interfaces viram classes com `@ApiProperty`; `SetoresResumo` e `SexoResumo` nomeadas; `HealthResposta` sai do controller -- commit 2.
- [ ] `api/src/health/health.controller.ts`, `municipios.controller.ts`, `ufs.controller.ts` -- `@ApiTags`, `@ApiOperation`, `@ApiQuery`/`@ApiParam` com limites vindos das constantes, `@ApiOkResponse` com o tipo (array onde couber), `@ApiBadRequestResponse`/`@ApiNotFoundResponse` com `ErroResposta` -- commit 2.
- [ ] `api/test/docs.e2e-spec.ts` -- todas as linhas da matriz que tocam `/api/docs` e `/api/docs-json`, no padrão dos e2e existentes -- commit 3.
- [ ] `.github/workflows/ci.yml` -- no smoke: `curl -sf localhost:8080/api/docs-json | grep -q '"openapi":"3'` e `curl -sf -o /dev/null localhost:8080/api/docs` -- commit 4.
- [ ] `README.md` -- na seção API, uma frase com o link `http://localhost:8080/api/docs` e o JSON; em "O que faria com mais tempo", trocar o item de tipos compartilhados por "gerar os tipos do front a partir do OpenAPI" -- commit 5.

**Acceptance Criteria:**
- Given `docker compose up --build`, when se abre `localhost:8080/api/docs`, then a interface lista seis rotas em três grupos e cada resposta mostra o esquema com exemplo.
- Given a suíte da API, when `npm test` e `npm run test:e2e`, then tudo verde, com o novo e2e incluído e nenhuma expectativa antiga editada.
- Given `git log` do branch, when se lê a story, then há cinco commits na ordem acima, cada um pequeno e verde.

## Implementation Notes

- Spec acima da faixa de 1600 tokens (~2350) por decisão de Henrique no checkpoint: o excesso é a matriz de casos do contrato e a ordem dos commits.

## Spec Change Log

## Review Triage Log

## Design Notes

Classe como tipo de retorno de objeto literal: o TypeScript é estrutural, então o service continua devolvendo literais. Forma de cada classe:

```ts
export class UfResumo {
  @ApiProperty({ description: 'Código da UF no IBGE', example: '35' })
  cdUf!: string;
}
```

Parâmetro `unknown` no controller precisa de tipo explícito no decorator: `@ApiQuery({ name: 'page', required: false, schema: { type: 'integer', minimum: 1, maximum: PAGE_MAXIMO, default: PAGE_PADRAO } })`.

## Verification

**Commands:**
- `cd api && npm test && npm run test:e2e` -- expected: verdes, e2e com o arquivo `docs` incluído.
- `cd api && npx tsc --noEmit -p tsconfig.json` -- expected: sem erros.
- `docker compose build && docker compose up -d --wait && curl -sf localhost:8080/api/docs-json | grep -q '"openapi":"3' && curl -sf -o /dev/null localhost:8080/api/docs && curl -sf localhost:8080/api/municipios/3550308 | grep -q '"densidade":7528.26'; docker compose down -v` -- expected: os três passam.
- `git log --oneline master..HEAD` -- expected: o commit da spec mais cinco commits da story, na ordem.
