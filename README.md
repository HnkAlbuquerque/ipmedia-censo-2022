# Censo 2022 por município e UF

Consulta ao Censo Demográfico 2022 do IBGE em duas telas: busca de município com autocomplete e ranking de municípios por densidade dentro de cada estado. Teste técnico para a ipmedia (enunciado em `docs/enunciado.md`). Autor: Henrique Albuquerque.

## Como rodar

Só precisa de Docker com Compose v2 (`docker compose`) e a porta 8080 livre.

```sh
git clone https://github.com/HnkAlbuquerque/ipmedia-censo-2022.git
cd ipmedia-censo-2022
docker compose up --build
```

Depois abra `http://localhost:8080`. Não há passo manual: o `censo.sqlite` já está na raiz e a API prepara os dados derivados sozinha ao subir, numa cópia que vive só dentro do container e é recriada a cada subida. O serviço `web` só inicia depois que o healthcheck da API responde, então a primeira requisição do navegador já funciona. Só a porta 8080 é publicada; a API fica atrás do nginx. Para parar, `docker compose down`.

## As duas telas

**Busca de município** (`/municipio`). Digite parte do nome. Depois de 300 ms sem digitar, aparecem até 10 sugestões no formato "Nome - UF". Ao escolher uma, a tela mostra população, área, densidade, setores censitários (urbanos, rurais e não informados) e população por sexo, com a cobertura desse dado.

Roteiro: digite `sao`. São Paulo - SP aparece em primeiro. Selecione e veja 11.451.999 habitantes, 27.301 setores e 1.521,20 km². Digite `bom jesus` para ver os cinco homônimos, cada um com sua UF.

**Busca por estado** (`/estado`). Escolha um estado no select. No topo ficam população, área, densidade e quantidade de municípios do estado inteiro. Abaixo, os municípios ordenados do mais denso ao menos denso, em páginas de 50.

Roteiro: escolha São Paulo. São 645 municípios em 13 páginas, com Taboão da Serra em primeiro (13.416,96 hab/km²). Escolha Roraima: 15 municípios em uma página só.

## API

Prefixo `/api`, respostas em JSON. Parâmetro de query inválido (`q`, `page`, `pageSize`) devolve 400; código de município ou UF fora do formato ou inexistente devolve 404. `areaKm2` e `densidade` vêm com 2 casas.

A documentação navegável (Swagger), gerada a partir do próprio código, fica em `http://localhost:8080/api/docs`, e o contrato OpenAPI 3 em JSON em `http://localhost:8080/api/docs-json`; a tabela abaixo é o resumo.

| Método e rota | Parâmetros | Resposta |
|---|---|---|
| `GET /api/municipios?q=` | `q` obrigatório, de 2 a 100 caracteres (mínimo contado após normalizar: sem acento, espaços colapsados); `q` repetido devolve 400 | `[{ cdMun, nome, uf: { cdUf, sigla, nome } }]`, até 10 itens. Prefixo de palavra, sem acento e sem caixa. Ordem: nome exato primeiro, depois população |
| `GET /api/municipios/:cdMun` | `cdMun` com 7 dígitos | `{ cdMun, nome, uf, populacao, areaKm2, densidade, setores: { total, urbanos, rurais, naoInformados }, sexo: { homens, mulheres, comDado, cobertura } }` |
| `GET /api/ufs` | | `[{ cdUf, sigla, nome }]`, 27 itens em ordem alfabética |
| `GET /api/ufs/:cdUf` | `cdUf` com 2 dígitos | `{ cdUf, sigla, nome, populacao, areaKm2, densidade, totalMunicipios }` |
| `GET /api/ufs/:cdUf/municipios?page=&pageSize=` | `page` padrão 1, máximo 100000; `pageSize` padrão 50, máximo 100; página além do fim devolve 200 com `itens: []` | `{ total, page, pageSize, itens: [{ posicao, cdMun, nome, populacao, areaKm2, densidade }] }` |

`densidade` é população dividida pela área crua, em hab/km², arredondada a 2 casas só no fim; recalcular a partir do `areaKm2` já arredondado pode divergir na segunda casa (São Paulo capital: 11451999 / 1521,2 dá 7528,27, a API devolve 7528,26). `cobertura` é `comDado / populacao`, entre 0 e 1, com 4 casas. `posicao` é calculada no servidor: `(page - 1) * pageSize + índice + 1`. Há ainda `GET /api/health`, usado pelo Docker Compose, que devolve `municipios: 5571` (linhas de `mun_agg`, incluindo a linha `'.'` de R1) como prova de que o bootstrap terminou.

