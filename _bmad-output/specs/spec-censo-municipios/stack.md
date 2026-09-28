# Stack e estrutura

Companheiro de `SPEC.md`. Define o COMO que a spec deixa em aberto. Lido por `bmad-build` antes de qualquer story.

## Escolhas

| Camada | Escolha | Motivo |
|---|---|---|
| Back-end | NestJS 10+, TypeScript, `better-sqlite3` | Estrutura de módulos/controllers/services reconhecível por time Laravel; driver síncrono simplifica código com SQLite |
| Front-end | React 18+, Vite, TypeScript | Listado na vaga; autocomplete simples de fazer sem biblioteca |
| Testes back | Jest + Supertest (padrão do Nest) | Unit da normalização, integração do bootstrap, e2e dos endpoints |
| Testes front | Vitest + Testing Library | Componentes das duas telas com API mockada |
| Containers | Docker Compose, 2 serviços, multi-stage | `api` (Nest) e `web` (nginx servindo o build do React com proxy `/api` para `api`) |
| CI | GitHub Actions | Um workflow: testes back, testes front, `docker compose build` |
| Node | 20 LTS | Versão instalada localmente e nas imagens |

## Estrutura de pastas

```
/
  censo.sqlite                 dado entregue, nunca alterado
  docker-compose.yml
  api/                         NestJS
    src/
      db/                      conexão, bootstrap (cópia + índices + mun_agg + nm_mun_busca)
      municipios/              controller + service: autocomplete, agregado
      ufs/                     controller + service: lista, ranking paginado, agregado
      common/                  normalização de texto, mapa cd_uf -> sigla
    test/                      e2e com Supertest
  web/                         React + Vite
    src/
      pages/BuscaMunicipio.tsx
      pages/BuscaUf.tsx
      api/                     cliente HTTP tipado
  .github/workflows/ci.yml
  _bmad/, _bmad-output/        framework e artefatos, versionados
```

## Contrato da API

Prefixo `/api`. JSON. Erros 400 para parâmetros inválidos, 404 para município/UF inexistente.

| Método e rota | Parâmetros | Resposta |
|---|---|---|
| `GET /api/municipios?q=` | `q` mínimo 2 chars | `[{ cdMun, nome, uf: { cdUf, sigla, nome } }]` até 10 itens, ordem alfabética |
| `GET /api/municipios/:cdMun` | | `{ cdMun, nome, uf, populacao, areaKm2, densidade, setores: { total, urbanos, rurais, naoInformados }, sexo: { homens, mulheres, comDado, cobertura } }` |
| `GET /api/ufs` | | `[{ cdUf, sigla, nome }]` 27 itens |
| `GET /api/ufs/:cdUf` | | `{ cdUf, sigla, nome, populacao, areaKm2, densidade, totalMunicipios }` |
| `GET /api/ufs/:cdUf/municipios?page=&pageSize=` | `page` default 1, `pageSize` default 50 máx 100 | `{ total, page, pageSize, itens: [{ posicao, cdMun, nome, populacao, areaKm2, densidade }] }` |

`densidade` = populacao / areaKm2, em hab/km², arredondada a 2 casas no servidor. `cobertura` = comDado / populacao, entre 0 e 1.

## Bootstrap do banco (executa a cada subida do `api`)

1. Copiar `censo.sqlite` para `DB_WORK_PATH` (default `/data/censo.work.sqlite`) se não existir ou se for mais antigo que a origem.
2. `CREATE INDEX IF NOT EXISTS` em `setor(cd_mun)` e `municipio(cd_uf)`.
3. Adicionar coluna `municipio.nm_mun_busca` e preencher com `normalizar(nm_mun)`.
4. `CREATE TABLE IF NOT EXISTS mun_agg` conforme `regras-de-dados.md`, preenchida com um `INSERT ... SELECT`.
5. Idempotente: rodar duas vezes não duplica nada.

Tempo esperado: abaixo de 1 s.

## Convenções

- Conventional Commits. Um branch e um PR por story. Merge com merge commit, nunca squash.
- `normalizar(texto)`: NFD, remove diacríticos, minúsculas, colapsa espaços, trim. Única implementação, em `api/src/common/`, usada no bootstrap e na busca. Teste unitário obrigatório.
- Siglas de UF: mapa estático `cd_uf -> sigla` com as 27 entradas do IBGE em `api/src/common/`.
- Front consome só `/api`; sem lógica de agregação no cliente.
