import { useState, type FormEvent } from 'react'
import type { AdminCreateInviteInput } from '@hikyaku/shared/zod'
import { ApiError, createAdminInvite } from '@/api/client'
import { toast } from '@/lib/toast'

type Options = {
  onOpenChange: (open: boolean) => void
  onInvited: (result: { inviteUrl: string; expiresAt: string }) => void
  reset: () => void
}

export function useInviteSubmit({ onOpenChange, onInvited, reset }: Options) {
  const [submitting, setSubmitting] = useState(false)
  function changeOpen(open: boolean) {
    if (submitting) return
    if (!open) reset()
    onOpenChange(open)
  }
  async function submit(event: FormEvent<HTMLFormElement>, body: AdminCreateInviteInput) {
    event.preventDefault()
    setSubmitting(true)
    try {
      const result = await createAdminInvite(body)
      reset()
      onOpenChange(false)
      onInvited({ inviteUrl: result.invite_url, expiresAt: result.expires_at })
      toast.success('Invite created')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create invite')
    } finally {
      setSubmitting(false)
    }
  }
  return { submitting, changeOpen, submit }
}
