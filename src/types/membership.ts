import { Encryptable, EncryptedKeys } from "@akord/crypto";
import { ProfileDetails } from "./profile-details";

export type RoleType = "VIEWER" | "CONTRIBUTOR" | "OWNER";
export type StatusType = "ACCEPTED" | "PENDING" | "REVOKED" | "INVITED";

export class Membership extends Encryptable {
  id: string;
  owner: string;
  createdAt: string; // number
  updatedAt: string; // number
  status: StatusType;
  address: string;
  role: RoleType;
  data?: string[];
  encPublicSigningKey: string;
  email: string;
  memberPublicSigningKey: string;
  memberDetails: ProfileDetails;

  vaultId: string; // remove when on warp
  keys: EncryptedKeys[];

  constructor(membershipProto: any, keys?: Array<EncryptedKeys>) {
    super(keys, null)
    this.id = membershipProto.id;
    this.owner = membershipProto.owner;
    this.address = membershipProto.address;
    this.createdAt = membershipProto.createdAt;
    this.updatedAt = membershipProto.updatedAt;
    this.data = membershipProto.data;
    this.status = membershipProto.status;
    this.role = membershipProto.role;
    this.encPublicSigningKey = membershipProto.encPublicSigningKey;
    this.email = membershipProto.email;
    this.memberPublicSigningKey = membershipProto.memberPublicSigningKey;
    this.vaultId = membershipProto.vaultId;
    this.keys = keys;
    this.memberDetails = new ProfileDetails(membershipProto.memberDetails, keys);
  }
}

export type MembershipKeys = {
  isEncrypted: boolean;
  keys: EncryptedKeys[];
  publicKey?: string;
};