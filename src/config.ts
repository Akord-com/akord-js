import { Wallet } from "@akord/crypto"
import { Api } from "./api/api"
import { Plugin } from "./plugin"
import { Signer } from "./signer"

export interface ClientConfig {
  env?: 'dev' | 'v2'
  signer?: Signer,
  encrypter?: Wallet,
  debug?: boolean
  cache?: boolean
  api?: Api
  storage?: Storage
  plugins?: [Plugin]
  authToken?: string
  apiKey?: string
}