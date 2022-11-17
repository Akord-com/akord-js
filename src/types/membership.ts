import { Encryptable, Keys } from "@akord/crypto";
import { ProfileDetails } from "./profile-details";
import { role, status } from "../constants";

export class Membership extends Encryptable {
  id: string;
  owner: string;
  createdAt: string; // number
  updatedAt: string; // number
  status: status;
  address: string;
  role: role;
  data?: string[];
  encPublicSigningKey: string;
  memberDetails: ProfileDetails;

  vaultId: string; // remove when on warp
  keys: Keys[];

  constructor(membershipProto: any, keys: Array<Keys>) {
    super(membershipProto.keys, null)
    this.id = membershipProto.id;
    this.owner = membershipProto.owner;
    this.createdAt = membershipProto.createdAt;
    this.updatedAt = membershipProto.updatedAt;
    this.data = membershipProto.data;
    this.status = membershipProto.status;
    this.role = membershipProto.role;
    this.encPublicSigningKey = membershipProto.encPublicSigningKey;
    this.memberDetails = membershipProto.memberDetails;
    this.vaultId = membershipProto.vaultId;
    this.keys = keys;
  }
}