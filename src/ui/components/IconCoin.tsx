// IconCoin — emoji rendered inside the CSS "coin" (04 §1.2). Styles in tokens.css.

export function IconCoin({ emoji, small = false }: { emoji: string; small?: boolean }) {
  return (
    <span className={small ? 'icon-coin icon-coin--sm' : 'icon-coin'} aria-hidden="true">
      {emoji}
    </span>
  );
}
