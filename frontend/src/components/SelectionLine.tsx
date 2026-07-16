import { useEffect, useState } from 'react'
import type { CellPosition, WordLine } from '../store/gameStore'

interface Props {
  selectedCells: CellPosition[]
  foundWordLines: WordLine[]
  containerRef: React.RefObject<HTMLDivElement | null>
}

function cellCenter(cell: CellPosition, containerRect: DOMRect): { x: number; y: number } | null {
  const el = document.querySelector(`[data-row="${cell.row}"][data-col="${cell.col}"]`)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  return {
    x: rect.left + rect.width / 2 - containerRect.left,
    y: rect.top + rect.height / 2 - containerRect.top,
  }
}

function toPoints(cells: CellPosition[], containerRect: DOMRect) {
  return cells
    .map((c) => cellCenter(c, containerRect))
    .filter(Boolean) as { x: number; y: number }[]
}

const LINE_COLOR: Record<WordLine['state'], string> = {
  found: '#4ade80',
  megaMachrozet: '#c084fc',
  hint: '#fb923c',
}

export default function SelectionLine({ selectedCells, foundWordLines, containerRef }: Props) {
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const update = () => setContainerRect(containerRef.current!.getBoundingClientRect())
    update()

    const observer = new ResizeObserver(update)
    observer.observe(containerRef.current)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [containerRef])

  if (!containerRect) return null

  const selectionPoints = toPoints(selectedCells, containerRect)
  const polylineProps = {
    fill: 'none',
    strokeWidth: 10,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: -1 }}>
      {foundWordLines.map((line, i) => {
        const pts = toPoints(line.cells, containerRect)
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
