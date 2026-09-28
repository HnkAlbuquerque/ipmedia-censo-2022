- source_spec: `_bmad-output/specs/spec-censo-municipios/stories/1-esqueleto-docker-compose-ci.md`
  summary: Registrar no AGENTS.md o pitfall do `better-sqlite3` (12.10+ sem binário para Node 20, pin 12.9.0) e trocar o TODO de comandos pelos verificados (`npm test`, `npm run test:e2e`, `npm test`/`npm run build`, `docker compose up`).
  evidence: Achado do revisor blind-hunter na story 1; o bloco é gerido por bmad-project-context, então a mudança vai por `record`/`refresh`, não por patch da story.
- source_spec: `_bmad-output/specs/spec-censo-municipios/stories/2-bootstrap-dos-dados-derivados.md`
  summary: AGENTS.md deve registrar o sufixo `*.integration-spec.ts` (roda no `npm test`), as envs `DB_SOURCE_PATH`/`DB_WORK_PATH` com seus defaults e a pasta local `.data/`.
  evidence: Achado do blind-hunter na story 2; bloco gerido por bmad-project-context, resolver junto com o item da story 1 via `refresh`.
- source_spec: `_bmad-output/specs/spec-censo-municipios/stories/4-tela-de-busca-por-estado.md`
  summary: Contrato API/web é verificado só contra a cópia manual de tipos de cada lado; um rename de campo passaria com as duas suítes verdes. Fechar com tipos compartilhados (pacote comum) ou e2e de navegador (Playwright).
  evidence: Achado do verification-gap na story 4, mesmo desenho da story 3; mitigado parcialmente pelos greps do compose no CI. Entra no "com mais tempo" do README.
