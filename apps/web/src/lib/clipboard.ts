import { toast } from '@/lib/toast'

export async function copyToClipboard(value: string, label: string) {
  await navigator.clipboard.writeText(value)
  toast.success(`${label} copied`)
}
