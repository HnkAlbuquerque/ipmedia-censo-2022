---
title: 'README com instalação e decisões'
type: 'chore'
created: '2026-09-28'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '5ca8ba06661f437793a6fc6b340a21125f658c8d'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/specs/spec-censo-municipios/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-censo-municipios/regras-de-dados.md'
  - '{project-root}/_bmad-output/specs/spec-censo-municipios/stack.md'
  - '{project-root}/docs/enunciado.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O enunciado exige um README com instalação, execução, as decisões técnicas com o porquê, e o que seria feito diferente com mais tempo. Hoje não existe README, e o contrato da API vive em `stack.md`, que quem clona não abre.

**Approach:** Escrever `README.md` na raiz, em português, curto e direto, movendo o contrato da API de `stack.md` para lá (deixando um link) e separando "como rodar" (só Docker) de "desenvolvimento". Cobre CAP-8.

## Boundaries & Constraints

**Always:**
- Seções, nesta ordem: título e uma frase; **Como rodar** (`git clone`, `docker compose up --build`, abrir `http://localhost:8080`; nada mais); **As duas telas** (o que cada uma faz, com o roteiro de demonstração: "sao" → São Paulo; São Paulo no ranking com 645 municípios); **API** (tabela do contrato, movida de `stack.md`); **Decisões técnicas e por quê** (uma subseção por regra R1 a R7 e uma para a stack, cada uma com o problema, a decisão e o motivo em 2 a 4 frases, com os números de conferência); **Como o dado foi tratado** pode ser fundido na anterior; **Testes** (o que existe em cada lado e como rodar); **Desenvolvimento** (rodar sem Docker: `npm run start:dev` em `api/`, `npm run dev` em `web/`, proxy do Vite, envs `DB_SOURCE_PATH`/`DB_WORK_PATH`); **Processo com BMAD** (spec → party mode → stories → bmad-build com revisão adversarial → PR por story → CI; onde estão os artefatos; o que é o `.memlog.md`); **O que faria com mais tempo** (Playwright de ponta a ponta; filtro de nome no ranking; tipos compartilhados entre API e web; botão "tentar de novo" na lista de UFs; deploy: imagem no ECR e serviço no ECS; cache HTTP nas respostas, que são estáticas).
- Todos os números citados vêm de `regras-de-dados.md`; nenhum inventado.
- Notas obrigatórias: a área do RS inclui 13.086 km² de lagoas que não aparecem no ranking (R1); a divisão por sexo cobre 99,7% da população e a tela mostra a cobertura (R2); `better-sqlite3` fixado em 12.9.0 porque 12.10+ não publica binário para Node 20; `censo.sqlite` nunca é alterado, o bootstrap trabalha numa cópia.
- `stack.md`: substituir a seção "Contrato da API" por um parágrafo apontando para o README, mantendo o resto.
- Tom: primeira pessoa do autor (Henrique), sem marketing, frases curtas. Sem emojis. Tabelas onde houver números.
- Tamanho alvo: 150 a 250 linhas.

**Never:**
- Não alterar código, testes, Dockerfiles, CI ou `SPEC.md`.
- Não copiar o enunciado nem descrever a estrutura de pastas em árvore.
- Não prometer nada que não esteja implementado.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Avaliador segue "Como rodar" | máquina só com Docker | três comandos, tela funcionando em `localhost:8080` | N/A |
| Leitor procura o contrato | seção API | cinco endpoints com parâmetros e forma da resposta | N/A |
| Leitor pergunta "por que 5.570 e não 5.571?" | seção R1 | resposta com os dois números do IBGE e a decisão | N/A |
| `stack.md` | após a story | contrato substituído por link para o README | N/A |

</frozen-after-approval>

## Code Map

- `_bmad-output/specs/spec-censo-municipios/regras-de-dados.md` -- fonte de todos os números e das regras R1 a R7.
- `_bmad-output/specs/spec-censo-municipios/stack.md` -- contrato da API (mover), bootstrap, dev local, convenções.
- `_bmad-output/specs/spec-censo-municipios/SPEC.md` -- capacidades e não-objetivos, para a seção "com mais tempo" não contradizer.
- `_bmad-output/specs/spec-censo-municipios/.memlog.md` -- ordem das decisões, para o texto do processo.
- `api/src/ufs/ufs.controller.ts`, `municipios.controller.ts` -- confirmar parâmetros e limites reais (`q` 2 a 100 caracteres; `page` até 100000; `pageSize` até 100) antes de escrever a tabela.
- `docker-compose.yml`, `api/Dockerfile` -- confirmar porta 8080, envs e usuário `node`.

