'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

function CatalogDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent
      className={cn(
        'app-panel gap-4 border-border bg-surface p-[clamp(1.25rem,4vw,var(--space-s2))] shadow-none ring-0',
        className,
      )}
      {...props}
    />
  )
}

function CatalogDialogFooter({
  className,
  ...props
}: React.ComponentProps<typeof DialogFooter>) {
  return (
    <DialogFooter
      className={cn(
        '-mx-[clamp(1.25rem,4vw,var(--space-s2))] -mb-[clamp(1.25rem,4vw,var(--space-s2))] mt-2',
        className,
      )}
      {...props}
    />
  )
}

export {
  Dialog as CatalogDialog,
  CatalogDialogContent,
  DialogHeader as CatalogDialogHeader,
  CatalogDialogFooter,
  DialogTitle as CatalogDialogTitle,
  DialogDescription as CatalogDialogDescription,
}
