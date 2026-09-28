---
title: 'Tela de busca de município'
type: 'feature'
created: '2026-09-28'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'be18817c61705acc88047c01f6eee61ecef286c0'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/specs/spec-censo-municipios/regras-de-dados.md'
  - '{project-root}/_bmad-output/specs/spec-censo-municipios/stack.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A primeira tela do enunciado ainda é um `<h2>`. O avaliador precisa digitar parte de um nome, escolher o município certo entre homônimos e ver os agregados dele.

**Approach:** Dois endpoints no Nest lendo `mun_agg` e `municipio.nm_mun_busca`, e a página `/municipio` com autocomplete e cartões. Cobre CAP-1 e CAP-2; aplica R1, R2, R3, R4 e R7 de `regras-de-dados.md`.

## Boundaries & Constraints

**Always:**
- Busca: `t = normalizar(q)`; casa `nm_mun_busca LIKE t || '%' OR nm_mun_busca LIKE '% ' || t || '%'` com `ESCAPE '\'` e `%`/`_` escapados em `t`; ordem `CASE WHEN nm_mun_busca = t THEN 0 ELSE 1 END, populacao DESC, nm_mun`; `cd_mun <> '.'`; `LIMIT 10`; `q` com menos de 2 caracteres após normalizar devolve 400.
- Detalhe: `populacao` de `mun_agg`; `areaKm2` e `densidade = populacao / area_km2` arredondadas a 2 casas no service (R7); `setores` com as três categorias que somam `total` (R3); `sexo = { homens, mulheres, comDado: moradores, cobertura: comDado / populacao com 4 casas }` (R2). `cd_mun` inexistente ou `'.'` devolve 404.
- UF sempre presente na sugestão e no detalhe: `{ cdUf, sigla, nome }` via `UFS` de `api/src/common/ufs.ts`.
- Front chama só `/api/...` relativo por um cliente tipado em `web/src/api/`. Nenhuma agregação no cliente.
- Tela: uma linha de contexto acima do campo; campo com mínimo 2 caracteres e debounce de 300 ms; sugestões como "Nome - UF"; seleção por `cdMun`; cartões com população, setores (total e as três categorias), área, densidade, sexo com barras simples e a nota "dado por sexo disponível para X% da população". Números em `pt-BR`.
- Estados visíveis: carregando, nenhum resultado, erro de rede.

**Never:**
- Nada de UF na tela 2, ranking, paginação: story 4. Nada de README: story 5.
- Sem biblioteca de componentes, de autocomplete ou de gráficos.
- Sem `class-validator`; validar `q` e `cdMun` à mão no controller.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Prefixo comum | `GET /api/municipios?q=sao` | 10 itens, primeiro São Paulo (SP) | N/A |
| Prefixo de palavra | `q=paulo` | primeiro São Paulo (SP) | N/A |
| Homônimos | `q=bom jesus` | 5 primeiros com nome exato "Bom Jesus", 5 UFs distintas; Bom Jesus da Lapa depois | N/A |
| Acento e caixa | `q=SÃO GONÇ` | contém São Gonçalo (RJ) | N/A |
| Curto ou ausente | `q=a`, sem `q`, `q=%20` | 400 JSON com mensagem | `BadRequestException` |
| Sem resultado | `q=xyzxyz` | `[]` 200 | N/A |
| Curinga no termo | `q=%25` | 400 (curto) ; `q=sa_` casa só literal | `ESCAPE` |
| Detalhe SP capital | `GET /api/municipios/3550308` | `populacao 11451999`, `areaKm2 1521.2`, `densidade 7528.26`, `setores {27301, 27037, 254, 10}`, `sexo {5380188, 6060887, 11441079, 0.999}` (cobertura com 4 casas: `0.999`), `uf.sigla 'SP'` | N/A |
| Detalhe inexistente ou lagoas | `/api/municipios/0000000`, `/api/municipios/.` | 404 JSON | `NotFoundException` |
| Tela: digitar 1 letra | `"s"` | nenhuma requisição | N/A |
| Tela: digitar "sao" | após 300 ms | lista com "São Paulo - SP" no topo | erro de rede mostra mensagem |
| Tela: selecionar | clique em "São Paulo - SP" | cartões com `11.451.999`, `27.301` setores, `1.521,20 km²`, `7.528,26 hab/km²`, nota de cobertura `99,9%` | N/A |

</frozen-after-approval>

## Code Map

- `api/src/db/db.service.ts` -- `DbService.db` (better-sqlite3 síncrono); `DbModule` é global, basta injetar.
- `api/src/db/bootstrap.sql` -- colunas de `mun_agg`: `cd_mun, setores_total, setores_urbanos, setores_rurais, setores_nao_informados, populacao, area_km2, homens, mulheres, moradores`. `municipio.nm_mun_busca` já preenchida; linha `'.'` tem `''`.
- `api/src/common/normalizar.ts`, `ufs.ts` -- reutilizar; nunca duplicar.
- `api/src/health/*`, `api/test/health.e2e-spec.ts` -- padrão de controller, unit com `DbService` falso e e2e com `DB_WORK_PATH` em `os.tmpdir()`; copiar a forma.
- `web/src/App.tsx`, `pages/BuscaMunicipio.tsx`, `styles.css`, `App.test.tsx`, `setupTests.ts` -- rota e página já existem; testes com Testing Library; `fetch` deve ser mockado com `vi.stubGlobal`.

