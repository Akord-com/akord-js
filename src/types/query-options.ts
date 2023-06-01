export type ListOptions = {
  shouldDecrypt?: boolean,
  filter?: Object,
  limit?: number, // the limit of the number of items in a query (default to 100)
  nextToken?: string,
  parentId?: string,
  tags?: {
    values: string[],
    searchCriteria?: SearchCriteria // default to CONTAINS_EVERY
  }
}

export type SearchCriteria = "CONTAINS_SOME" | "CONTAINS_EVERY";

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