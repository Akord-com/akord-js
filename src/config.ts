import { Api } from "./api/api"

export interface ClientConfig {
  env?: EnvType,
  network?: NetworkType,
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