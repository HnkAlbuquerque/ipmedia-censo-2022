---
title: 'Documentação da API com Swagger'
type: 'feature'
created: '2026-09-29'
status: 'done'
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
- [x] `api/package.json`, `package-lock.json`, `api/src/app.setup.ts` -- instalar `@nestjs/swagger@^8.1.1`; em `configurarApp`, `DocumentBuilder` (título "Censo 2022 API", descrição de uma frase, versão do `package.json`) e `SwaggerModule.setup('docs', app, documento, { useGlobalPrefix: true, jsonDocumentUrl: 'docs-json' })` -- commit 1.
- [x] `api/src/common/erro.types.ts` -- classe `ErroResposta` (`statusCode`, `message`, `error`) no formato padrão do Nest -- commit 2.
- [x] `api/src/municipios/municipios.types.ts`, `api/src/ufs/ufs.types.ts`, `api/src/health/health.types.ts` -- interfaces viram classes com `@ApiProperty`; `SetoresResumo` e `SexoResumo` nomeadas; `HealthResposta` sai do controller -- commit 2.
- [x] `api/src/health/health.controller.ts`, `municipios.controller.ts`, `ufs.controller.ts` -- `@ApiTags`, `@ApiOperation`, `@ApiQuery`/`@ApiParam` com limites vindos das constantes, `@ApiOkResponse` com o tipo (array onde couber), `@ApiBadRequestResponse`/`@ApiNotFoundResponse` com `ErroResposta` -- commit 2.
- [x] `api/test/docs.e2e-spec.ts` -- todas as linhas da matriz que tocam `/api/docs` e `/api/docs-json`, no padrão dos e2e existentes -- commit 3.
- [x] `.github/workflows/ci.yml` -- no smoke: `curl -sf localhost:8080/api/docs-json | grep -q '"openapi":"3'` e `curl -sf -o /dev/null localhost:8080/api/docs` -- commit 4.
- [x] `README.md` -- na seção API, uma frase com o link `http://localhost:8080/api/docs` e o JSON; em "O que faria com mais tempo", trocar o item de tipos compartilhados por "gerar os tipos do front a partir do OpenAPI" -- commit 5.

**Acceptance Criteria:**
- Given `docker compose up --build`, when se abre `localhost:8080/api/docs`, then a interface lista seis rotas em três grupos e cada resposta mostra o esquema com exemplo.
- Given a suíte da API, when `npm test` e `npm run test:e2e`, then tudo verde, com o novo e2e incluído e nenhuma expectativa antiga editada.
- Given `git log` do branch, when se lê a story, then há cinco commits na ordem acima, cada um pequeno e verde.

## Implementation Notes

- Versão da API lida com `readFileSync` do `package.json` em vez de `import`: `resolveJsonModule` mudaria a raiz do `dist/` e quebraria `node dist/main`.
- `allOf` nas referências aninhadas (`setores`, `sexo`, `uf`): é como o `@nestjs/swagger` emite uma propriedade com descrição e `$ref`; o e2e resolve as duas formas.
- Correções da revisão em quatro commits próprios (`fix`, `test`, `ci`, `docs`), depois do commit da triagem.
- Verificação final: api 57 unit/integração + 86 e2e; web 41; os 11 comandos do smoke do CI passam pelo nginx; `/api/docs-yaml` 404; OpenAPI 3.0.0 com 6 rotas e 10 esquemas.
- Spec acima da faixa de 1600 tokens (~2350) por decisão de Henrique no checkpoint: o excesso é a matriz de casos do contrato e a ordem dos commits.

## Spec Change Log

## Review Triage Log

