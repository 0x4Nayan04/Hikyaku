'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function CatalogSelectTrigger({
  className,
  size = 'md',
  ...props
}: React.ComponentProps<typeof SelectTrigger>) {
  return (
    <SelectTrigger
      size={size}
      className={cn(
        'catalog-focus w-full min-w-[9rem] text-[15px]',
        className,
      )}
      {...props}
    />
  )
}

function CatalogSelectItem({
  className,
  ...props
}: React.ComponentProps<typeof SelectItem>) {
  return (
    <SelectItem
      className={cn('py-1.5 pl-2.5 pr-7', className)}
      {...props}
    />
  )
}

export {
  Select as CatalogSelect,
  SelectContent as CatalogSelectContent,
  CatalogSelectItem,
  CatalogSelectTrigger,
  SelectValue as CatalogSelectValue,
}
