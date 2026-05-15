export type Role = 'owner' | 'editor'

export const ROLES = {
  owner: 'owner',
  editor: 'editor'
} as const satisfies Record<Role, Role>