| # | Origem | Achado | Veredito | Evidência / rota |
|---|---|---|---|---|
| 1 | blind-hunter | A SPEC promete "um teste impede que divirjam", mas nenhum teste compara corpos 200 reais com os esquemas publicados; só `ErroResposta` é comparado | medium | Verificado no e2e. Um campo novo na resposta sem `@ApiProperty` passaria → patch: e2e compara as chaves da resposta real com `properties` de cada esquema |
| 2 | verification-gap / blind-hunter | Teste "exemplos são valores reais" compara literal com literal | low | Exemplos conferem hoje (revisores checaram contra o banco). Resolvido junto com o #1: exemplo comparado com a resposta real de São Paulo e SP → patch |
| 3 | verification-gap / blind-hunter / edge-case | Teste da versão aceita qualquer semver; `1.0.0` padrão da lib passaria | low | Pré-verificado → patch: comparar com `version` do `package.json` |
| 4 | verification-gap / blind-hunter / edge-case | Interface do Swagger verificada só pelo HTML de casca; scripts e bundle nunca requisitados, nem no e2e nem no smoke | medium | Pré-verificado: página em branco passaria verde → patch no e2e e no CI pelo nginx |
| 5 | verification-gap / blind-hunter | `pattern` de `cdMun` e `cdUf` publicado e não asserido | low | Pré-verificado → patch |
| 6 | verification-gap / blind-hunter / edge-case | `/api/docs-yaml` publicado por padrão, fora da spec, do README e dos testes | low | Reproduzido pelos revisores (200 `text/yaml`) → patch: `raw: ['json']` e teste de 404 |
| 7 | blind-hunter / edge-case | `versaoDaApi()` sem fallback e falha da documentação derrubam a API no boot | false | Não há caminho demonstrado: o `package.json` é copiado para a imagem e o job `docker` do CI sobe o compose com `--wait`; falhar alto no boot é o comportamento correto para configuração quebrada |
| 8 | blind-hunter | Avisos do `npm audit` que vieram com o Swagger 8 (`js-yaml`, `lodash`, altos) não aparecem na justificativa | medium | Verificado: 10 avisos de produção, 3 do swagger, 7 do Nest 10; correção de todos é subir o Nest de major → patch documental no README (decisão e "com mais tempo") |
| 9 | blind-hunter | `q` com `minLength: 2` no esquema, mas o mínimo conta após normalizar | low | `q=%20%20a%20` passa no esquema e leva 400. `minLength` é necessário, não suficiente → patch na descrição |
| 10 | blind-hunter | Exemplo de `SexoResumo`: homens + mulheres difere de `comDado` por 4; `cobertura` "com 4 casas" com exemplo `0.999` | low | Dado real (soma de `moradores`). Parece bug para quem lê → patch nas descrições ("até 4 casas") |
| 11 | blind-hunter | `RankingItem.densidade` sem a nota da área crua que os outros dois têm | low | → patch na descrição |
| 12 | blind-hunter / edge-case | Nomes das tags duplicados em `addTag` e `@ApiTags`; teste só conta 3 grupos | low | Tag sem acento passaria e perderia a descrição → patch: constantes compartilhadas e asserção de igualdade |
| 13 | blind-hunter | README "Desenvolvimento" não diz que a documentação existe sem Docker | low | → patch |
| 14 | verification-gap | README diz que o e2e "cobre os cinco endpoints"; são seis rotas | low | → patch |
| 15 | blind-hunter | `ErroResposta.message` descrito como "em português"; o 404 do framework é em inglês | low | Verificado (`Cannot GET ...`) → patch na descrição |
| 16 | blind-hunter | `operationId` como `MunicipiosController_buscar` e `info.contact` vazio | low | Só importa ao gerar clientes; nomes curtos colidem (`obter` em dois controllers) → rejeitado, nota em "com mais tempo" |
| 17 | blind-hunter | Mudança de status da story não commitada | note | Commitada pelo orquestrador no fechamento |
| 18 | edge-case | "Cinco commits": o branch tem sete (dois de spec antes) e o commit 2 também toca `app.setup.ts` | note | Ordem e estado verde confirmados pelo revisor; as tags pertencem ao commit dos decorators |

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
