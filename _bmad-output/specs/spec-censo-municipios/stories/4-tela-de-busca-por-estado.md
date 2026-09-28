---
title: 'Tela de busca por estado'
type: 'feature'
created: '2026-09-28'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '082193a71e8f21c24347226cbde425eed230342b'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/specs/spec-censo-municipios/regras-de-dados.md'
  - '{project-root}/_bmad-output/specs/spec-censo-municipios/stack.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A segunda tela do enunciado ainda é um `<h2>`. O avaliador precisa escolher uma UF, ver os agregados do estado inteiro e a lista de municípios do mais denso ao menos denso, que em São Paulo tem 645 linhas.

**Approach:** Três endpoints no Nest lendo `mun_agg` e a página `/estado` com seleção de UF, agregado no topo e tabela paginada. Cobre CAP-3 e CAP-4; aplica R1, R5, R6 e R7. Resolve a pergunta em aberto da SPEC: o agregado da UF vem em endpoint próprio.

## Boundaries & Constraints

**Always:**
- `GET /api/ufs`: as 27 UFs `{ cdUf, sigla, nome }` em ordem alfabética de nome, de `UFS` cruzado com a tabela `uf`.
- `GET /api/ufs/:cdUf`: `{ cdUf, sigla, nome, populacao, areaKm2, densidade, totalMunicipios }` somando `mun_agg` de todos os municípios da UF, **incluindo** `cd_mun = '.'` na população e na área (R1); `totalMunicipios` exclui `'.'`. 404 se a UF não existir.
- `GET /api/ufs/:cdUf/municipios?page=&pageSize=`: `{ total, page, pageSize, itens: [{ posicao, cdMun, nome, populacao, areaKm2, densidade }] }`; `cd_mun <> '.'`; ordem `densidade DESC, cd_mun ASC` calculada sobre a área crua; `posicao = (page - 1) * pageSize + índice + 1`; `page` default 1, `pageSize` default 50, máximo 100; 400 para valores não inteiros, menores que 1 ou `pageSize` acima de 100; `page` além do fim devolve `itens: []` com o `total` certo.
- Arredondamento a 2 casas só na resposta (R7). Validação à mão, sem `class-validator`.
- Tela `/estado`: uma linha de contexto, `<select>` com as 27 UFs, agregado do estado no topo (população, área, densidade, quantidade de municípios), tabela com posição, município, população, área e densidade, controles de paginação (anterior, próxima, "página X de Y", "N municípios"), estados de carregando, vazio e erro por tipo. Números em `pt-BR`. Trocar de UF volta para a página 1.
- Reutilizar `web/src/api/client.ts` (`descreverErro`, `ErroApi`), `formatar.ts` e o padrão de `AbortController` da story 3.

**Never:**
- Filtro de nome no ranking, ordenação clicável, exportação: fora de escopo.
- Nada de README (story 5). Nenhuma mudança na tela 1 além de estilos compartilhados.
- Sem biblioteca de tabela, componentes ou gráficos.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Lista de UFs | `GET /api/ufs` | 27 itens, primeiro Acre, último Tocantins | N/A |
| Agregado SP | `GET /api/ufs/35` | `sigla 'SP'`, `totalMunicipios 645` | N/A |
| Agregado RS inclui lagoas | `GET /api/ufs/43` | `areaKm2 281707.2`, `totalMunicipios 497` | N/A |
| Soma das UFs | 27 chamadas | população 203.080.756; área 8.510.417,25 ± 0,5 (soma de arredondados) | N/A |
| UF inexistente | `GET /api/ufs/99`, `/api/ufs/abc` | 404 | `NotFoundException` |
| Ranking SP página 1 | `GET /api/ufs/35/municipios` | `total 645`, `page 1`, `pageSize 50`, 50 itens, `itens[0]` = Taboão da Serra, `densidade 13417`, `posicao 1` | N/A |
| Ranking SP página 2 | `?page=2` | `itens[0].posicao 51`; nenhum `cdMun` repetido entre as páginas 1 e 2 | N/A |
| Ranking RR | `GET /api/ufs/14/municipios` | `total 15`, 15 itens, `posicao` 1 a 15 | N/A |
| Página além do fim | `?page=99` | `total 645`, `itens []` | N/A |
| Parâmetros inválidos | `?page=0`, `?page=abc`, `?pageSize=101`, `?pageSize=-1` | 400 | `BadRequestException` |
| Ranking RS não lista lagoas | `GET /api/ufs/43/municipios?pageSize=100&page=5` | nenhum item com nome vazio; `total 497` | N/A |
| Tela: escolher SP | `<select>` = São Paulo | agregado com `645 municípios`, tabela com 50 linhas, "página 1 de 13" | erro mostra `role=alert` |
| Tela: próxima página | clique em "Próxima" | primeira linha com posição 51 | N/A |
| Tela: trocar para RR | `<select>` = Roraima | 15 linhas, "página 1 de 1", botões desabilitados | N/A |

