// see: https://arwiki.wiki/#/en/Universal-Data-License-How-to-use-it

// current release of the Universal Data License
export const UDL_LICENSE_TX_ID = "yRj4a5KMctX_uOmKWCFJIjmY8DeJcusVk6-HzLiM_t8";

export type UDL = {
  license?: string, // tx id of the UDL, default to yRj4a5KMctX_uOmKWCFJIjmY8DeJcusVk6-HzLiM_t8
  derivations?: Derivation[], // grants the rights of licensees to make derivative works
  commercialUses?: CommercialUse[], // grants the rights of licensees to use the content for commercial use
  licenseFee?: LicenseFee, // if not present, there is no fee for the license
  currency?: string, // if not present, the currency defaults to the $U token on the Arweave network
  expires?: number, // designated in years, if not present, the term of the license is unlimited
  paymentAddress?: string, // if not present, the address to receive payment is the one that signed the transaction
  paymentMode?: PaymentMode // if there is a smart contract attached to the content transaction, payment mode specifies the distribution across owner addresses defined by smart contract
}

export type Derivation = {
  type: "Allowed-With-Credit" | "Allowed-With-Indication" | "Allowed-With-License-Passthrough" | "Allowed-With-RevenueShare",
  value?: number, // used only for revenue share
  duration?: Duration
}

export type CommercialUse = {
  type: "Allowed" | "Allowed-With-Credit",
  duration?: Duration
}

export type LicenseFee = {
  type: "Monthly" | "One-Time",
  value: number // the amount of "currency" to be paid
}

export type PaymentMode = "Random-Distribution" | "Global-Distribution";

export type Duration = {
  type: "Before" | "After",
  value: number
}

export enum tagNames {
  LICENSE = "License",
  LICENSE_FEE = "License-Fee",
  DERIVATION = "Derivation",
  COMMERCIAL_USE = "Commercial-Use",
  PAYMENT_MODE = "Payment-Mode",
  PAYMENT_ADDRESS = "Payment-Address",
  EXPIRES = "Expires",
  CURRENCY = "Currency",
};