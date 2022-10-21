export enum reactionEmoji {
  JOY = "128514",
  ASTONISHED = "128562",
  CRY = "128557",
  HEART = "10084,65039",
  FIRE = "128293",
  THUMBS_UP = "128077",
  THUMBS_DOWN = "128078",
  PRAY = "128591"
};

export enum objectTypes {
  VAULT = "Vault",
  MEMBERSHIP = "Membership",
  STACK = "Stack",
  MEMO = "Memo",
  FOLDER = "Folder",
  NOTE = "Note"
};

export enum status {
  PENDING = "PENDING",
  INVITED = "INVITED",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  REVOKED = "REVOKED",
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
  DELETED = "DELETED"
};

export enum role {
  OWNER = "OWNER",
  CONTRIBUTOR = "CONTRIBUTOR",
  VIEWER = "VIEWER"
};

export enum actionRefs {
  VAULT_CREATE = "DATAROOM_CREATE",
  VAULT_RENAME = "DATAROOM_RENAME",
  VAULT_ARCHIVE = "DATAROOM_ARCHIVE",
  VAULT_RESTORE = "DATAROOM_RESTORE",
  VAULT_DELETE = "DATAROOM_DELETE",
  VAULT_KEY_ROTATE = "DATAROOM_KEY_ROTATE",
  MEMBERSHIP_INVITE = "MEMBERSHIP_INVITE",
  MEMBERSHIP_INVITE_RESEND = 'MEMBERSHIP_INVITE_RESEND',
  MEMBERSHIP_ACCEPT = "MEMBERSHIP_ACCEPT",
  MEMBERSHIP_REVOKE = "MEMBERSHIP_REVOKE",
  MEMBERSHIP_REJECT = "MEMBERSHIP_REJECT",
  MEMBERSHIP_LEAVE = "MEMBERSHIP_LEAVE",
  MEMBERSHIP_KEY_ROTATE = "MEMBERSHIP_KEY_ROTATE",
  MEMBERSHIP_CHANGE_ROLE = "MEMBERSHIP_CHANGE_ACCESS",
  MEMBERSHIP_PROFILE_UPDATE = "MEMBERSHIP_PROFILE_UPDATE",
  MEMBERSHIP_OWNER = "MEMBERSHIP_OWNER",
  MEMBERSHIP_CONFIRM = "MEMBERSHIP_CONFIRM",
  MEMO_CREATE = "MEMO_WRITE",
  MEMO_ADD_REACTION = "MEMO_ADD_REACTION",
  MEMO_REMOVE_REACTION = "MEMO_REMOVE_REACTION",
  FOLDER_CREATE = "FOLDER_CREATE",
  FOLDER_RENAME = "FOLDER_RENAME",
  FOLDER_MOVE = "FOLDER_MOVE",
  FOLDER_REVOKE = "FOLDER_REVOKE",
  FOLDER_RESTORE = "FOLDER_RESTORE",
  FOLDER_DELETE = "FOLDER_DELETE",
  STACK_CREATE = "STACK_CREATE",
  STACK_UPLOAD_REVISION = "STACK_UPLOAD_REVISION",
  STACK_RENAME = "STACK_RENAME",
  STACK_MOVE = "STACK_MOVE",
  STACK_REVOKE = "STACK_REVOKE",
  STACK_RESTORE = "STACK_RESTORE",
  STACK_DELETE = "STACK_DELETE",
  NOTE_CREATE = "NOTE_CREATE",
  NOTE_UPLOAD_REVISION = "NOTE_UPLOAD_REVISION",
  NOTE_RENAME = "NOTE_RENAME",
  NOTE_MOVE = "NOTE_MOVE",
  NOTE_REVOKE = "NOTE_REVOKE",
  NOTE_RESTORE = "NOTE_RESTORE",
  NOTE_DELETE = "NOTE_DELETE",
  PROFILE_UPDATE = "PROFILE_UPDATE"
};

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

export enum encryptionTags {
  Initialization_Vector = "Initialization-Vector",
  Encrypted_Key = "Encrypted-Key",
  Public_Key = "Public-Key",
  Public_Address = "Public-Address"
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