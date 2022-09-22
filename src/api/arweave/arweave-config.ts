export const arweaveConfig = (env?: string) => {
  switch (env) {
    case "mainnet":
    default: {
      return {
        host: "arweave.net",
        port: 443,
        protocol: "https",
        url: "https://arweave.net"
      }
    }
    case "testnet": {
      return {
        host: "testnet.redstone.tools",
        port: 443,
        protocol: "https",
        url: "https://testnet.redstone.tools"
      }
    }
    case "local": {
      return {
        host: "localhost",
        port: 1984,
        protocol: "http",
        url: "http://localhost:1984"
      }
    }
  }
};

module.exports = {
  arweaveConfig
}

export interface ArweaveConfig {
  host: string,
  port: number,
  protocol: string,
  url: string
}