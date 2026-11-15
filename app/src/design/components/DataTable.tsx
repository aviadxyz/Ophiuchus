import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '../cn'
import { toneFill } from '../toneClasses'
import { PHONE_QUERY, useMediaQuery } from '../useMediaQuery'
import type { Tone } from '../vocabulary'
import { StatusPill } from './StatusPill'

export type DataTableRow = {
  id: string
  barTone: Tone
  /** One cell per column, in the same order. The first cell is the row name. */
  cells: ReactNode[]
  pill?: { tone: Tone; label: string }
  onOpen?: () => void
}

export type DataTableProps = {
  /** Column headings. The first column is the row name. */
  columns: string[]
  rows: DataTableRow[]
  /** Shown when there are no rows. */
  emptyText?: string
}

/** Rows on PC, stacked cards under 640 px. */
export function DataTable({ columns, rows, emptyText = 'Nothing to show yet.' }: DataTableProps) {
  const phone = useMediaQuery(PHONE_QUERY)
  const hasPill = rows.some((row) => row.pill)
  const opens = rows.some((row) => row.onOpen)

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface px-card py-6 text-center text-base text-text-secondary">
        {emptyText}
      </div>
    )
  }

  if (phone) {
    return (
      <ul className="m-0 flex list-none flex-col gap-2 p-0" data-layout="cards">
        {rows.map((row) => (
          <li
            key={row.id}
            className="relative overflow-hidden rounded-lg border border-border bg-surface"
          >
            <span
              aria-hidden="true"
              className={cn('absolute inset-y-0 left-0 w-[3px]', toneFill[row.barTone])}
            />
            <CardBody row={row} columns={columns} />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface" data-layout="rows">
      <table className="w-full table-fixed border-collapse text-left">
        <thead>
          <tr className="border-b border-border">
            {columns.map((column, index) => (
              <th
                key={column}
                scope="col"
                className={cn(
                  'px-4 py-3 font-mono text-label font-medium uppercase tracking-wider text-text-muted',
                  index === 0 && 'pl-5',
                )}
              >
                {column}
              </th>
            ))}
            {hasPill && (
              <th
                scope="col"
                className="w-36 px-4 py-3 font-mono text-label font-medium uppercase tracking-wider text-text-muted"
              >
                Status
              </th>
            )}
            {opens && (
              <th scope="col" className="w-12 px-2 py-3">
                <span className="sr-only">Open</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={row.onOpen}
              className={cn(
                'border-b border-border last:border-b-0',
                row.onOpen &&
                  'cursor-pointer transition-colors duration-150 hover:bg-surface-raised',
              )}
            >
              {row.cells.map((cell, index) =>
                index === 0 ? (
                  <th
                    key={index}
                    scope="row"
                    className="relative py-3 pr-4 pl-5 text-base font-semibold break-words text-text"
                  >
                    <span
                      aria-hidden="true"
                      className={cn('absolute inset-y-0 left-0 w-[3px]', toneFill[row.barTone])}
                    />
                    {cell}
                  </th>
                ) : (
                  <td key={index} className="px-4 py-3 text-base break-words text-text-secondary">
                    {cell}
                  </td>
                ),
              )}
              {hasPill && <td className="px-4 py-3">{row.pill && <StatusPill {...row.pill} />}</td>}
              {opens && (
                <td className="px-2 py-3 text-right">
                  {row.onOpen && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        row.onOpen?.()
                      }}
                      className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-text-muted hover:text-text"
                      aria-label="Open details"
                    >
                      <ChevronRight aria-hidden="true" className="size-4" />
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CardBody({ row, columns }: { row: DataTableRow; columns: string[] }) {
  const [name, ...rest] = row.cells
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-base font-semibold break-words text-text">{name}</span>
        {row.pill && <StatusPill {...row.pill} />}
      </div>
      {rest.length > 0 && (
        <dl className="m-0 mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {rest.map((cell, index) => (
            <div key={index} className="contents">
              <dt className="font-mono text-label uppercase tracking-wider text-text-muted">
                {columns[index + 1]}
              </dt>
              <dd className="m-0 min-w-0 text-sm break-words text-text-secondary">{cell}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  )
  if (!row.onOpen) return <div className="py-3 pr-4 pl-5">{content}</div>
  return (
    <button
      type="button"
      onClick={row.onOpen}
      className="relative block w-full cursor-pointer py-3 pr-10 pl-5 text-left transition-colors duration-150 hover:bg-surface-raised"
    >
      {content}
      <ChevronRight
        aria-hidden="true"
        className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-text-muted"
      />
      <span className="sr-only">Open details</span>
    </button>
  )
}