</frozen-after-approval>

## Code Map

- `api/src/municipios/municipios.service.ts`, `municipios.controller.ts` -- padrão a copiar: `DbService.db`, `arredondar()` (exportada; reutilizar, não duplicar), validação manual, `UFS` para sigla e nome.
- `api/src/db/bootstrap.sql` -- `mun_agg` com `populacao`, `area_km2` cruas; `municipio.cd_uf` indexado (`idx_mun_uf`).
- `api/test/municipios.e2e-spec.ts` -- forma dos e2e com `DB_WORK_PATH` em `os.tmpdir()`.
- `web/src/api/client.ts`, `tipos.ts` -- acrescentar `listarUfs()`, `obterUf(cdUf)`, `listarMunicipiosDaUf(cdUf, page, pageSize)` e os tipos; comentário cruzado com `api/src/ufs/ufs.types.ts`.
- `web/src/pages/BuscaMunicipio.tsx`, `components/CartoesMunicipio.tsx`, `styles.css` -- padrão de estados, cartões e classes CSS a reaproveitar.
- `web/src/App.tsx` -- rota `/estado` já aponta para `pages/BuscaUf.tsx`.

## Tasks & Acceptance

**Execution:**
- [x] `api/src/ufs/ufs.types.ts`, `ufs.service.ts` -- `listar()`, `obter(cdUf)`, `ranking(cdUf, page, pageSize)` com as regras acima -- núcleo.
- [x] `api/src/ufs/ufs.controller.ts`, `ufs.module.ts`; `api/src/app.module.ts` -- três rotas, validação de `cdUf` (2 dígitos e presente em `UFS`), `page`, `pageSize`.
- [x] `api/src/ufs/ufs.service.spec.ts` -- unit com `:memory:` (UF com 3 municípios mais a linha `'.'`: ordem por densidade, desempate por `cd_mun`, posição, agregado incluindo `'.'`, página além do fim).
- [x] `api/test/ufs.e2e-spec.ts` -- todas as linhas de API da matriz contra o banco real, incluindo a soma das 27 UFs.
- [x] `web/src/api/tipos.ts`, `client.ts` -- funções e tipos novos.
- [x] `web/src/components/AgregadoUf.tsx`, `TabelaRanking.tsx`, `Paginacao.tsx` -- cartões do estado, tabela e controles.
- [x] `web/src/pages/BuscaUf.tsx` -- linha de contexto, `<select>` carregado de `/api/ufs`, estados, reset de página ao trocar UF, `AbortController`.
- [x] `web/src/styles.css` -- estilos da tabela e da paginação.
- [x] `web/src/pages/BuscaUf.test.tsx` -- linhas de tela da matriz com `fetch` mockado: escolher SP, próxima página, trocar para RR, erro de rede, erro HTTP, resposta atrasada descartada -- DoD.

**Acceptance Criteria:**
- Given `docker compose up`, when o avaliador escolhe São Paulo, then vê 645 municípios em páginas de 50 com Taboão da Serra no topo e os agregados do estado acima.
- Given `api/` e `web/`, when `npm test` (e `test:e2e` na api, `build` no web), then verdes.

## Implementation Notes

- A matriz congelada cita `densidade 13417` (Taboão da Serra) e `areaKm2 281707.2` (RS) com referências de 1 casa/inteiro; R7 manda 2 casas e os valores exatos são 13.416,96 e 281.707,15. Implementado R7 como escrito; o e2e assere os valores a 2 casas e também o arredondado a 1 casa/inteiro da matriz. `regras-de-dados.md` atualizada com os valores a 2 casas.
- `GET /api/ufs` ordena com `Intl.Collator('pt-BR')`: o `ORDER BY nm_uf` do SQLite é bytewise e poria "Paraná" antes de "Pará".
- Verificação final: api 57 unit + 54 e2e; web 41 testes + build; compose: `/api/ufs/35` → 645 municípios, 44.411.238 hab, 248.219,49 km², 178,92 hab/km²; ranking p1 Taboão da Serra 13.416,96; p2 posição 51; `page` gigante → 400.
- Agregado da UF em endpoint próprio (`GET /api/ufs/:cdUf`), resolvendo a pergunta em aberto da SPEC; a tela pede o agregado uma vez e o ranking a cada página.

