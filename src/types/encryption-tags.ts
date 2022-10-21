import { encryptionTags } from "../constants";

export interface EncryptionTags {
    [encryptionTags.Initialization_Vector]: string,
    [encryptionTags.Encrypted_Key]: string,
    [encryptionTags.Public_Key]: string,
    [encryptionTags.Public_Address]: string
}