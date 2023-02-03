import { AxiosResponse } from "axios"

export type Paginated<T> = {
  items: Array<T>
  nextToken: string
}

export const isPaginated = (response: AxiosResponse) => {
  return response.headers[PAGINATION_HEADER] !== undefined
}

export const PAGINATION_HEADER = 'next-token'
