import type { SolveStep } from '../store/gameStore'

const ROW_WIDTH = 3

function squareFor(step: SolveStep): string {
  if (step.hinted) return '💡'
  return step.type === 'megaMachrozet' ? '🟣' : '🟢'
}

export function buildShareText(theme: string, solveOrder: SolveStep[]): string {
  const squares = solveOrder.map(squareFor)
  const rows: string[] = []
  for (let i = 0; i < squares.length; i += ROW_WIDTH) {
    // Prefix with a right-to-left mark so the first-solved square (first in
    // the string) renders on the right, matching Hebrew reading order —
    // otherwise these neutral emoji default to left-to-right.
    rows.push('‏' + squares.slice(i, i + ROW_WIDTH).join(''))
  }

  return [
    'הצלחת כבר את האתגר היומי ב-מחרוזות?',
    `"${theme}"`,
    ...rows,
    'https://machrozot.vercel.app/',
  ].join('\n')
}

