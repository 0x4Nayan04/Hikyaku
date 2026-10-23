/** Read a same-list return location from React Router navigation state. */
export function getListReturnTo(state: unknown, listPath: '/events' | '/deliveries'): string {
  if (!state || typeof state !== 'object' || !('listReturnTo' in state)) return listPath
  const value = (state as { listReturnTo?: unknown }).listReturnTo
  if (
    typeof value !== 'string' ||
    !(value === listPath || value.startsWith(`${listPath}?`) || value.startsWith(`${listPath}#`))
  )
    return listPath
  if (
    value.startsWith('//') ||
    value.includes('\\') ||
    [...value].some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) ||
    /%(?![\da-f]{2})/i.test(value)
  )
    return listPath

  try {
    const parsed = new URL(value, 'https://hikyaku.invalid')
    if (parsed.origin !== 'https://hikyaku.invalid' || parsed.pathname !== listPath) return listPath
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return listPath
  }
}

export function isPlainPrimaryClick(
  event: Pick<MouseEvent, 'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>,
): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}
