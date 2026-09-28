- source_spec: `_bmad-output/specs/spec-censo-municipios/stories/1-esqueleto-docker-compose-ci.md`
  summary: Registrar no AGENTS.md o pitfall do `better-sqlite3` (12.10+ sem binário para Node 20, pin 12.9.0) e trocar o TODO de comandos pelos verificados (`npm test`, `npm run test:e2e`, `npm test`/`npm run build`, `docker compose up`).
  evidence: Achado do revisor blind-hunter na story 1; o bloco é gerido por bmad-project-context, então a mudança vai por `record`/`refresh`, não por patch da story.
