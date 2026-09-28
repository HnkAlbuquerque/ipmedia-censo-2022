import { normalizar } from './normalizar';

describe('normalizar', () => {
  it('remove acentos e passa para minúsculas', () => {
    expect(normalizar('São Gonçalo')).toBe('sao goncalo');
  });

  it('colapsa espaços repetidos e apara as pontas', () => {
    expect(normalizar('  Bom   Jesus ')).toBe('bom jesus');
  });

  it('preserva o hífen', () => {
    expect(normalizar('Mogi-Guaçu')).toBe('mogi-guacu');
  });

  it('preserva o apóstrofo', () => {
    expect(normalizar("Alta Floresta D'Oeste")).toBe("alta floresta d'oeste");
  });

  it('devolve string vazia para texto vazio ou só espaços', () => {
    expect(normalizar('')).toBe('');
    expect(normalizar('   ')).toBe('');
  });

  it('é idempotente', () => {
    const uma = normalizar('Ribeirão Preto');
    expect(normalizar(uma)).toBe(uma);
  });
});
