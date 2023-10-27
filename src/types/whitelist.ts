export type Whitelist = {
  id: string,
  owner: string,
  vaultId: string,
  type: NFTType,
  token: string, // address of NFT token
  capacity: number,
  members: {
    address: string,
    externalAddress: string
  }[]
}

export type NFTType = "erc20" | "erc721"

export type NFTTypes = {
  ERC20: "erc20",
  ERC721: "erc721"
}

export type WhitelistConfig = {
  type: NFTType,
  token: string,
  capacity: number
}
