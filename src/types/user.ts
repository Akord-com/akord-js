export type User = {
  address: string,
  publicSigningKey: string,
  publicKey: string,
  email: string,
  name?: string,
  avatarUri?: string[],
  avatar?: ArrayBuffer
}

export type UserPublicInfo = {
  address: string,
  publicSigningKey: string,
  publicKey: string
}