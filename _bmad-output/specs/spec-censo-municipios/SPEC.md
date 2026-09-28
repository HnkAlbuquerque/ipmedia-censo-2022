---
id: SPEC-censo-municipios
companions:
  - stack.md
  - regras-de-dados.md
sources:
  - ../../../docs/enunciado.md
---

> **Contrato canônico.** Este SPEC e os arquivos em `companions:` são o contrato completo do que construir, testar e validar. A fonte em `sources:` é para rastreabilidade.

# Consulta ao Censo 2022 por município e UF

## Why

Teste técnico para vaga full stack na ipmedia. O enunciado entrega o `censo.sqlite` cru, sem índices, com armadilhas deliberadas no dado (um município a mais que o oficial, duas tabelas de população com totais diferentes, setores sem classificação, nomes repetidos entre estados) e pede duas telas simples, entregues completas, subindo com um comando em Docker. A avaliação olha três coisas: as telas funcionando, o histórico de commits mostrando o raciocínio, e a condução do framework de spec-driven development. A vaga pede exatamente esse fluxo: do PRD à story, da story ao PR, do PR ao deploy.

## Capabilities

- **CAP-1**
  - **intent:** Usuário digita parte do nome de um município e recebe sugestões com a UF, para escolher o município certo mesmo entre homônimos.
  - **success:** `q=sao` retorna São Paulo (SP) em primeiro; `q=paulo` retorna São Paulo em primeiro; `q=rio` retorna Rio de Janeiro em primeiro; `q=bom jesus` retorna os 5 "Bom Jesus" exatos, com 5 UFs distintas, antes de Bom Jesus da Lapa; nenhuma sugestão sem nome; máximo 10 itens.

- **CAP-2**
  - **intent:** Usuário seleciona um município e vê população total, quantidade de setores, área, densidade, divisão urbano/rural/não informado e distribuição por sexo com a cobertura do dado.
  - **success:** São Paulo capital mostra 11.451.999 habitantes, 27.301 setores (27.037 + 254 + 10), 1.521,2 km², e sexo com cobertura de 99,9%. A soma das três categorias de setor é igual ao total em qualquer município.

- **CAP-3**
  - **intent:** Usuário escolhe uma UF e vê seus municípios ranqueados por densidade, do mais denso para o menos denso, em páginas.
  - **success:** SP devolve `total = 645`, primeira página com 50 itens começando por Taboão da Serra, segunda página começa na posição 51; RR devolve 15 itens em uma página; a mesma linha nunca aparece em duas páginas.

- **CAP-4**
  - **intent:** Na mesma tela, usuário vê população total, área total e densidade da UF inteira.
  - **success:** A soma das 27 UFs dá 203.080.756 habitantes e 8.510.417 km²; RS mostra 281.707,2 km², incluindo os setores sem município.

- **CAP-5**
  - **intent:** Avaliador clona o repositório em uma máquina com só Docker e sobe tudo com um comando.
  - **success:** `docker compose up` deixa as duas telas funcionando no navegador sem nenhum passo manual; o bootstrap dos dados derivados roda sozinho; a primeira requisição do navegador já responde, sem 502 enquanto a API sobe.

- **CAP-6**
  - **intent:** Testes automatizados cobrem back e front.
  - **success:** Back: unit da normalização de texto, integração do bootstrap conferindo os valores de referência de `regras-de-dados.md`, e2e dos cinco endpoints. Front: as duas telas com API mockada. Tudo verde com um comando por lado.

- **CAP-7**
  - **intent:** Cada PR roda testes e build em CI.
  - **success:** Workflow do GitHub Actions verde em cada PR, rodando os testes dos dois lados e `docker compose build`.

- **CAP-8**
  - **intent:** README permite instalar, executar e entender as decisões.
  - **success:** README tem instalação, execução, cada decisão técnica com o porquê (R1 a R6 e stack) e a seção "o que faria com mais tempo".

## Constraints

- Stack fixada pelo enunciado: back Node.js com TypeScript, front em framework JS, SQLite, Docker. Escolhas concretas em `stack.md`.
- `censo.sqlite` fica versionado na raiz e nunca é alterado: todo dado derivado nasce em uma cópia no startup (R5).
- Duas telas separadas, uma por fluxo: busca de município e busca por UF. Avaliadores testam cada uma isoladamente.
- Registro `cd_mun = '.'` sai das listas e fica nas somas (R1). Não há terceira opção.
- População total vem de `setor`; sexo vem de `demografia` com cobertura explícita. Nunca estimar (R2).
- Setores sempre em três categorias que somam o total (R3).
- Busca por prefixo de palavra, sem acento e sem caixa, via coluna normalizada e uma única função de normalização; ordem: nome exato primeiro, depois população (R4).
- Ranking sempre paginado, `pageSize` máximo 100, ordem estável (R6).
- Área e densidade arredondadas a duas casas no servidor; população inteira e exata (R7).
- A API só é exposta depois do bootstrap: healthcheck na `api` e o `web` espera `service_healthy`. Imagem base glibc por causa do `better-sqlite3` (`stack.md`).
- Docker é a única forma de entrega e é testado ao fim de cada story. O proxy do Vite existe só para desenvolvimento.
- Commits pequenos e frequentes com Conventional Commits. Sem squash. Artefatos do BMAD versionados.
- Entrega: um único repositório público (ou com acesso concedido), `censo.sqlite` na raiz, histórico preservado.

## Non-goals

- Autenticação, usuários, permissões.
- Mapa ou geolocalização.
- Filtro de nome dentro do ranking da UF.
- Busca por substring no meio de uma palavra ("aulo" não acha São Paulo).
- Deploy em nuvem. Termina no CI.
- Cache distribuído ou banco externo.
- Internacionalização.
- Gráficos além de barras simples para urbano/rural e sexo.
- Outros censos além de 2022.

## Success signal

Em uma máquina limpa, `docker compose up`, digitar "sao", ver São Paulo (SP) no topo, selecionar e ver 11.451.999 habitantes; abrir a segunda tela, escolher São Paulo e ver 645 municípios em páginas de 50 com Taboão da Serra no topo. O histórico de commits conta a história, e o README responde cada "por quê".

## Assumptions

- Um branch e um PR por story no GitHub, com `bmad-code-review` antes do merge, para espelhar o fluxo story para PR da vaga.
- CI em GitHub Actions é a materialização de "do PR ao deploy"; o deploy real fica descrito no README como próximo passo.
- A tabela `uf` não tem sigla; o back carrega um mapa estático `cd_uf` para sigla com as 27 entradas do IBGE.

## Open Questions

- O agregado da UF (CAP-4) vem no mesmo payload do ranking ou em endpoint próprio? `stack.md` propõe endpoint próprio (`GET /api/ufs/:cdUf`) e a story 4 assume isso; confirmar no checkpoint da story 4.
