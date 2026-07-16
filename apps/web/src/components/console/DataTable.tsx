import type { ReactNode } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

type DataTableProps = {
  children: ReactNode
  className?: string
}

export function DataTable({ children, className }: DataTableProps) {
  return <Table className={className}>{children}</Table>
}

export function DataTableHeader({ children, className }: DataTableProps) {
  return <TableHeader className={cn('bg-muted/20', className)}>{children}</TableHeader>
}

export function DataTableBody({ children, className }: DataTableProps) {
  return <TableBody className={className}>{children}</TableBody>
}

export function DataTableRow({
  children,
  className,
  ...props
}: DataTableProps & React.ComponentProps<'tr'>) {
  return (
    <TableRow
      className={cn('transition-colors duration-150 hover:bg-muted/20', className)}
      {...props}
    >
      {children}
    </TableRow>
  )
}

type DataTableHeadProps = {
  children: ReactNode
  className?: string
}

export function DataTableHead({ children, className, ...props }: DataTableHeadProps & React.ComponentProps<'th'>) {
  return (
    <TableHead
      scope="col"
      className={cn(
        'h-auto px-5 py-2 font-mono text-xs font-semibold text-muted-strong',
        className,
      )}
      {...props}
    >
      {children}
    </TableHead>
  )
}

type DataTableCellProps = {
  children: ReactNode
  className?: string
}

export function DataTableCell({ children, className, ...props }: DataTableCellProps & React.ComponentProps<'td'>) {
  return (
    <TableCell className={cn('border-t border-border/60 px-5 py-3 whitespace-normal text-sm', className)} {...props}>
      {children}
    </TableCell>
  )
}