## Tasks & Acceptance

**Execution:**
- [x] `README.md` -- escrever conforme as fronteiras, confirmando cada número e cada comando no código -- CAP-8.
- [x] `_bmad-output/specs/spec-censo-municipios/stack.md` -- trocar a seção "Contrato da API" por um parágrafo com link `../../../README.md#api`.

**Acceptance Criteria:**
- Given uma pessoa que só leu o README, when segue "Como rodar", then a aplicação sobe e ela sabe o que digitar para testar as duas telas.
- Given a seção de decisões, when se lê R1 a R7, then cada uma tem problema, decisão e motivo com número de conferência.
- Given `stack.md`, when se procura o contrato, then há um link para o README e nenhuma tabela duplicada.

## Implementation Notes

- Correções da revisão aplicadas pelo orquestrador diretamente (prosa): 15 patches, 1 adiamento. Contagens da tabela R4 remedidas com a regra de prefixo de palavra (364/104/23/14).

## Spec Change Log

## Review Triage Log

| # | Origem | Achado | Veredito | Evidência / rota |
|---|---|---|---|---|
| 1 | blind-hunter / edge-case | README diz `densidade = populacao / areaKm2`; a API calcula sobre a área crua (SP: 7528,27 recalculado vs 7528,26 devolvido) | medium | Verificado no service. Leitor que confere acha o README errado → patch (API e R7) |
| 2 | edge-case | "Parâmetro inválido devolve 400": código de município/UF fora do formato devolve 404 | low | Verificado nos controllers → patch |
| 3 | edge-case | `q` mínimo contado após normalizar; `q` repetido → 400; página além do fim → 200 vazio; `/api/health` devolve 5571 e não 5570 | low | Verificado → patch |
| 4 | blind-hunter / edge-case | "Node 20" insuficiente: web exige >= 20.19 | low | `web/package.json` → patch |
| 5 | blind-hunter / edge-case | "Só precisa de Docker": exige Compose v2 e porta 8080 livre; falta `docker compose down`, cópia efêmera e porta 3000 não publicada | low | → patch |
| 6 | blind-hunter | Bloco de desenvolvimento não roda como escrito (sequencial, `cd` relativo) | low | → patch: dois terminais a partir da raiz |
| 7 | blind-hunter | "Duas variáveis de ambiente": falta `PORT` | low | `main.ts` → patch |
| 8 | blind-hunter / verification-gap / edge-case | "Um arquivo e2e por endpoint": são três arquivos por módulo | low | `api/test/` → patch |
| 9 | verification-gap / edge-case | CI "um valor por endpoint": `GET /api/ufs` não tem curl no smoke | low | `ci.yml` → patch na frase (não prometer o que não há) |
| 10 | verification-gap / edge-case / blind-hunter | Tabela R4 mistura contagens por prefixo simples (344/64/20) com prefixo de palavra (14); "só Paulo Afonso, Paulo Ramos" quando são 7 | medium | Remedido: prefixo de palavra dá 364/104/23/14 → patch no README e em `regras-de-dados.md` |
| 11 | edge-case | "`normalizar()` única no código": o front repete a normalização para contar o mínimo | low | Verificado em `Autocomplete.tsx` → patch na frase; unificar de fato fica para "com mais tempo" |
| 12 | verification-gap / blind-hunter | `.memlog.md` e `deferred-work.md` citados sem caminho | low | → patch |
| 13 | blind-hunter | `stack.md` ainda dizia que o CI faz só `build` | low | → patch na linha CI |
| 14 | blind-hunter | Imagem base sem qualificar que é só da `api` (o `web` é nginx alpine) | low | → patch |
| 15 | blind-hunter | README não linka `docs/enunciado.md` | low | → patch |
| 16 | blind-hunter / edge-case | `AGENTS.md` e os comentários de `*.types.ts`/`tipos.ts` ainda apontam o contrato para `stack.md` | defer | AGENTS.md é gerido por `bmad-project-context`; comentários de código estão fora do escopo desta story → deferred-work.md |

## Verification

**Commands:**
- `grep -c '^## ' README.md` -- expected: entre 8 e 11 seções.
- `grep -n '5.570\|8.510.417\|203.080.756\|12.9.0\|13.086' README.md` -- expected: todos presentes.
- `grep -n 'Contrato da API' _bmad-output/specs/spec-censo-municipios/stack.md` -- expected: só o parágrafo com link, sem tabela.
