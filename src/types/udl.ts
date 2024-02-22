// see: https://arwiki.wiki/#/en/Universal-Data-License-How-to-use-it
// see: https://udlicense.arweave.dev/

// current release of the Universal Data License
export const UDL_LICENSE_TX_ID = "IVjAM1C3x3GFdc3t9EqMnbtGnpgTuJbaiYZa1lk09_8";

export class UDL {
  license?: string // tx id of the UDL, default to UDL_LICENSE_TX_ID
  derivations?: Derivation[] // grants the rights of licensees to make derivative works
  commercialUses?: CommercialUse[] // grants the rights of licensees to use the content for commercial use
  dataModelTrainings?: DataModelTraining[] // grants the rights of licensees to use the content for data model trainings
  licenseFee?: LicenseFee // if not present, access to the medium is free of charge
  currency?: string // if not present, the currency defaults to the $U token on the Arweave network
  expires?: number // designated in years, if not present, the term of the license is unlimited
  unknownUsageRights?: "Excluded" // if not present, unknown usage rights are included where available
  paymentAddress?: string // if not present, the address to receive payment is the one that signed the transaction
  paymentMode?: PaymentMode // if there is a smart contract attached to the content transaction, payment mode specifies the distribution across owner addresses defined by smart contract

  constructor(udlProto: any) {
    this.license = udlProto.id;
    this.derivations = (udlProto.derivations || []).map((derivation: Derivation) => new Derivation(derivation));
    this.commercialUses = (udlProto.commercialUses || []).map((commercialUse: CommercialUse) => new CommercialUse(commercialUse));
    this.dataModelTrainings = (udlProto.dataModelTrainings || []).map((dataModelTraining: DataModelTraining) => new DataModelTraining(dataModelTraining));
    this.licenseFee = udlProto.licenseFee ? new LicenseFee(udlProto.licenseFee) : undefined;
    this.currency = udlProto.currency;
    this.expires = udlProto.expires;
    this.unknownUsageRights = udlProto.unknownUsageRights;
    this.paymentAddress = udlProto.paymentAddress;
    this.paymentMode = udlProto.paymentMode;
  }
}

export class LicenseOptionSettings {
  type: "Allowed" | "Allowed-With-Credit" | "Allowed-With-Indication" | "Allowed-With-License-Passthrough" | "Allowed-With-RevenueShare" | "Allowed-With-Fee"
  value?: number // used only for Allowed-With-RevenueShare
  fee?: LicenseFee // used only for Allowed-With-Fee
  duration?: Duration

  constructor(settingsProto: any) {
    this.type = settingsProto.type;
    this.value = settingsProto.value;
    this.fee = settingsProto.fee ? new LicenseFee(settingsProto.fee) : undefined;
    this.duration = settingsProto.duration ? new Duration(settingsProto.duration) : undefined;
  }
}

export class Derivation extends LicenseOptionSettings {}

export class CommercialUse extends LicenseOptionSettings {}

export class DataModelTraining {
  type: "Allowed" | "Allowed-With-Fee"
  fee?: LicenseFee // used only for Allowed-With-Fee
  duration?: Duration

  constructor(settingsProto: any) {
    this.type = settingsProto.type;
    this.fee = settingsProto.fee ? new LicenseFee(settingsProto.fee) : undefined;
    this.duration = settingsProto.duration ? new Duration(settingsProto.duration) : undefined;
  }
}

export class LicenseFee {
  type: "Monthly" | "One-Time"
  value: number // the amount of "currency" to be paid

  constructor(licenseFeeProto: any) {
    this.type = licenseFeeProto.type;
    this.value = licenseFeeProto.value;
  }
}

export type PaymentMode = "Random-Distribution" | "Global-Distribution";

export class Duration {
  type: "Before" | "After"
  value: number

  constructor(durationProto: any) {
    this.type = durationProto.type;
    this.value = durationProto.value;
  }
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