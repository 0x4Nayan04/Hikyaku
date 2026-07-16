'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

function CatalogTabs({
  className,
  ...props
}: React.ComponentProps<typeof Tabs>) {
  return <Tabs className={cn('catalog-tabs', className)} {...props} />
}

function CatalogTabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsList>) {
  return (
    <TabsList
      className={cn(
        'catalog-tabs-list',
        className,
      )}
      {...props}
    />
  )
}

function CatalogTabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsTrigger>) {
  return (
    <TabsTrigger
      className={cn(
        'catalog-tabs-trigger catalog-focus',
        className,
      )}
      {...props}
    />
  )
}

function CatalogTabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsContent>) {
  return <TabsContent className={cn('catalog-tabs-content w-full pt-5', className)} {...props} />
}

export { CatalogTabs, CatalogTabsList, CatalogTabsTrigger, CatalogTabsContent }
