import { toast } from '@/lib/toast'

export async function copyToClipboard(value: string, label: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied`)
    return true
  } catch {
    toast.error(`Couldn't copy ${label.toLowerCase()}. Copy it manually instead.`)
    return false
  }
}
