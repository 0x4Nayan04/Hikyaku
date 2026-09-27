/** Demo seed is local and CI only. Production creates the first admin at /bootstrap. */
export function assertSeedAllowed(nodeEnv: 'development' | 'production' | 'test'): void {
  if (nodeEnv === 'production') {
    throw new Error(
      'Refusing to seed in production. Create the first admin at /bootstrap.',
    )
  }
}
