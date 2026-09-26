import type { ReactNode } from 'react'

type SettingsLayoutProps = {
  children: ReactNode
}

export function SettingsLayout({ children }: SettingsLayoutProps) {
  return <div className="flex w-full flex-col gap-5">{children}</div>
}
