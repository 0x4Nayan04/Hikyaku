export function parseStatusQueryParam<T extends string>(
  value: string | null,
  options: readonly T[],
  fallback: T,
): T {
  return options.find((option) => option === value) ?? fallback
}

/** Omits `status` when it equals the page default so the URL stays clean. */
export function writeStatusQueryParam(
  params: URLSearchParams,
  value: string,
  omitWhen: string,
): void {
  if (value === omitWhen) params.delete('status')
  else params.set('status', value)
}
