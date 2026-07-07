import { useMemo, useState } from "react"
import type { PointerEvent, ReactNode } from "react"
import { Search, SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type DataTableColumn<T> = {
  id: string
  header: string
  cell: (row: T) => ReactNode
  accessor?: (row: T) => string
  className?: string
  enableHiding?: boolean
  enableResizing?: boolean
  size?: number
  minSize?: number
  maxSize?: number
}

type DataTableProps<T> = {
  columns: Array<DataTableColumn<T>>
  data: T[]
  getRowId: (row: T) => string
  emptyText: string
  searchPlaceholder?: string
  onRowClick?: (row: T) => void
  getRowClassName?: (row: T) => string | undefined
}

export function DataTable<T>({
  columns,
  data,
  getRowId,
  emptyText,
  searchPlaceholder = "Ara...",
  onRowClick,
  getRowClassName,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("")
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([])
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [resizing, setResizing] = useState<{
    columnId: string
    pointerId: number
    startX: number
    startWidth: number
  } | null>(null)

  const visibleColumns = columns.filter((column) => !hiddenColumns.includes(column.id))
  const filterableColumns = columns.filter((column) => column.accessor)
  const totalColumnWidth = visibleColumns.reduce((total, column) => total + getColumnWidth(column), 0)
  const query = search.trim().toLocaleLowerCase("tr-TR")
  const filteredData = useMemo(() => {
    if (!query) {
      return data
    }

    return data.filter((row) =>
      filterableColumns.some((column) =>
        column.accessor?.(row).toLocaleLowerCase("tr-TR").includes(query),
      ),
    )
  }, [data, filterableColumns, query])

  function toggleColumn(columnId: string, isVisible: boolean) {
    setHiddenColumns((current) => {
      if (isVisible) {
        return current.filter((id) => id !== columnId)
      }

      return [...current, columnId]
    })
  }

  function getColumnWidth(column: DataTableColumn<T>) {
    return columnWidths[column.id] ?? column.size ?? 180
  }

  function resizeColumn(column: DataTableColumn<T>, width: number) {
    const minSize = column.minSize ?? 96
    const maxSize = column.maxSize ?? 640

    setColumnWidths((current) => ({
      ...current,
      [column.id]: Math.min(Math.max(Math.round(width), minSize), maxSize),
    }))
  }

  function startResize(event: PointerEvent<HTMLButtonElement>, column: DataTableColumn<T>) {
    if (column.enableResizing === false) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setResizing({
      columnId: column.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: getColumnWidth(column),
    })
  }

  function moveResize(event: PointerEvent<HTMLButtonElement>, column: DataTableColumn<T>) {
    if (!resizing || resizing.columnId !== column.id || resizing.pointerId !== event.pointerId) {
      return
    }

    resizeColumn(column, resizing.startWidth + event.clientX - resizing.startX)
  }

  function stopResize(event: PointerEvent<HTMLButtonElement>) {
    if (!resizing || resizing.pointerId !== event.pointerId) {
      return
    }

    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Pointer capture may already be released by the browser.
    }

    setResizing(null)
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:max-w-sm sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline">
              <SlidersHorizontal />
              Kolonlar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Gösterilecek kolonlar</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columns.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={!hiddenColumns.includes(column.id)}
                disabled={column.enableHiding === false}
                onCheckedChange={(checked) => toggleColumn(column.id, checked === true)}
              >
                {column.header}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table className="table-fixed" style={{ minWidth: totalColumnWidth }}>
          <colgroup>
            {visibleColumns.map((column) => (
              <col key={column.id} style={{ width: getColumnWidth(column) }} />
            ))}
          </colgroup>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              {visibleColumns.map((column) => (
                <TableHead
                  key={column.id}
                  className={cn("relative pr-5", column.className)}
                  style={{ width: getColumnWidth(column) }}
                >
                  <span className="block truncate">{column.header}</span>
                  {column.enableResizing !== false && (
                    <button
                      type="button"
                      aria-label={`${column.header} kolon genişliğini değiştir`}
                      className="absolute top-0 right-0 h-full w-2 cursor-col-resize touch-none select-none rounded-sm transition-colors hover:bg-primary/30 active:bg-primary/40"
                      onPointerDown={(event) => startResize(event, column)}
                      onPointerMove={(event) => moveResize(event, column)}
                      onPointerUp={stopResize}
                      onPointerCancel={stopResize}
                    />
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.map((row) => (
              <TableRow
                key={getRowId(row)}
                className={cn(onRowClick && "cursor-pointer", getRowClassName?.(row))}
                onClick={() => onRowClick?.(row)}
              >
                {visibleColumns.map((column) => (
                  <TableCell
                    key={column.id}
                    className={cn("overflow-hidden text-muted-foreground", column.className)}
                    style={{ width: getColumnWidth(column) }}
                  >
                    <div className="min-w-0">{column.cell(row)}</div>
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {filteredData.length === 0 && (
              <TableRow>
                <TableCell colSpan={visibleColumns.length || 1} className="h-24 text-center text-muted-foreground">
                  {emptyText}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        {filteredData.length} / {data.length} kayıt gösteriliyor.
      </p>
    </div>
  )
}
