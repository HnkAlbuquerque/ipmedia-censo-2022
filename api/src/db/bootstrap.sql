-- Dados derivados criados na cópia de trabalho do censo.sqlite a cada subida
-- da API. Lido e executado por DbService.bootstrap() depois de a coluna
-- municipio.nm_mun_busca existir e estar preenchida (isso é feito em JS,
-- porque o SQLite não remove acentos).
--
-- Idempotente: índices com IF NOT EXISTS; mun_agg é derrubada e recriada
-- dentro de uma transação, então rodar duas vezes nunca duplica linha.

CREATE INDEX IF NOT EXISTS idx_setor_mun ON setor(cd_mun);
CREATE INDEX IF NOT EXISTS idx_mun_uf ON municipio(cd_uf);
CREATE INDEX IF NOT EXISTS idx_mun_busca ON municipio(nm_mun_busca);

BEGIN;

DROP TABLE IF EXISTS mun_agg;

-- Uma linha por município, incluindo cd_mun = '.' (setores das lagoas do RS,
-- R1): o filtro é das consultas de lista, nunca do bootstrap.
CREATE TABLE mun_agg (
  cd_mun                 TEXT PRIMARY KEY,
  setores_total          INTEGER NOT NULL,
  setores_urbanos        INTEGER NOT NULL,
  setores_rurais         INTEGER NOT NULL,
  setores_nao_informados INTEGER NOT NULL,
  populacao              INTEGER NOT NULL,
  area_km2               REAL    NOT NULL,
  homens                 INTEGER NOT NULL,
  mulheres               INTEGER NOT NULL,
  moradores              INTEGER NOT NULL
) WITHOUT ROWID;

-- R2: população vem de setor; homens, mulheres e moradores vêm de demografia
-- via LEFT JOIN, porque 9.327 setores não têm linha lá e nada é estimado.
-- Além desses, ~8,7 mil linhas de demografia têm moradores NULL (e aí homens
-- e mulheres também NULL): sum() as ignora, então `moradores` conta só os
-- setores com dado, que é o que a cobertura de sexo precisa.
-- R3: urbanos + rurais + não informados = total, sempre.
-- R7: área somada crua, sem arredondar; quem responde arredonda.
INSERT INTO mun_agg (
  cd_mun, setores_total, setores_urbanos, setores_rurais, setores_nao_informados,
  populacao, area_km2, homens, mulheres, moradores
)
SELECT
  m.cd_mun,
  count(s.cd_setor),
  count(CASE WHEN s.situacao = 'Urbana' THEN 1 END),
  count(CASE WHEN s.situacao = 'Rural' THEN 1 END),
  count(CASE WHEN s.cd_setor IS NOT NULL AND s.situacao IS NULL THEN 1 END),
  coalesce(sum(s.populacao), 0),
  coalesce(sum(s.area_km2), 0),
  coalesce(sum(d.homens), 0),
  coalesce(sum(d.mulheres), 0),
  coalesce(sum(d.moradores), 0)
FROM municipio m
LEFT JOIN setor s ON s.cd_mun = m.cd_mun
LEFT JOIN demografia d ON d.cd_setor = s.cd_setor
GROUP BY m.cd_mun;

COMMIT;
