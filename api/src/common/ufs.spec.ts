import { UFS, siglaDaUf } from './ufs';

describe('UFS', () => {
  it('tem as 27 unidades da federação', () => {
    expect(Object.keys(UFS)).toHaveLength(27);
  });

  it('não repete sigla', () => {
    const siglas = Object.values(UFS).map((uf) => uf.sigla);
    expect(new Set(siglas).size).toBe(27);
  });

  it('usa códigos de dois dígitos e siglas de duas letras maiúsculas', () => {
    for (const [cdUf, uf] of Object.entries(UFS)) {
      expect(cdUf).toMatch(/^\d{2}$/);
      expect(uf.sigla).toMatch(/^[A-Z]{2}$/);
      expect(uf.nome.length).toBeGreaterThan(0);
    }
  });
});

describe('siglaDaUf', () => {
  it("devolve 'SP' para o código 35", () => {
    expect(siglaDaUf('35')).toBe('SP');
  });

  it("devolve 'RS' para o código 43 e 'DF' para 53", () => {
    expect(siglaDaUf('43')).toBe('RS');
    expect(siglaDaUf('53')).toBe('DF');
  });

  it('devolve undefined para código desconhecido', () => {
    expect(siglaDaUf('99')).toBeUndefined();
    expect(siglaDaUf('')).toBeUndefined();
  });
});
