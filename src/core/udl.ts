import { CommercialUse, Derivation, LicenseFee, UDL, UDL_LICENSE_TX_ID, tagNames } from "../types/udl";
import { Tag, Tags } from "../types/contract";
import { BadRequest } from "../errors/bad-request";

export const udlToTags = (udl: UDL): Tags => {
  const tags = [] as Tags;
  tags.push(new Tag(tagNames.LICENSE, udl.license || UDL_LICENSE_TX_ID));
  if (udl.licenseFee) {
    tags.push(new Tag(tagNames.LICENSE_FEE, setLicenseFee(udl.licenseFee)));
  }
  if (udl.commercialUses) {
    for (let commercialUse of udl.commercialUses) {
      tags.push(new Tag(setDuration(commercialUse, tagNames.COMMERCIAL_USE), commercialUse.type));
    }
  }
  if (udl.derivations) {
    for (let derivation of udl.derivations) {
      tags.push(new Tag(setDuration(derivation, tagNames.DERIVATION), setDerivation(derivation)));
    }
  }
  if (udl.expires) {
    tags.push(new Tag(tagNames.EXPIRY, udl.expires));
  }
  if (udl.currency) {
    tags.push(new Tag(tagNames.CURRENCY, udl.currency));
  }
  if (udl.paymentMode) {
    tags.push(new Tag(tagNames.PAYMENT_MODE, udl.paymentMode));
  }
  if (udl.paymentAddress) {
    tags.push(new Tag(tagNames.PAYMENT_ADDRESS, udl.paymentAddress));
  }
  return tags;
}

export const setDuration = (udlField: CommercialUse | Derivation, tagName: string): string => {
  if (udlField.duration) {
    return udlField.duration.type + "-" + udlField.duration.value + "-Years-" + tagName;
  } else {
    return tagName;
  }
}

export const setLicenseFee = (licenseFee: LicenseFee): string => {
  return licenseFee.type + "-" + licenseFee.value;
}

export const setDerivation = (derivation: Derivation): string => {
  let derivationValue = derivation.type as string;
  if (derivation.type === "Allowed-With-RevenueShare") {
    if (!derivation.value) {
      throw new BadRequest("Incorrect UDL format: Derivation With Revenue Share must specify % value.");
    }
    derivationValue = derivationValue + "-" + derivation.value + "%";
  }
  return derivationValue;
}