Exemplos de conferência:

```sh
curl 'localhost:8080/api/municipios?q=sao'
curl localhost:8080/api/municipios/3550308
curl 'localhost:8080/api/ufs/35/municipios?page=2'
```

## Decisões técnicas e por quê

O arquivo vem cru e com armadilhas. Cada regra abaixo nasceu de uma delas. Os números foram medidos no `censo.sqlite` com `sqlite3` antes de escrever código.

### R1. O município sem nome (5.571 contra 5.570)

`municipio` tem 5.571 linhas, mas o IBGE tem 5.570 municípios. A linha extra é `cd_mun = '.'`: nome vazio, UF 43 (RS), 2 setores, população 0 e 13.085,9 km² de área. São as lagoas dos Patos e Mirim, território sem município. Decidi tirar essa linha das listas (autocomplete e ranking) e manter nas somas (agregado da UF e do país). É a única combinação que bate com as duas referências do enunciado ao mesmo tempo:

| Cenário | Municípios | Área do Brasil |
|---|---|---|
| Manter em tudo | 5.571 | 8.510.417 km² |
| Excluir de tudo | 5.570 | 8.497.331 km² |
| Excluir das listas, manter nas somas | 5.570 | 8.510.417 km² |

Efeito visível: a área do RS (281.707,15 km²) inclui 13.086 km² de lagoas que não aparecem em nenhum dos 497 municípios do ranking.

### R2. População vem de `setor`, sexo vem de `demografia`

`sum(setor.populacao)` dá 203.080.756, o valor oficial. `sum(demografia.moradores)` dá 202.561.627, porque 9.327 setores não têm linha em `demografia` e outras 8,7 mil linhas existem com valores nulos. Decidi que a população total vem de `setor` e a divisão por sexo vem de `demografia`, sem estimar nada para os setores sem dado. A API devolve `comDado` e `cobertura`, e a tela escreve "Dado por sexo disponível para X% da população". No país a cobertura é 99,7%; em São Paulo capital, 99,9%.

### R3. Setores em três categorias

`situacao` tem 354.965 setores urbanos, 112.031 rurais e 1.103 nulos. Decidi mostrar três categorias (urbanos, rurais, não informados) em vez de duas. Assim a soma fecha com o total de setores mostrado no mesmo cartão e eu não invento uma classificação que o IBGE não fez.

### R4. Busca por prefixo de palavra, sem acento, com ordem por população

232 nomes existem em mais de uma UF (Bom Jesus está em cinco). O `LIKE` do SQLite ignora caixa só em ASCII, então `sao` não acha `São`. Decidi criar no bootstrap a coluna `nm_mun_busca` com o nome normalizado (sem acento, minúsculo) e normalizar o termo digitado com a mesma função `normalizar()`, única na API; o front repete só a parte de contar o mínimo de 2 caracteres. O casamento é por prefixo de palavra: início do nome ou depois de espaço, hífen ou apóstrofo (71 nomes têm hífen ou apóstrofo; `mirim` acha Guajará-Mirim). A ordem é nome exato primeiro, depois população decrescente. Toda sugestão carrega a UF. Por que essa ordem e não alfabética, medido no arquivo com a regra de prefixo de palavra:

| `q` | Casos | Alfabético mostra nos 10 primeiros | Nome exato + população mostra |
|---|---|---|---|
| `sao` | 364 | São Benedito, São Bentinho... sem São Paulo | São Paulo, São Luís, São Gonçalo... |
| `rio` | 104 | Rio Acima, Rio Azul... sem Rio de Janeiro | Rio de Janeiro, Rio Branco, Rio Verde... |
| `bom jesus` | 23 | os 5 exatos misturados com compostos | os 5 exatos primeiro, depois Bom Jesus da Lapa |
| `paulo` | 14 | prefixo simples acharia só os 7 que começam com Paulo (Paulo Afonso, Paulo Ramos...) | São Paulo, Paulo Afonso, São Paulo de Olivença... |

### R5. Cópia do banco e tabela agregada no startup

