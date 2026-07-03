// format-numbers.ts — display formatting only, never used in game logic.
// < 1000            → integer ("847")
// 1000 … <1e33      → 3 significant digits + suffix K M B T Qa Qi Sx Sp Oc No
// >= 1e33           → scientific "1.23e35"
// formatRate: rates below 100/sec get 1 decimal ("0.1", "12.5").

const SUFFIXES = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No'] as const;

const SCIENTIFIC_THRESHOLD = 1e33;

function trimTrailingZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

function formatScientific(n: number): string {
  const [mantissa, exp] = n.toExponential(2).split('e');
  return `${trimTrailingZeros(mantissa)}e${String(parseInt(exp, 10))}`;
}

/** Main display formatter. */
export function formatNumber(n: number): string {
  if (Number.isNaN(n)) return '0';
  if (n < 0) return `-${formatNumber(-n)}`;
  if (!Number.isFinite(n)) return 'Infinity';
  if (n < 1000) return String(Math.floor(n));
  if (n >= SCIENTIFIC_THRESHOLD) return formatScientific(n);

  let value = n / 1000;
  let idx = 0;
  while (value >= 1000 && idx < SUFFIXES.length - 1) {
    value /= 1000;
    idx++;
  }
  // 3 significant digits.
  let text = value < 10 ? value.toFixed(2) : value < 100 ? value.toFixed(1) : value.toFixed(0);
  // Rounding may push e.g. 999.96 → "1000": bump to the next suffix.
  if (parseFloat(text) >= 1000) {
    if (idx + 1 < SUFFIXES.length) {
      idx++;
      text = (value / 1000).toFixed(2);
    } else {
      return formatScientific(n);
    }
  }
  return `${trimTrailingZeros(text)}${SUFFIXES[idx]}`;
}

/** Formatter for per-second rates: 1 decimal below 100 ("0.1", "12.5"). */
export function formatRate(n: number): string {
  if (Number.isNaN(n)) return '0.0';
  if (n < 0) return `-${formatRate(-n)}`;
  if (n < 100) return (Math.floor(n * 10) / 10).toFixed(1);
  return formatNumber(n);
}
