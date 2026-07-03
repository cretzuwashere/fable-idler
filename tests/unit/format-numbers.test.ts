import { describe, expect, it } from 'vitest';
import { formatNumber, formatRate } from '../../src/engine';

describe('formatNumber', () => {
  it('shows integers below 1000', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(1)).toBe('1');
    expect(formatNumber(847)).toBe('847');
    expect(formatNumber(847.9)).toBe('847'); // floor, never round up balances
    expect(formatNumber(999)).toBe('999');
  });

  it('switches to K exactly at 1000', () => {
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1000)).toBe('1K');
    expect(formatNumber(1234)).toBe('1.23K');
  });

  it('keeps 3 significant digits with suffixes', () => {
    expect(formatNumber(12_345)).toBe('12.3K');
    expect(formatNumber(123_456)).toBe('123K');
    expect(formatNumber(45_600_000)).toBe('45.6M');
    expect(formatNumber(7_890_000_000)).toBe('7.89B');
  });

  it('covers the whole suffix ladder', () => {
    expect(formatNumber(1e6)).toBe('1M');
    expect(formatNumber(1e9)).toBe('1B');
    expect(formatNumber(1e12)).toBe('1T');
    expect(formatNumber(1e15)).toBe('1Qa');
    expect(formatNumber(1e18)).toBe('1Qi');
    expect(formatNumber(1e21)).toBe('1Sx');
    expect(formatNumber(1e24)).toBe('1Sp');
    expect(formatNumber(1e27)).toBe('1Oc');
    expect(formatNumber(1e30)).toBe('1No');
  });

  it('switches to scientific notation at 1e33', () => {
    expect(formatNumber(1e33)).toBe('1e33');
    expect(formatNumber(1.23e35)).toBe('1.23e35');
    expect(formatNumber(9.99e32)).toBe('999No');
  });

  it('handles suffix boundary rounding without printing 1000K', () => {
    expect(formatNumber(999_999)).toBe('1M');
  });

  it('handles negatives and NaN defensively', () => {
    expect(formatNumber(-1234)).toBe('-1.23K');
    expect(formatNumber(Number.NaN)).toBe('0');
  });
});

describe('formatRate', () => {
  it('shows one decimal below 100/sec', () => {
    expect(formatRate(0.1)).toBe('0.1');
    expect(formatRate(12.5)).toBe('12.5');
    expect(formatRate(0)).toBe('0.0');
    expect(formatRate(99.99)).toBe('99.9');
  });

  it('falls back to formatNumber at 100+', () => {
    expect(formatRate(150)).toBe('150');
    expect(formatRate(1500)).toBe('1.5K');
  });
});