## Tasks & Acceptance

**Execution:**
- [x] `api/src/municipios/municipios.service.ts` -- `buscar(q): Sugestao[]` e `obter(cdMun): MunicipioDetalhe | undefined` com as regras acima; tipos exportados de `municipios.types.ts` -- núcleo.
- [x] `api/src/municipios/municipios.controller.ts`, `municipios.module.ts` -- `GET /api/municipios?q=` e `GET /api/municipios/:cdMun`; validação manual; 400/404 -- contrato de `stack.md`.
- [x] `api/src/app.module.ts` -- importar `MunicipiosModule`.
- [x] `api/src/municipios/municipios.service.spec.ts` -- unit com banco `:memory:` mínimo (5 municípios cobrindo exato, prefixo de palavra, `'.'`, curinga) -- lógica de busca sem o arquivo real.
- [x] `api/test/municipios.e2e-spec.ts` -- todas as linhas de API da matriz contra o banco real -- CAP-1, CAP-2.
- [x] `web/src/api/client.ts`, `web/src/api/tipos.ts` -- `buscarMunicipios(q)` e `obterMunicipio(cdMun)` tipados; erro HTTP vira `Error` com status -- único ponto de acesso à API.
- [x] `web/src/components/Autocomplete.tsx` -- input controlado, debounce 300 ms, mínimo 2, lista com teclado (setas e Enter) e clique, `aria-*` básicos -- CAP-1.
- [x] `web/src/components/CartoesMunicipio.tsx`, `web/src/utils/formatar.ts` -- cartões, barras simples de setores e sexo, formatação `pt-BR` (`Intl.NumberFormat`) -- CAP-2.
- [x] `web/src/pages/BuscaMunicipio.tsx` -- linha de contexto, `Autocomplete`, estados carregando/vazio/erro, `CartoesMunicipio` -- tela 1.
- [x] `web/src/styles.css` -- estilos dos novos componentes, sem framework.
- [x] `web/src/pages/BuscaMunicipio.test.tsx`, `web/src/utils/formatar.test.ts` -- linhas de tela da matriz com `fetch` mockado e timers falsos; formatação `1521.2 -> "1.521,20"` -- DoD.

**Acceptance Criteria:**
- Given `docker compose up`, when o avaliador digita "sao" e seleciona São Paulo - SP, then vê 11.451.999 habitantes e a nota de cobertura.
- Given `api/`, when `npm test` e `npm run test:e2e`, then verdes, incluindo as linhas de API da matriz.
- Given `web/`, when `npm test` e `npm run build`, then verdes.

## Implementation Notes

- Densidade calculada sobre a área crua e só então arredondada; arredondar a área antes daria 7528,27 em vez de 7528,26 para São Paulo.
- R4 esclarecida na revisão: separadores de palavra são espaço, hífen e apóstrofo (71 municípios afetados). Registrado no memlog da spec e em `regras-de-dados.md`.
- Mensagens de erro no front por tipo (rede, 404, outro status) via `descreverErro()` em `web/src/api/client.ts`; nunca renderiza `e.message` cru do navegador.
- `arredondar()` em notação exponencial para evitar 1,005 → 1,00.
- Verificação final: api 45 unit/integração + 22 e2e; web 24 testes + build; compose: `q=sao` → São Paulo-SP primeiro, `q=mirim` → Ceará-Mirim presente, detalhe 3550308 exato (1521.2, 7528.26, 27301/27037/254/10, cobertura 0.999).
- Limitação conhecida: `GET /api/municipios/.` devolve 404 na API, mas navegadores normalizam o segmento `.` e nem chegam a enviá-lo.

## Spec Change Log

## Review Triage Log

