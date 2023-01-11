export interface BatchStackCreateResponse {
  data: Array<{ stackId: string, transactionId: string }>
  errors: Array<{ name: string, message: string }>
  cancelled: number
}
