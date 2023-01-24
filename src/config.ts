import { WalletType } from "@akord/crypto"
import { Api } from "./api/api"

export interface ClientConfig {
  env?: EnvType,
  network?: NetworkType,
  wallet?: WalletType,
  debug?: boolean,
  cache?: boolean,
  api?: Api
}

export enum EnvType {
  PROD = "prod",
  V2 = "v2",
  TESTNET = "testnet",
  DEV = "dev"
}

export enum NetworkType {
  LOCAL = "local",
  TESTNET = "testnet",
  MAINNET = "mainnet"
}