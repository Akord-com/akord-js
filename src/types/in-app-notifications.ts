import { actionRefs } from "../constants";

export type InAppNotifications = {
  notifications: Array<Notification>
  nextToken: string
}

export type Notification = {
  admin: boolean;
  content: any;
  hash: string;
  height: string;
  id: string;
  dataRoomId: string;
  modelType: string;
  modelId: string;
  status: "READ" | "UNREAD" | "DELETED";
  createdAt: string;
  groupRef: string;
  dataRoom: { memberships: { items: DataRoomMember[] } };
  transactions: { items: NotificationTransaction[] };
}

export type DataRoomMember = {
  id: string;
  dataRoomId: string;
  memberPublicSigningKey: string;
  publicSigningKey: string;
};

export type NotificationTransaction = {
  publicSigningKey: string;
  actionRef: actionRefs;
  createdAt: string;
  dataRoomId: string;
  vaultId: string;
  modelId: string;
  objectId: string;
  objectType: string;
  groupRef: string;
  hash: string;
  encodedPrevState: string;
  stack: { title: string };
  folder: { title: string };
  note: { title: string };
  memo: { message: string };
};