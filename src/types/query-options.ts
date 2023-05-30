export type ListOptions = {
  shouldDecrypt?: boolean,
  filter?: Object,
  limit?: number, // the limit of the number of items in a query (default to 100)
  nextToken?: string,
  parentId?: string,
  tags?: string[]
}

export type GetOptions = {
  shouldDecrypt?: boolean,
  vaultId?: string
}

export type VaultGetOptions = GetOptions & {
  deep?: boolean
}

export type VaultApiGetOptions = {
  withNodes?: boolean,
  deep?: boolean, // withMemberships, withMemos, withStacks, withFolders
}