## Spec Change Log

## Review Triage Log

| # | Origem | Achado | Veredito | Evidência / rota |
|---|---|---|---|---|
| 1 | edge-case / blind-hunter / verification-gap | `page` com 18+ dígitos passa na validação e o OFFSET estoura: SQLite lança `datatype mismatch`, cliente recebe 500 | medium | Reproduzido por dois revisores contra o banco real → patch: `Number.isSafeInteger` e teto, mais caso no e2e |
| 2 | blind-hunter | Trocar de página desmonta tabela e botões: foco cai no body, layout salta, sem anúncio para leitor de tela | medium | Verificado no componente → patch: manter tabela e paginação montadas com `aria-busy` e botões desabilitados durante o carregamento; `role=status` no "Página X de Y" |
| 3 | blind-hunter | Fallback `'o estado'` gera "de o estado" | low | String errada, caminho improvável. Fix é a string → patch |
| 4 | blind-hunter / edge-case | 404 em `/api/ufs` mostra "Estado não encontrado." | low | Texto enganoso; fix é não passar `naoEncontrado` para a lista → patch |
| 5 | blind-hunter | Cabeçalho de `tipos.ts` cita só a fonte da story 3 | low | Fix é o comentário → patch |
| 6 | blind-hunter | `toMatch(/page/)` passa para `pageSize` por substring | low | Asserção fraca; fix no teste → patch |
| 7 | blind-hunter / verification-gap | Smoke do CI não cobre `/api/ufs`, nem `/api/municipios` da story 3 | medium | Via nginx só verificado à mão → patch: os greps das seções Verification das stories 3 e 4 no job `docker` |
| 8 | blind-hunter | Valores de referência mudaram (13.417 → 13.416,96; 281.707,2 → 281.707,15) sem nota na story | rejeitado como patch | Fix edita a spec deste build; o orquestrador registra em Implementation Notes: a matriz congelada usava referências com 1 casa, R7 manda 2, e2e assere as duas formas |
| 9 | blind-hunter | Erro na lista de UFs não tem "tentar de novo" | low | Só com API fora; fix adiciona superfície nova → rejeitado, nota para "com mais tempo" |
| 10 | blind-hunter | Teste "descarta resposta atrasada" nunca exercita o guard do caminho de sucesso | low | Mock rejeita no abort. Fix é uma variante do teste → patch |
| 11 | edge-case | `/api/ufs` devolvendo `[]` deixa o select vazio sem aviso | low | Inalcançável com o banco entregue (27 UFs asseridas na integração) → rejeitado |
| 12 | verification-gap | Singular "1 município" (Distrito Federal) nunca testado | low | Pré-verificado; fix é um caso de teste → patch |
| 13 | verification-gap | Contrato API/web só verificado contra a própria cópia de tipos em cada lado | defer | Mesmo desenho manual da story 3; fechar exige tipos compartilhados ou e2e de navegador → deferred-work.md e "com mais tempo" do README; o parcial barato é o #7 |

## Design Notes

Ranking em uma consulta: `SELECT m.cd_mun, m.nm_mun, a.populacao, a.area_km2, a.populacao * 1.0 / a.area_km2 AS dens FROM mun_agg a JOIN municipio m USING (cd_mun) WHERE m.cd_uf = ? AND m.cd_mun <> '.' ORDER BY dens DESC, m.cd_mun LIMIT ? OFFSET ?`, mais um `COUNT(*)` com o mesmo `WHERE` para `total`. Área zero não ocorre (verificado), mas proteger a divisão com `CASE WHEN a.area_km2 > 0`.

## Verification

**Commands:**
- `cd api && npm test && npm run test:e2e` -- expected: verdes.
- `cd web && npm test && npm run build` -- expected: verdes.
- `docker compose build && docker compose up -d --wait && curl -sf localhost:8080/api/ufs/35 | grep -q '"totalMunicipios":645' && curl -sf 'localhost:8080/api/ufs/35/municipios?page=2' | grep -q '"posicao":51'; docker compose down -v` -- expected: os dois greps passam.
