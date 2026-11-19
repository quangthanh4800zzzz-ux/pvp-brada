const KEY_LABELS: Record<string, string> = {
  Space: 'SPC',
  ShiftLeft: 'L-Shift',
  ShiftRight: 'R-Shift',
  ControlLeft: 'L-Ctrl',
  ControlRight: 'R-Ctrl',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
  BracketLeft: '[',
  BracketRight: ']',
  Minus: '-',
  Equal: '=',
  Backquote: '`',
  Enter: 'Enter',
  NumpadEnter: 'NP-Ent',
  NumpadAdd: 'NP+',
  NumpadSubtract: 'NP-',
  NumpadMultiply: 'NP*',
  NumpadDivide: 'NP/',
  NumpadDecimal: 'NP.',
  Backspace: 'Bksp',
  Tab: 'Tab',
  Escape: 'ESC',
  Insert: 'Ins',
  Delete: 'Del',
  Home: 'Home',
  End: 'End',
  PageUp: 'PgUp',
  PageDown: 'PgDn'
};

const ARROWS: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓'
};

export function keyLabel(code: string | undefined): string {
  if (!code) return '?';
  if (ARROWS[code]) return ARROWS[code]!;
  if (KEY_LABELS[code]) return KEY_LABELS[code]!;
  if (code.startsWith('Numpad')) return `NP${code.slice(6)}`;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}
