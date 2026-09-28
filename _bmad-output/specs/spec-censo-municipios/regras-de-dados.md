# Regras de dados

Companheiro de `SPEC.md`. Cada regra vem de uma armadilha do `censo.sqlite` e de uma frase do enunciado. Os valores numéricos são os de referência para testes.

## Fatos do arquivo

| Tabela | Linhas | Observação |
|---|---|---|
| `uf` | 27 | Sem coluna de sigla, só `cd_uf` e `nm_uf` |
| `municipio` | 5.571 | IBGE oficial: 5.570. Ver R1 |
| `setor` | 468.099 | Só PK. Sem índice em `cd_mun` |
| `demografia` | 458.772 | 9.327 setores sem linha. Ver R2 |

## R1. Registro `cd_mun = '.'` (setores órfãos, lagoas do RS)

Município sem nome, `cd_uf = 43`, 2 setores, população 0, área 13.085,9 km². Lagoas dos Patos e Mirim: território sem município.

| Cenário | Municípios | Área do Brasil |
|---|---|---|
| Manter em tudo | 5.571 | 8.510.417 km² |
| Excluir de tudo | 5.570 | 8.497.331 km² |
| **Excluir das listas, manter nas somas** | **5.570** | **8.510.417 km²** |

Regra: `cd_mun <> '.'` no autocomplete e no ranking. Sem filtro nos agregados da UF e do país. No RS, a soma das áreas dos 497 municípios listados é 13.086 km² menor que a área do estado (281.707,2 km²). O README explica isso.

## R2. População: total de `setor`, sexo de `demografia`

| Fonte | Total |
|---|---|
| `sum(setor.populacao)` | 203.080.756 (bate com IBGE) |
| `sum(demografia.moradores)` | 202.561.627 |
| `sum(homens) + sum(mulheres)` | 202.561.625 |

Regra: `populacao` vem de `setor`. `sexo.homens` e `sexo.mulheres` vêm de `demografia`. `sexo.comDado = sum(moradores)`. `sexo.cobertura = comDado / populacao`. A tela mostra a cobertura. Nunca estimar sexo para setores sem demografia.

## R3. Situação do setor: três categorias

| `situacao` | Setores |
|---|---|
| Urbana | 354.965 |
| Rural | 112.031 |
| NULL | 1.103 |

Regra: `setores.urbanos + setores.rurais + setores.naoInformados = setores.total`, sempre.

## R4. Busca por nome

232 nomes existem em mais de uma UF (Bom Jesus: PI, RN, PB, SC, RS). `LIKE` do SQLite ignora caixa só em ASCII.

Regra: coluna `nm_mun_busca = normalizar(nm_mun)`. Busca é `nm_mun_busca LIKE normalizar(q) || '%'`. Toda sugestão carrega a UF. Seleção usa `cd_mun`.

## R5. Tabela agregada `mun_agg`

Uma linha por `cd_mun`, incluindo `'.'`:

| Coluna | Origem |
|---|---|
| `cd_mun` | `municipio` |
| `setores_total` | `count(setor)` |
| `setores_urbanos` | `count(situacao = 'Urbana')` |
| `setores_rurais` | `count(situacao = 'Rural')` |
| `setores_nao_informados` | `count(situacao IS NULL)` |
| `populacao` | `sum(setor.populacao)` |
| `area_km2` | `sum(setor.area_km2)` |
| `homens`, `mulheres`, `moradores` | `sum` de `demografia` via `LEFT JOIN` |

Medição local: ranking de SP cai de 72 ms (cru) para 23 ms (índice) para 0,9 ms (`mun_agg`). Build abaixo de 200 ms. O ganho de tempo não é o motivo; o motivo é concentrar R1 a R3 num único lugar testável e nunca alterar o `censo.sqlite` versionado (índice direto nele: 35 para 48 MB).

## R6. Paginação do ranking

`page` default 1, `pageSize` default 50, máximo 100. Ordem: densidade decrescente, desempate por `cd_mun` crescente. `posicao` calculada no servidor: `(page - 1) * pageSize + índice + 1`.

## Valores de referência para testes

| Verificação | Esperado |
|---|---|
| `sum(mun_agg.populacao)` | 203.080.756 |
| `sum(mun_agg.area_km2)` | 8.510.417,25 (tolerância 0,5) |
| `count(mun_agg)` | 5.571 |
| `count(mun_agg where cd_mun <> '.')` | 5.570 |
| São Paulo capital (`3550308`) setores | 27.301 = 27.037 urbanos + 254 rurais + 10 não informados |
| São Paulo capital população | 11.451.999 |
| São Paulo capital área | 1.521,2 km² |
| São Paulo capital sexo | 5.380.188 homens, 6.060.887 mulheres, 11.441.079 com dado |
| Ranking SP (`cd_uf = 35`) total | 645, primeiro: Taboão da Serra, 13.417 hab/km² |
| Ranking RR (`cd_uf = 14`) total | 15 |
| RS (`cd_uf = 43`) municípios listados | 497 |
| RS área total | 281.707,2 km² |
| `normalizar('São Gonçalo')` | `sao goncalo` |
| Autocomplete `q=sao pa` | contém São Paulo (SP) |
| Autocomplete `q=bom jesus` | 5 itens, 5 UFs diferentes |
| Autocomplete nunca retorna | item com nome vazio |
