export type ListOptions = {
  shouldDecrypt: boolean,
  filter: Object,
  limit?: number, // the limit of the number of items in a query (default to 100)
  nextToken?: string
  parentId?: string
}

export type GetOptions = {
  shouldDecrypt: boolean,
  vaultId?: string
}

export type VaultGetOptions = GetOptions & {
  withNodes?: boolean
  withMemberships?: boolean
  withMemos?: boolean
  withStacks?: boolean
  withFolders?: boolean
}