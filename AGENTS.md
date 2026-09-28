# Instruções para agentes

<!-- bmad:context -->
<!-- Verified 2026-09-28 against c050530. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## ipmedia-censo-2022

Teste técnico full stack: consulta ao Censo 2022 do IBGE por município e por UF, em duas telas. NestJS + `better-sqlite3` na API, React + Vite no front, tudo sobe com `docker compose up`. O contrato do que construir está em `_bmad-output/specs/spec-censo-municipios/` (SPEC.md, regras-de-dados.md, stack.md, stories.yaml); o enunciado original em `docs/enunciado.md`.

## Policy

- Nunca alterar `censo.sqlite` nem `docs/enunciado.md`: são a entrega do avaliador. Dados derivados nascem em uma cópia no startup da API (stack.md, "Bootstrap").
- Nunca editar `_bmad/config.toml` e `_bmad/_config/`: o instalador sobrescreve. Ajustes vão em `_bmad/custom/`.
- Nunca copiar tokens ou credenciais para o repositório, nem em `.env` versionado.
- Commits com prefixo Conventional Commits, mensagem em português, pequenos e frequentes. Nunca squash: o histórico é parte da entrega.
- Um branch e um PR por story de `stories.yaml`; merge com merge commit.

## Where things are

- Regras de dado com valores de referência para testes: `_bmad-output/specs/spec-censo-municipios/regras-de-dados.md`
- Stack, estrutura de pastas, contrato da API e bootstrap: `_bmad-output/specs/spec-censo-municipios/stack.md`
- Decisões e a ordem em que foram tomadas: `_bmad-output/specs/spec-censo-municipios/.memlog.md`

## Running and verifying

- Scripts do BMAD rodam com `uv run`; se `uv` não for encontrado, `export PATH="$HOME/.local/bin:$PATH"` antes.
- TODO (verificar após a story 1): API em `api/` com `npm test` (unit + integração) e `npm run test:e2e`; front em `web/` com `npm test`; tudo junto com `docker compose up` na raiz.
- Ao fim de cada story, rodar `docker compose up` localmente antes do PR: é assim que o avaliador vai ver.

## Conventions that differ from defaults

- Termos de domínio em português, iguais ao banco e à API (`cdMun`, `populacao`, `setores`, `densidade`); estrutura em inglês (`service`, `controller`, `module`). Comentários em português.
- Área e densidade arredondadas a 2 casas no servidor; população inteira, nunca arredondada (regras-de-dados.md, R7).
- Uma única função `normalizar()` em `api/src/common/`, usada no bootstrap e na busca; nunca duplicar a normalização.

## Known pitfalls

- `cd_mun = '.'` (setores sem município, lagoas do RS) fica fora do autocomplete e do ranking, mas dentro das somas da UF e do país (R1). Filtrar nas consultas de lista, nunca no bootstrap.
- `better-sqlite3` é módulo nativo: usar `node:20-bookworm-slim`, nunca Alpine, que exige compilar com node-gyp e falha.

<!-- /bmad:context -->
