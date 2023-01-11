export type ListOptions = {
  shouldDecrypt: boolean,
  shouldListAll: boolean
}

export const defaultListOptions = {
  shouldDecrypt: true,
  shouldListAll: false
} as ListOptions;
