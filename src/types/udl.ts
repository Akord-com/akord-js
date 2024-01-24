// see: https://arwiki.wiki/#/en/Universal-Data-License-How-to-use-it
// see: https://udlicense.arweave.dev/

// current release of the Universal Data License
export const UDL_LICENSE_TX_ID = "IVjAM1C3x3GFdc3t9EqMnbtGnpgTuJbaiYZa1lk09_8";

export type UDL = {
  license?: string, // tx id of the UDL, default to UDL_LICENSE_TX_ID
  derivations?: Derivation[], // grants the rights of licensees to make derivative works
  commercialUses?: CommercialUse[], // grants the rights of licensees to use the content for commercial use
  dataModelTrainings?: DataModelTraining[], // grants the rights of licensees to use the content for data model trainings
  licenseFee?: LicenseFee, // if not present, access to the medium is free of charge
  currency?: string, // if not present, the currency defaults to the $U token on the Arweave network
  expires?: number, // designated in years, if not present, the term of the license is unlimited
  unknownUsageRights?: "Excluded", // if not present, unknown usage rights are included where available
  paymentAddress?: string, // if not present, the address to receive payment is the one that signed the transaction
  paymentMode?: PaymentMode // if there is a smart contract attached to the content transaction, payment mode specifies the distribution across owner addresses defined by smart contract
}

export type LicenseOptionSettings = {
  type: "Allowed" | "Allowed-With-Credit" | "Allowed-With-Indication" | "Allowed-With-License-Passthrough" | "Allowed-With-RevenueShare" | "Allowed-With-Fee",
  value?: number, // used only for Allowed-With-RevenueShare
  fee?: LicenseFee, // used only for Allowed-With-Fee
  duration?: Duration
}

export type Derivation = LicenseOptionSettings;

export type CommercialUse = LicenseOptionSettings;

export type DataModelTraining = {
  type: "Allowed" | "Allowed-With-Fee"
  fee?: LicenseFee, // used only for Allowed-With-Fee
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
  ACCESS_FEE = "Access-Fee",
  DERIVATION = "Derivation",
  COMMERCIAL_USE = "Commercial-Use",
  PAYMENT_MODE = "Payment-Mode",
  PAYMENT_ADDRESS = "Payment-Address",
  EXPIRY = "Expiry",
  CURRENCY = "Currency",
  UNKNOWN_USAGE_RIGHTS = "Unknown-Usage-Rights",
  DATA_MODEL_TRAINING = "Data-Model-Training"
};