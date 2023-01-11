import { WalletType } from "@akord/crypto"

export interface ClientConfig {
  env?: EnvType,
  network?: NetworkType,
  wallet?: WalletType,
  debug?: boolean,
  cache?: boolean,
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