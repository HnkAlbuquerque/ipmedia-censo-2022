import { describe, expect, it } from 'vitest';
import { formatarDecimal, formatarInteiro, formatarPercentual } from './formatar';

describe('formatar (pt-BR)', () => {
  it('inteiro com ponto de milhar', () => {
    expect(formatarInteiro(11451999)).toBe('11.451.999');
    expect(formatarInteiro(27301)).toBe('27.301');
    expect(formatarInteiro(0)).toBe('0');
  });

  it('decimal sempre com 2 casas e vírgula', () => {
    expect(formatarDecimal(1521.2)).toBe('1.521,20');
    expect(formatarDecimal(7528.26)).toBe('7.528,26');
    expect(formatarDecimal(5)).toBe('5,00');
  });

  it('decimal com número de casas configurável', () => {
    expect(formatarDecimal(99.04, 1)).toBe('99,0');
  });

  it('percentual a partir de fração, 1 casa', () => {
    expect(formatarPercentual(0.999)).toBe('99,9%');
    expect(formatarPercentual(1)).toBe('100,0%');
    expect(formatarPercentual(0)).toBe('0,0%');
  });
});
