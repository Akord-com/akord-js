import base58 from "bs58";
import nacl from "tweetnacl"
import solanaWeb3 from "@solana/web3.js"

export default class SolanaSigner {

  injectedWallet: InjectedWallet;
  keypair: solanaWeb3.Keypair;

  constructor(config: { keypair?: any, injectedWallet?: InjectedWallet }) {
    this.keypair = config.keypair
    this.injectedWallet = config.injectedWallet;
    if (!this.keypair && !this.injectedWallet) {
      throw new Error("Missing wallet configuration. Please provide Solana keypair or inject the wallet.");
    }
  }

  signingPublicKey(): string {
    if (this.injectedWallet) {
      if (!this.injectedWallet.publicKey) {
        throw new Error("The injected wallet is missing publicKey field.");
      }
      return this.injectedWallet.publicKey.toBase58();
    } else {
      return this.keypair.publicKey.toBase58();
    }
  }

  private signingPublicKeyRaw(): Uint8Array {
    if (this.injectedWallet) {
      if (!this.injectedWallet.publicKey) {
        throw new Error("The injected wallet is missing publicKey field.");
      }
      return this.injectedWallet.publicKey.toBytes();
    } else {
      return this.keypair.publicKey.toBytes();
    }
  }

  async sign(message: string) {
    const encodedMessage = new TextEncoder().encode(message);
    if (this.injectedWallet) {
      if (!this.injectedWallet.signMessage) {
        throw new Error("The injected wallet is missing signMessage() method.");
      }
      const signedMessage = await this.injectedWallet.signMessage(encodedMessage);
      return signedMessage;
      // return uint8ArrayToBase58(signedMessage);
    } else {
      const signature = nacl.sign.detached(encodedMessage, this.keypair.secretKey);
      return base58.encode(signature);
    }
  }

  async getAddress(): Promise<string> {
    return this.signingPublicKey();
  }

  async verify(message: string, signature: string) {
    const encodedMessage = new TextEncoder().encode(message);
    const signatureUint8Array = base58.decode(signature);
    const isValid = nacl.sign.detached.verify(encodedMessage, signatureUint8Array, this.signingPublicKeyRaw());
    return isValid;
  }
}

export interface InjectedWallet {
  signMessage(data: Uint8Array | string): Promise<string>
  publicKey: any
}

export {
  SolanaSigner
}