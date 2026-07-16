import { describe, expect, it } from 'vitest'
import { buildShareText } from '../src/utils/shareUtils'
import type { SolveStep } from '../src/store/gameStore'

const RLM = '‏'

describe('buildShareText', () => {
  it('renders theme and wraps squares 3 per row in solve order', () => {
    const solveOrder: SolveStep[] = [
      { type: 'word', hinted: false },
      { type: 'megaMachrozet', hinted: false },
      { type: 'word', hinted: false },
      { type: 'word', hinted: true },
    ]

    const text = buildShareText('בדיקה', solveOrder)

    expect(text).toBe(
      [
        'הצלחת כבר את האתגר היומי ב-מחרוזות?',
        '"בדיקה"',
        `${RLM}🟢🟣🟢`,
        `${RLM}💡`,
      ].join('\n')
    )
  })

  it('marks a hinted mega machrozet with the lightbulb, not purple', () => {
    const solveOrder: SolveStep[] = [{ type: 'megaMachrozet', hinted: true }]
    const text = buildShareText('בדיקה', solveOrder)
    expect(text.endsWith('💡')).toBe(true)
  })
})
