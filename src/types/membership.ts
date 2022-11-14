import { Encryptable, Keys } from "@akord/crypto";
import { ProfileDetails } from "./profile-details";

export class Membership extends Encryptable {
  id: string;
  owner: string; // owner's address
  createdAt: string;
  updatedAt: string;
  status: string;
  address: string;
  role: string;
  data?: string[];
  encPublicSigningKey: string;
  memberDetails: ProfileDetails;
  vaultId: string;
  public: boolean;
  keys: Keys[];

  constructor(membershipProto: any) {
    super(membershipProto.keys, null)
    this.id = membershipProto.id;
    this.owner = membershipProto.owner;
    this.public = membershipProto.public;
    this.createdAt = membershipProto.createdAt;
    this.updatedAt = membershipProto.updatedAt;
    this.size = membershipProto.size;
    this.data = membershipProto.data;
    this.status = membershipProto.status;
    this.role = membershipProto.role;
    this.encPublicSigningKey = membershipProto.encPublicSigningKey;
    this.memberDetails = membershipProto.memberDetails;
    this.vaultId = membershipProto.dataRoomId;
    this.keys = membershipProto.keys;
  }
}
