import { Api } from "./api/api"
import { Plugin } from "./plugin"

export interface ClientConfig {
  env?: 'dev' | 'v2'
  debug?: boolean
  logToFile?: boolean
  cache?: boolean
  api?: Api
  storage?: Storage
  plugins?: [Plugin]
  authToken?: string
  apiKey?: string
}