export const SEND_EVENT_ACTION = { to: '/events/send', requiresWrite: true } as const

export function isWorkspaceActionAvailable(
  action: { requiresWrite?: boolean },
  readOnly: boolean,
): boolean {
  return !action.requiresWrite || !readOnly
}
