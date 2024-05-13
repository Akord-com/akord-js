export type ListPaginatedApiOptions = {
  limit?: number, // the limit of the number of items in a query (default to 100)
  nextToken?: string,
}


export type ListApiOptions = ListPaginatedApiOptions & {
  filter?: Object
}

export type ListOptions = ListApiOptions & {
  shouldDecrypt?: boolean,
  parentId?: string,
  tags?: {
    values: string[],
    searchCriteria?: SearchCriteria // default to CONTAINS_EVERY
  }
}

export type ListFileOptions = ListApiOptions & {
  sourceId?: string
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