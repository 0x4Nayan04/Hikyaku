import type { ApiKey, ApiKeyWithSecret, Endpoint } from '@/api/types'
import { listEndpointSecrets } from '@/lib/endpoint-vault'
import { readCachedApiKeys } from '@/lib/settings-cache'

export type VaultEntry = {
  endpointId: string
  secret: string
  url: string | null
}

export type ApiKeysState = {
  apiKeys: ApiKey[]
  loading: boolean
  error: string | null
}

export type ApiKeysAction =
  | { type: 'load_success'; apiKeys: ApiKey[] }
  | { type: 'load_error'; error: string }
  | { type: 'load_complete' }

const cachedApiKeys = readCachedApiKeys()

export const initialApiKeysState: ApiKeysState = {
  apiKeys: cachedApiKeys,
  loading: cachedApiKeys.length === 0,
  error: null,
}

export function apiKeysReducer(state: ApiKeysState, action: ApiKeysAction): ApiKeysState {
  switch (action.type) {
    case 'load_success':
      return { apiKeys: action.apiKeys, loading: false, error: null }
    case 'load_error':
      return { ...state, loading: false, error: action.error }
    case 'load_complete':
      return { ...state, loading: false }
  }
}

export type VaultState = {
  entries: VaultEntry[]
  endpoints: Endpoint[]
  loading: boolean
}

export type VaultAction =
  | { type: 'refresh_success'; entries: VaultEntry[]; endpoints: Endpoint[] }
  | { type: 'refresh_fallback'; entries: VaultEntry[] }
  | { type: 'refresh_complete' }
  | { type: 'remove_entry'; endpointId: string }

function readInitialVaultEntries(): VaultState['entries'] {
  return Object.entries(listEndpointSecrets()).map(([endpointId, secret]) => ({
    endpointId,
    secret,
    url: null,
  }))
}

const initialVaultEntries = readInitialVaultEntries()

export const initialVaultState: VaultState = {
  entries: initialVaultEntries,
  endpoints: [],
  loading: initialVaultEntries.length === 0,
}

export function vaultReducer(state: VaultState, action: VaultAction): VaultState {
  switch (action.type) {
    case 'refresh_success':
      return { entries: action.entries, endpoints: action.endpoints, loading: false }
    case 'refresh_fallback':
      return { ...state, entries: action.entries, loading: false }
    case 'refresh_complete':
      return { ...state, loading: false }
    case 'remove_entry':
      return {
        ...state,
        entries: state.entries.filter((entry) => entry.endpointId !== action.endpointId),
      }
  }
}

export type DialogState = {
  creatingKey: boolean
  revokingId: string | null
  rotatingId: string | null
  secretKey: ApiKeyWithSecret | null
  revokeTarget: ApiKey | null
}

export type DialogAction =
  | { type: 'create_start' }
  | { type: 'create_end' }
  | { type: 'create_success'; secretKey: ApiKeyWithSecret }
  | { type: 'revoke_start'; id: string }
  | { type: 'revoke_end' }
  | { type: 'revoke_success' }
  | { type: 'rotate_start'; id: string }
  | { type: 'rotate_end' }
  | { type: 'rotate_success'; secretKey: ApiKeyWithSecret }
  | { type: 'set_secret_key'; secretKey: ApiKeyWithSecret | null }
  | { type: 'set_revoke_target'; target: ApiKey | null }

export const initialDialogState: DialogState = {
  creatingKey: false,
  revokingId: null,
  rotatingId: null,
  secretKey: null,
  revokeTarget: null,
}

export function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case 'create_start':
      return { ...state, creatingKey: true }
    case 'create_end':
      return { ...state, creatingKey: false }
    case 'create_success':
      return { ...state, creatingKey: false, secretKey: action.secretKey }
    case 'revoke_start':
      return { ...state, revokingId: action.id }
    case 'revoke_end':
      return { ...state, revokingId: null }
    case 'revoke_success':
      return { ...state, revokingId: null, revokeTarget: null }
    case 'rotate_start':
      return { ...state, rotatingId: action.id }
    case 'rotate_end':
      return { ...state, rotatingId: null }
    case 'rotate_success':
      return { ...state, rotatingId: null, secretKey: action.secretKey }
    case 'set_secret_key':
      return { ...state, secretKey: action.secretKey }
    case 'set_revoke_target':
      return { ...state, revokeTarget: action.target }
  }
}
