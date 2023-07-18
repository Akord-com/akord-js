import { Hooks } from "./file";
import { Stack } from "./stack"

export type BatchStackCreateOptions = Hooks & {
  processingCountHook?: (count: number) => void,
  onStackCreated?: (item: Stack) => Promise<void>
};

export interface BatchStackCreateResponse {
  data: Array<{ stackId: string, transactionId: string, object: Stack }>
  errors: Array<{ name: string, message: string }>
  cancelled: number
}

export interface BatchMembershipInviteResponse {
  data: Array<{ membershipId: string, transactionId: string }>
  errors: Array<{ email: string, message: string }>
}