O `censo.sqlite` versionado nunca é alterado. A cada subida a API copia o arquivo para `DB_WORK_PATH`, e é na cópia que nascem os três índices, a coluna `nm_mun_busca` e a tabela `mun_agg` (uma linha por município com setores por categoria, população, área, homens, mulheres e moradores com dado). Medido no ranking de SP: 72 ms no arquivo cru, 23 ms com índice, 0,9 ms com `mun_agg`. O bootstrap leva menos de 1 segundo. O ganho de tempo não é o motivo principal: o motivo é concentrar R1, R2 e R3 em um único SQL testável e não gerar um diff de 35 para 48 MB no arquivo entregue. O bootstrap roda de forma síncrona antes de a API abrir a porta, então o healthcheck só passa com os dados prontos.

### R6. Ranking sempre paginado

São Paulo tem 645 municípios e Roraima 15. Decidi que o ranking é sempre paginado no servidor: `pageSize` padrão 50 e máximo 100, ordem por densidade decrescente com desempate por `cd_mun`, posição calculada na API. A ordem estável garante que a mesma linha nunca aparece em duas páginas. Com `mun_agg` a consulta sai em 1 ms; o motivo da paginação é o comportamento da tela e da API com listas longas, não a performance.

### R7. Precisão numérica

`area_km2` tem 7 casas decimais no arquivo. Somar 27 mil setores em ordens diferentes desloca a 12ª casa; medido em São Paulo capital: 1521,2015838999994 contra 1521,2015839 exato. Decidi arredondar área e densidade a 2 casas no servidor, com a densidade calculada sobre a área crua antes do arredondamento, e manter população inteira, sem arredondar. Os testes e2e comparam valor exato (`1521.2`, `7528.26`), porque já passou pelo arredondamento. O teste de integração compara a soma crua de área com 8.510.417,25 km² com tolerância de 0,01, e não 0,5: 0,5 esconderia um setor de 0,4 km² faltando.

### Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Back | NestJS 10, TypeScript, `better-sqlite3` | Estrutura de módulos, controllers e services que um time vindo de Laravel reconhece. Driver síncrono simplifica o código com SQLite |
| Front | React 18, Vite, TypeScript, `react-router-dom` | Autocomplete e paginação são simples de fazer sem biblioteca de componentes |
| Containers | Docker Compose com dois serviços, multi-stage | `api` (Nest) e `web` (nginx servindo o build do React com proxy de `/api` para `api:3000`). Só a porta 8080 é publicada |
| Imagem base da `api` | `node:20-bookworm-slim` nos dois estágios (o `web` final é `nginx:1.27-alpine`, sem módulo nativo) | `better-sqlite3` é módulo nativo com binário pré-compilado para glibc. Em Alpine (musl) o `npm ci` tenta compilar com `node-gyp` e falha |
| Versão do driver | `better-sqlite3` fixado em 12.9.0 | 12.10+ não publica binário para Node 20. Sem o pin, o `npm ci` na imagem slim falhava |
| Prontidão | healthcheck em `/api/health`; `web` com `depends_on: condition: service_healthy` | Sem isso o nginx sobe antes do bootstrap e a primeira requisição devolve 502 |
| Documentação da API | `@nestjs/swagger` 8.x | Gera o OpenAPI 3 a partir do código. A 8.x é a última que aceita NestJS 10; a 11 exige Nest 11 |
| CI | GitHub Actions | Testes do back, testes e build do front, `docker compose up` com smoke test via nginx do health, das duas telas, do autocomplete, do detalhe, do agregado, do ranking e da documentação |

## Testes

Back (`api/`):

- `npm test` roda os unitários (`normalizar()`, mapa de UFs, healthcheck, services com um banco pequeno em memória) e o teste de integração do bootstrap, que roda contra o `censo.sqlite` real e confere os valores de referência: 5.571 linhas em `mun_agg`, 5.570 sem `'.'`, 203.080.756 habitantes, 8.510.417,25 km², São Paulo capital, idempotência e o arquivo de origem intacto.
- `npm run test:e2e` sobe a aplicação com Supertest, um arquivo por módulo (`health`, `municipios`, `ufs`) e um para a documentação (`docs`), cada um com uma instância da app e `DB_WORK_PATH` temporário. Cobre os cinco endpoints com os casos de `regras-de-dados.md`: `sao`, `paulo`, `rio`, `bom jesus`, SP com 645 e Taboão da Serra, RR com 15, RS com 497 e as lagoas na área, soma das 27 UFs, validação de `q`, `page` e `pageSize`. O `docs` confere o contrato publicado: as seis rotas, os limites dos parâmetros, os esquemas e as respostas de erro.

