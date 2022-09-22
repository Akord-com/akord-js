export enum protocolTags {
  CLIENT_NAME = "Client-Name",
  PROTOCOL_NAME = "Protocol-Name",
  PROTOCOL_VERSION = "Protocol-Version",
  TIMESTAMP = "Timestamp",
  COMMAND = "Command",
  VAULT_ID = "Vault-Id",
  MEMBERSHIP_ID = "Membership-Id",
  NODE_TYPE = "Node-Type",
  NODE_ID = "Node-Id",
  ACCESS = "Access",
  REF_ID = "Ref-Id",
  REVISION = "Revision",
  ACTION_REF = "Action-Ref",
  GROUP_REF = "Group-Ref",
  SIGNER_ADDRESS = "Signer-Address",
  SIGNATURE = "Signature",
  MEMBER_ADDRESS = "Member-Address"
};

export enum smartweaveTags {
  APP_NAME = "App-Name",
  APP_VERSION = "App-Version",
  CONTENT_TYPE = "Content-Type",
  CONTRACT = "Contract",
  CONTRACT_SOURCE = "Contract-Src",
  INPUT = "Input",
  INTERACT_WRITE = "Interact-Write",
};

export enum smartweaveValues {
  CONTRACT_CODE_SOURCE = "SmartWeaveContractSource",
  CONTRACT_INTERACTION = "SmartWeaveAction",
  CONTRACT_INITIALIZATION = "SmartWeaveContract"
};

export enum commands {
  VAULT_CREATE = "vault:init",
  VAULT_UPDATE = "vault:update",
  VAULT_ARCHIVE = "vault:archive",
  VAULT_RESTORE = "vault:restore",
  MEMBERSHIP_INVITE = "membership:invite",
  MEMBERSHIP_ACCEPT = "membership:accept",
  MEMBERSHIP_REVOKE = "membership:revoke",
  MEMBERSHIP_REJECT = "membership:reject",
  MEMBERSHIP_CHANGE_ROLE = "membership:change-role",
  MEMBERSHIP_UPDATE = "membership:update",
  NODE_CREATE = "node:create",
  NODE_UPDATE = "node:update",
  NODE_REVOKE = "node:revoke",
  NODE_MOVE = "node:move",
  NODE_RESTORE = "node:restore",
  NODE_DELETE = "node:delete"
};