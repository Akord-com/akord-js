export type ListOptions = {
  shouldDecrypt: boolean,
  filter: Object,
  limit?: number, // the limit of the number of items in a query (default to 100)
  nextToken?: string
}
