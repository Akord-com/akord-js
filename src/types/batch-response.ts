export interface BatchStackCreateResponse {
  data: Array<{ stackId: string, transactionId: string }>
  errors: Array<{ name: string, message: string }>
  cancelled: number
}

export interface BatchMembershipInviteResponse {
  data: Array<{ membershipId: string, transactionId: string }>
  errors: Array<{ email: string, message: string }>
}
