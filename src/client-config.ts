import { WalletType } from "@akord/crypto"

export interface ClientConfig {
  env?: EnvType,
  network?: NetworkType,
  wallet?: WalletType,
  ledgerVersion?: LedgerVersion,
  debug?: boolean
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

export enum LedgerVersion {
  V1 = "v1",
  V2 = "v2"
}