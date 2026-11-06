export function parseStatusQuery<T extends string>(
  value: string | null,
  options: readonly T[],
  defaultStatus: T,
): T {
  return options.find((status) => status === value) ?? defaultStatus
}

export function updateStatusQuery<T extends string>(
  params: URLSearchParams,
  status: T,
  defaultStatus: T,
): URLSearchParams {
  const next = new URLSearchParams(params)
  if (status === defaultStatus) next.delete('status')
  else next.set('status', status)
  return next
}