Front (`web/`):

- `npm test` roda o Vitest com Testing Library e `fetch` mockado: navegação, autocomplete (debounce, teclado, erros, resposta atrasada descartada), cartões, select de UF, paginação, estados de carregamento e erro, formatação pt-BR.

CI: `.github/workflows/ci.yml` roda os três blocos em cada PR e no `master`: `api`, `web` e `docker`, que faz `docker compose up --wait` e confere pelo nginx um valor de referência do health, das duas telas, do autocomplete, do detalhe de município, do agregado da UF e do ranking paginado, além da documentação da API.

## Desenvolvimento

Docker é a forma de entrega. Para desenvolver sem ele, com Node 20.19 ou superior, em dois terminais a partir da raiz:

```sh
# terminal 1
cd api && npm ci && npm run start:dev     # API em http://localhost:3000

# terminal 2
cd web && npm ci && npm run dev           # front em http://localhost:5173
```

O `vite.config.ts` faz proxy de `/api` para `http://localhost:3000`, mesmo papel do nginx no compose. O front só conhece caminhos relativos.

A API lê três variáveis de ambiente. `PORT` é a porta, padrão 3000, que o proxy do Vite e o nginx assumem. `DB_SOURCE_PATH` é o arquivo entregue, só leitura; padrão `../censo.sqlite` a partir de `api/`. `DB_WORK_PATH` é a cópia de trabalho, sobrescrita a cada subida; padrão `api/.data/censo.work.sqlite`, pasta ignorada pelo git. Na imagem Docker os valores são `/app/censo.sqlite` e `/data/censo.work.sqlite`, e o processo roda como usuário `node`.

## Processo com BMAD

Usei o BMAD-METHOD v6.12 com Claude Code. A ordem foi:

1. `bmad-spec`: sondei o dado com `sqlite3`, registrei cada armadilha e decisão em `_bmad-output/specs/spec-censo-municipios/.memlog.md` e derivei dele a spec na mesma pasta (`SPEC.md` com capacidades e não-objetivos, `regras-de-dados.md` com R1 a R7 e valores de referência, `stack.md`).
2. Party mode: uma rodada com os agentes de análise, produto, UX, arquitetura e dev sobre a spec. Saíram oito ajustes, entre eles a ordem do autocomplete por nome exato e população, R7 e o healthcheck. Ata em `_bmad-output/party-mode/memories/installed/.memlog.md`.
3. `bmad-spec` de novo para quebrar em cinco stories (`stories.yaml`), cada uma com código e testes juntos.
4. `bmad-project-context` gerou o `AGENTS.md` com políticas e armadilhas para os agentes.
5. `bmad-build` por story: gera a spec da story (`stories/*.md`, com intent congelado, matriz de casos e critérios), implementa, roda uma revisão adversarial com revisores independentes e registra a triagem de cada achado na própria story (corrigido, rejeitado com motivo ou adiado para `_bmad-output/implementation-artifacts/deferred-work.md`).
6. Um branch e um PR por story, merge com merge commit, CI verde antes de mergear.

O `.memlog.md` da pasta da spec é o diário de decisões do BMAD: cada linha é uma restrição, uma nota do dado, uma decisão ou um evento de validação, na ordem em que aconteceu. A spec é derivada dele, não o contrário.

## O que faria com mais tempo

- Playwright de ponta a ponta contra o compose. Hoje o contrato entre API e front é verificado por uma cópia manual de tipos em cada lado e pelos greps do CI; um rename de campo passaria com as duas suítes verdes.
- Gerar os tipos do front a partir do OpenAPI (`/api/docs-json`), pelo mesmo motivo: hoje `web/src/api/tipos.ts` é uma cópia manual das classes de resposta da API.
- Filtro por nome dentro do ranking da UF, para achar um município específico entre os 645 de SP.
- Botão "tentar de novo" quando a lista de UFs falha ao carregar. Hoje só há a mensagem de erro.
- Cache HTTP nas respostas da API. O dado é estático, então `Cache-Control` e `ETag` resolvem sem invalidação.
- Deploy: imagem publicada no ECR e serviço no ECS, com o workflow do Actions fazendo o push após o merge no `master`.
