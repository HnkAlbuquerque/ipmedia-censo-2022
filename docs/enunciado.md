# Teste técnico - Desenvolvedor(a) Full Stack

## O desafio

Construa uma aplicação web que permita consultar dados do Censo Demográfico 2022 do IBGE por município. Você tem **2 horas e meia**.

O escopo abaixo foi calibrado para caber nesse tempo. E esperamos a entrega dessa funcionalidade simples de forma completa. Se sobrar tempo, você pode polir a aplicação, mas a ideia do teste é manter o mais simples possível.

## O que a aplicação deve fazer

A aplicação deve ter duas telas distintas, e é assim que vamos testar cada fluxo.

A primeira tela é a de busca de cidades. Ela tem um campo de busca com autocomplete que encontra municípios pelo nome. Ao selecionar um município, exibe abaixo as informações agregadas dele: população total, quantidade de setores, área total, densidade demográfica, a divisão entre setores urbanos e rurais, e a distribuição da população por sexo.

A segunda tela é a de busca por estado. Nela é possível escolher uma unidade federativa e ver os municípios dela ranqueados por densidade demográfica, do mais denso para o menos denso, junto com os números agregados do estado inteiro: população total, área total e densidade.

Além das duas telas, a entrega também precisa:

- Ter testes automatizados no front-end e no back-end (E2E e/ou testes unitários).
- **Subir com Docker**, em uma máquina limpa, com um único comando e sem nenhum passo manual.
- Ter um README com instruções de instalação e execução.

Como você chega nesses resultados é decisão sua. Fora a separação em duas telas, não temos preferência por estrutura de pastas, formato de resposta da API, modelagem ou estratégia de teste.

Ah, e uma dica: alguns estados do país possuem cidades com o mesmo nome, então você precisa identificar o UF no autocomplete. E os estados variam muito de tamanho, de São Paulo com 645 municípios a Roraima com 15, então pense em como a tela e a API se comportam com listas longas.

## Sobre o Docker

A aplicação inteira precisa subir com Docker, **num comando só**, numa máquina que só tenha Docker instalado. Um `docker compose up` que levante o back-end e o front-end é o caminho natural, mas a forma é sua.

O que vamos fazer na avaliação é clonar o repositório, rodar esse comando e usar a aplicação. Se for preciso instalar dependência na mão, rodar migration, ou seguir qualquer passo extra antes de a tela funcionar, o requisito não foi cumprido.

## Os dados

Você recebe junto com este enunciado o arquivo `censo.sqlite`, com os dados do Censo Demográfico 2022 do IBGE já carregados. Não é necessário baixar nada do IBGE.

Coloque o arquivo na raiz do projeto e desenvolva em cima dele. Ele deve ser versionado no repositório, para que quem clonar e subir os containers veja a aplicação respondendo com dado real.

> O arquivo **não tem senha nem criptografia**. É um SQLite comum: basta abrir com a biblioteca da sua linguagem, sem credencial, sem servidor e sem processo de banco para subir. Não existe segredo a gerenciar neste exercício.

São 35,2 MB e quatro tabelas:

```sql
CREATE TABLE uf(
  cd_uf TEXT PRIMARY KEY,
  nm_uf TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE municipio(
  cd_mun TEXT PRIMARY KEY,
  nm_mun TEXT NOT NULL,
  cd_uf  TEXT NOT NULL REFERENCES uf(cd_uf)
) WITHOUT ROWID;

CREATE TABLE setor(
  cd_setor  TEXT PRIMARY KEY,   -- setor censitario, 15 digitos
  cd_mun    TEXT NOT NULL REFERENCES municipio(cd_mun),
  situacao  TEXT,               -- 'Urbana', 'Rural' ou nulo
  area_km2  REAL,               -- area do setor em km2
  populacao INTEGER             -- populacao residente no setor
) WITHOUT ROWID;

CREATE TABLE demografia(
  cd_setor  TEXT PRIMARY KEY REFERENCES setor(cd_setor),
  moradores INTEGER,
  homens    INTEGER,
  mulheres  INTEGER
) WITHOUT ROWID;
```

| Tabela | Linhas |
| --- | --- |
| `uf` | 27 |
| `municipio` | 5.571 |
| `setor` | 468.099 |
| `demografia` | 458.772 |

O arquivo vem cru de propósito: fora as chaves primárias, não há índices, nem colunas derivadas, nem tabelas agregadas, nem views. O que existir além disso é decisão sua.

Vale a pena reservar alguns minutos para explorar o dado antes de começar a codar. Como referências externas de conferência: o Brasil tem 5.570 municípios, 27 unidades federativas, área de 8.510.417 km² e população de 203.080.756 habitantes segundo este censo.

## Stack

Front-end em qualquer framework JavaScript. Sugerimos Angular, React ou Vue. Você também pode usar alguma biblioteca de componentes ou helpers CSS, como tailwind, Bootstrap, ShadCN ou outras.

Back-end em Node.js com TypeScript, ou em PHP com o framework de sua preferência.

Banco de dados em SQLite, usando o arquivo que enviamos.

Containerização em Docker.

## Sobre o uso de IA

Usar IA é requisito nesse teste. Pedimos para que você escolha um framework de spec driven development, como o [GitHub Spec Kit](https://github.com/github/spec-kit), o [OpenSpec](https://github.com/Fission-AI/OpenSpec) ou o [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) (esse último é o que usamos com mais intensidade na empresa).

Sobre a ferramenta de IA ou modelos, a escolha é sua. Codex, Claude Code e Open Code são boas opções.

Commite as specs, stories ou documentos de planejamento que você produzir. Não avaliamos volume de documentação: uma spec curta que antecipa os problemas reais do exercício vale mais que um documento longo gerado por template.

Queremos ver como você conduz o framework, não só o resultado final.

Também sugerimos que você passe um tempo explorando o framework de SDD que você escolheu antes de iniciar o teste.

## Sobre os commits

Faça commits pequenos e frequentes, do começo ao fim do exercício. Três coisas que pedimos explicitamente:

- Não trabalhe as duas horas e meia e commite tudo de uma vez no fim.
- Não faça squash do histórico antes de entregar.
- Use o padrão [Conventional Commits](https://www.conventionalcommits.org) no prefixo de cada commit, por exemplo `feat:`, `fix:`, `docs:`, `refactor:`, `test:` ou `chore:`. A mensagem em si pode ser em português ou inglês, o que você preferir. Só pedimos o prefixo.

O histórico faz parte da entrega e é por ele que a gente acompanha seu raciocínio. Em que ordem você atacou o problema, o que descobriu no meio do caminho, onde voltou atrás. Um repositório com um commit só será tratado como requisito não cumprido.

## Como entregar

Um repositório único, público ou com acesso concedido para nós, contendo o `censo.sqlite` na raiz e o histórico de commits preservado.

## No README, responda também

- Quais decisões técnicas você tomou e por quê.
- O que você faria diferente com mais tempo.