| # | Origem | Achado | Veredito | Evidência / rota |
|---|---|---|---|---|
| 1 | blind-hunter / edge-case / verification-gap | `ErroApi.status` nunca é lido: 404 e 500 viram "verifique a conexão"; mensagem crua do navegador ("Failed to fetch") vaza na tela; `erro` do Autocomplete é dado morto | medium | Verificado no código. Usuário vê mensagem errada → patch: mensagem por tipo (rede / 404 / outro status), sem texto cru do browser |
| 2 | blind-hunter / edge-case | Lista não fecha ao perder o foco; painel absoluto cobre os cartões | medium | Tab ou clique fora deixa `aria-expanded=true` → patch `onBlur` (opções com `onMouseDown preventDefault`) |
| 3 | edge-case | Resposta que chega depois do Escape reabre o painel | low | Reproduzível dentro dos 300 ms → patch com flag de fechado |
| 4 | blind-hunter / edge-case | ArrowDown não reabre a lista após Escape | low | Padrão de combobox → patch |
| 5 | edge-case | Lista antiga continua selecionável durante o debounce do termo novo | medium | "sao p" no campo, "São Luís" selecionável → patch: limpar sugestões no `onChange` |
| 6 | blind-hunter | "Nenhum município encontrado" fica estampado durante o debounce do termo seguinte | low | Mesma causa do #5 → agrupado |
| 7 | blind-hunter | `aria-live` envolve o listbox (anuncia 10 opções a cada tecla) e `aria-controls` aponta para id inexistente | low | Verificado → patch: live só nos `<p>` de estado, id fixo no container |
| 8 | blind-hunter | Comentário do service diz que termo vazio "não casa nada"; na verdade `''` vira `LIKE '%'` | low | Provado pelo próprio spec unitário → patch: `if (termo.length < 2) return []` e comentário |
| 9 | blind-hunter | Sem teto para `q` | low | `q` de dezenas de KB passa por NFD e dois LIKE → patch: máximo 100 caracteres, 400 |
| 10 | blind-hunter / verification-gap | Desempate `nm_mun` não é determinístico entre homônimos com população igual; e ninguém testa o desempate | low | Verificado: os 5 "Bom Jesus" têm o mesmo `nm_mun` → patch: `cd_mun` como último critério + teste com populações iguais |
| 11 | blind-hunter / edge-case | Prefixo de palavra ignora hífen e apóstrofo: "mirim" não acha Guajará-Mirim, "oeste" não acha Espigão D'Oeste | medium | Verificado: 71 municípios com hífen ou apóstrofo. A leitura natural de "prefixo de palavra" inclui esses separadores → patch (`OR LIKE '%-t%' OR LIKE "%'t%"`), com nota em R4 e no memlog da spec |
| 12 | blind-hunter | Tipos duplicados à mão entre `api` e `web` | low | Real, mas monorepo sem workspace; e2e valida a forma → patch mínimo: comentário cruzado nos dois arquivos |
| 13 | blind-hunter | Validação do controller só testada no e2e (precisa do banco real) | low | O e2e roda no CI com o `censo.sqlite` versionado; duplicar em unit não muda comportamento → rejeitado |
| 14 | blind-hunter | Story sem Implementation Notes nem resultado de verificação | rejeitado | Fix edita a spec deste build; o orquestrador preenche as notas no fechamento |
| 15 | edge-case | Front conta mínimo após `trim()`, API após `normalizar()`: letra + marca combinante passa no front e leva 400 | low | Caso raro, fix é espelhar a normalização no cliente (uma linha) → patch |
| 16 | edge-case | `arredondar` com `valor * fator` erra em fronteiras binárias (1.005 → 1.00) | low | Real em JS; fix é a forma exponencial (`Number(v e casas)`) → patch |
| 17 | verification-gap | Seleção não deve disparar nova busca pelo rótulo, e nenhum teste avança o timer após selecionar | medium | Pré-verificado → patch: teste avança 300 ms e assere 2 chamadas de fetch |
| 18 | verification-gap | Abort do detalhe antigo ao trocar de município não é observado | medium | Pré-verificado → patch: teste com dois detalhes pendentes |
| 19 | verification-gap | Mensagem da API nunca é asserida onde é exibida | medium | Pré-verificado; junta com #1 → patch: teste de 404 no detalhe com a mensagem |
| 20 | verification-gap | Percentuais das barras nunca são asseridos | medium | Pré-verificado; trocar a base passaria → patch: asserções `(99,0%)`, `(47,0%)` etc. |
| 21 | verification-gap | Fixtures não distinguem 2 casas de 1 (área) nem 4 de 3 (cobertura) | medium | Pré-verificado → patch: fixture com centésimo e quarta casa não nulos |
| 22 | verification-gap | Escape e ArrowUp sem teste | low | Pré-verificado → patch: estender o teste de teclado |
| 23 | verification-gap (other) | `ErroApi.status` documentado e não usado | low | Agrupado ao #1 |
| 24 | verification-gap (other) | `erro` do Autocomplete guarda mensagem que nunca mostra | low | Agrupado ao #1 |
| 25 | verification-gap (other) | Regex `CD_MUN` do controller é defesa em profundidade, não contrato | note | Correto; nada a fazer |

## Design Notes

Escape de curinga: `t.replace(/[\\%_]/g, (c) => '\\' + c)` e `LIKE ? ESCAPE '\'`.

Debounce sem biblioteca: `useEffect` com `setTimeout` de 300 ms limpo no cleanup; ignorar respostas fora de ordem guardando o último termo pedido em um `ref`.

## Verification

**Commands:**
- `cd api && npm test && npm run test:e2e` -- expected: verdes.
- `cd web && npm test && npm run build` -- expected: verdes.
- `docker compose build && docker compose up -d --wait && curl -sf 'localhost:8080/api/municipios?q=sao' | grep -q 'São Paulo' && curl -sf localhost:8080/api/municipios/3550308 | grep -q '"densidade":7528.26'; docker compose down -v` -- expected: os dois greps passam.
