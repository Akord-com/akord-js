export type Whitelist = {
  id: string,
  owner: string,
  vaultId: string,
  type: NFTType,
  token: string, // address of NFT token
  capacity: number,
  access: AccessType,
  members: {
    address: string,
    email: string,
    externalAddress: string
  }[]
}

export type NFTType = "erc20" | "erc721" | "erc1155"

export type NFTTypes = {
  ERC20: "erc20",
  ERC721: "erc721",
  ERC1155: "erc1155"
}

export type AccessType = "VIEWER" | "CONTRIBUTOR"

export type WhitelistConfig = {
  type: NFTType,
  token: string,
  capacity: number,
  access: AccessType
}
