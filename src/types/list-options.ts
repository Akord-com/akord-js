export type ListOptions = {
  shouldDecrypt: boolean,
  shouldListAll: boolean,
  limit?: number,
  nextToken?: string
}

export const defaultListOptions = {
  shouldDecrypt: true,
  shouldListAll: false
} as ListOptions;
