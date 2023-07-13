import { Stack } from "./node"

export interface BatchStackCreateResponse {
  data: Array<{ stackId: string, transactionId: string, object: Stack }>
  errors: Array<{ name: string, message: string, error: Error }>
  cancelled: number
}

export interface BatchMembershipInviteResponse {
  data: Array<{ membershipId: string, transactionId: string }>
  errors: Array<{ email: string, message: string, error: Error }>
}
