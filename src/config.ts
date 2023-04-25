import { Api } from "./api/api"

export interface ClientConfig {
  env?: "dev" | "v2"
  debug?: boolean,
  cache?: boolean,
  api?: Api,
  storage?: Storage
  authToken?: string
  apiKey?: string
}