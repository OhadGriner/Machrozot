import type { CellPosition, WordLine } from '../store/gameStore'

interface Props {
  cols: number
  selectedCells: CellPosition[]
  foundWordLines: WordLine[]
}

// Matches Cell.tsx's fixed w-10/h-10 (40px) and the gap-2 (8px) used between
// both rows and columns in Grid.tsx. Cells never resize responsively, so a
// cell's pixel center is fully determined by its row/col — no DOM
// measurement needed, which means no possible staleness if the page layout
// shifts for unrelated reasons (viewport resize, address-bar collapse, etc).
const CELL_SIZE = 40
const GAP = 8

function cellCenter(cell: CellPosition, cols: number): { x: number; y: number } {
  // The whole app is dir="rtl" (index.html), so a plain flex row lays its
  // children out right-to-left — column 0 renders on the right, not the
  // left. The x-axis has to mirror against the column count to match.
  return {
    x: (cols - 1 - cell.col) * (CELL_SIZE + GAP) + CELL_SIZE / 2,
    y: cell.row * (CELL_SIZE + GAP) + CELL_SIZE / 2,
  }
}

function toPoints(cells: CellPosition[], cols: number) {
  return cells.map((c) => cellCenter(c, cols))
}

const LINE_COLOR: Record<WordLine['state'], string> = {
  found: '#4ade80',
  megaMachrozet: '#c084fc',
  hint: '#fb923c',
}

export default function SelectionLine({ cols, selectedCells, foundWordLines }: Props) {
  const selectionPoints = toPoints(selectedCells, cols)
  const polylineProps = {
    fill: 'none',
    strokeWidth: 10,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: -1 }}>
      {foundWordLines.map((line, i) => {
        const pts = toPoints(line.cells, cols)
        if (pts.length < 2) return null
        return (
          <polyline
            key={i}
            points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
            stroke={LINE_COLOR[line.state]}
            opacity="0.7"
            {...polylineProps}
          />
        )
      })}
      {selectionPoints.length >= 2 && (
        <polyline
          points={selectionPoints.map((p) => `${p.x},${p.y}`).join(' ')}
          stroke="#eedccd"
          opacity="0.8"
          {...polylineProps}
        />
      )}
    </svg>
  )
}
