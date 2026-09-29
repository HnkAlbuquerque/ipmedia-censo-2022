# Instruções para agentes

<!-- bmad:context -->
<!-- Verified 2026-09-29 against 9a2ad4c. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## ipmedia-censo-2022

Teste técnico full stack: consulta ao Censo 2022 do IBGE por município e por UF, em duas telas. NestJS + `better-sqlite3` na API, React + Vite no front, tudo sobe com `docker compose up`. O contrato do que construir está em `_bmad-output/specs/spec-censo-municipios/` (SPEC.md, regras-de-dados.md, stack.md, stories.yaml); o contrato da API e as decisões, no `README.md`; o enunciado original em `docs/enunciado.md`.

## Policy

- Nunca alterar `censo.sqlite` nem `docs/enunciado.md`: são a entrega do avaliador. Dados derivados nascem em uma cópia no startup da API (stack.md, "Bootstrap").
- Nunca editar `_bmad/config.toml` e `_bmad/_config/`: o instalador sobrescreve. Ajustes vão em `_bmad/custom/`.
- Nunca copiar tokens ou credenciais para o repositório, nem em `.env` versionado.
- Commits com prefixo Conventional Commits, mensagem em português, pequenos e frequentes. Nunca squash: o histórico é parte da entrega.
- Um branch e um PR por story de `stories.yaml`; merge com merge commit.

## Where things are

- Regras de dado com valores de referência para testes: `_bmad-output/specs/spec-censo-municipios/regras-de-dados.md`
- Contrato da API (endpoints, parâmetros, limites): `README.md`, seção "API"
- Stack, estrutura de pastas, bootstrap e desenvolvimento local: `_bmad-output/specs/spec-censo-municipios/stack.md`
- Achados de revisão adiados: `_bmad-output/implementation-artifacts/deferred-work.md`
- Decisões e a ordem em que foram tomadas: `_bmad-output/specs/spec-censo-municipios/.memlog.md`

## Running and verifying

- Scripts do BMAD rodam com `uv run`; se `uv` não for encontrado, `export PATH="$HOME/.local/bin:$PATH"` antes.
- API em `api/`: `npm test` roda unitários e integração, `npm run test:e2e` roda os e2e. Front em `web/`: `npm test` e `npm run build`. Tudo junto: `docker compose up --build` na raiz, tela em `http://localhost:8080`.
- Integração e e2e da API leem o `censo.sqlite` real: rodar de dentro de `api/`, ou exportar `DB_SOURCE_PATH`. A cópia de trabalho vai para `DB_WORK_PATH` (padrão `api/.data/`, ignorada pelo git).
- Front exige Node 20.19 ou superior (Vite 7).
- Ao fim de cada story, rodar `docker compose up` localmente antes do PR: é assim que o avaliador vai ver.

## Conventions that differ from defaults

- Termos de domínio em português, iguais ao banco e à API (`cdMun`, `populacao`, `setores`, `densidade`); estrutura em inglês (`service`, `controller`, `module`). Comentários em português.
- Área e densidade arredondadas a 2 casas só na resposta; densidade calculada sobre a área crua; população inteira, nunca arredondada (regras-de-dados.md, R7).
- `*.spec.ts` são unitários com banco em memória; `*.integration-spec.ts` rodam no `npm test` e tocam o banco real.
- Uma única função `normalizar()` em `api/src/common/`, usada no bootstrap e na busca; nunca duplicar a normalização.

## Known pitfalls

- `cd_mun = '.'` (setores sem município, lagoas do RS) fica fora do autocomplete e do ranking, mas dentro das somas da UF e do país (R1). Filtrar nas consultas de lista, nunca no bootstrap.
- `better-sqlite3` é módulo nativo: usar `node:20-bookworm-slim`, nunca Alpine, que exige compilar com node-gyp e falha.
- `better-sqlite3` fica fixado em `12.9.0` exato: 12.10+ não publica binário para Node 20 e o `npm ci` na imagem falha. Só subir a versão junto com o Node.
- A linha `cd_mun = '.'` tem `nm_mun_busca = ''`, não NULL: excluir por `cd_mun <> '.'`.

<!-- /bmad:context -->
