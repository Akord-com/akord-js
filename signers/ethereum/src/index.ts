import { createWalletClient, http } from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { ethers } from "ethers";

export default class EthereumSigner {

  injectedWallet: InjectedWallet;
  privateKey: string;

  constructor(config: { privateKey?: any, injectedWallet?: InjectedWallet }) {
    this.privateKey = config.privateKey
    this.injectedWallet = config.injectedWallet;
    if (!this.privateKey && !this.injectedWallet) {
      throw new Error("Missing wallet configuration. Please provide Ethereum private key or inject the wallet.");
    }
  }

  async signingPublicKey(): Promise<string> {
    if (this.injectedWallet) {
      if (!this.injectedWallet.getAddresses) {
        throw new Error("The injected wallet is missing getAddresses() method.");
      }
      const [account] = await this.injectedWallet.getAddresses();
      return account;
    } else {
      const account = getAccountFromPrivateKey(this.privateKey);
      return account.publicKey;
    }
  }

  async sign(message: string) {
    if (this.injectedWallet) {
      if (!this.injectedWallet.signMessage) {
        throw new Error("The injected wallet is missing signMessage() method.");
      }
      // get user to sign signature
      const [account] = await this.injectedWallet.getAddresses();
      const signature = await this.injectedWallet.signMessage({
        account,
        message,
      });
      return signature;
    } else {
      return createNodeSignature(message, this.privateKey);
    }
  }

  async verify(message: string, signature: string) {
    const recoveredAddress = ethers.utils.verifyMessage(message, signature);
    const walletAddress = await this.getAddress();
    return recoveredAddress === walletAddress;
  }

  async getAddress(): Promise<string> {
    if (this.injectedWallet) {
      if (!this.injectedWallet.getAddresses) {
        throw new Error("The injected wallet is missing getAddresses() method.");
      }
      const [account] = await this.injectedWallet.getAddresses();
      return account;
    } else {
      const account = getAccountFromPrivateKey(this.privateKey);
      return account.address;
    }
  }
}

function getAccountFromPrivateKey(privateKey: string) {
  const formattedPrivateKey = ((privateKey.substring(0,2) === "0x") ? privateKey : ("0x" + privateKey)) as `0x${string}`;
  return privateKeyToAccount(formattedPrivateKey);
}

async function createNodeSignature(message: string, privateKey: string) {
  const account = getAccountFromPrivateKey(privateKey);

  const client = createWalletClient({
    account,
    chain: mainnet,
    transport: http(),
  });

  const signature = await client.signMessage({
    account,
    message,
  });

  return signature;
}

export interface InjectedWallet {
  getAddresses(): Promise<any>
  signMessage(config?: any): Promise<any>
}

export {
  EthereumSigner
}