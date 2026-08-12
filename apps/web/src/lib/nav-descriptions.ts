const STORAGE_KEY = 'hikyaku.nav.descs.seen'

/** Show nav subtitles until the operator has visited the console once. */
export function shouldShowNavDescriptions(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '1'
  } catch {
    return true
  }
}

export function markNavDescriptionsSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // Ignore quota / private-mode failures.
  }
}
