import { arrayToBase64 } from '@akord/crypto';
import Arweave from 'arweave';
import * as nodeCrypto from 'crypto';

const crypto = typeof window === 'undefined' ? <any>nodeCrypto.webcrypto : window.crypto;

export enum KeyType {
  JWK = 'JWK',
  ARCONNECT = 'ARCONNECT'
}

export default class ArweaveSigner {
  keyType: KeyType;
  wallet: any;
  arweave: Arweave;

  constructor(config?: { jwk?: any }) {
    this.arweave = Arweave.init({
      host: 'arweave.net',
      port: 443,
      protocol: 'https'
    });
    if (config?.jwk) {
      this.keyType = KeyType.JWK
      this.wallet = config.jwk
    } else if (window.arweaveWallet) {
      this.keyType = KeyType.ARCONNECT
    } else {
      throw new Error("Missing wallet configuration. Please provide Arweave JWK or inject ArConnect wallet.");
    }
  }

  signingPublicKey(): Promise<string> {
    if (this.keyType === KeyType.JWK) {
      return this.wallet.n
    } else {
      return window.arweaveWallet.getActivePublicKey();
    }
  }

  async sign(message: string) {
    let signature: string
    const data = new TextEncoder().encode(message);
    if (this.keyType === KeyType.JWK) {
      const dataToSign = new Uint8Array(data);
      // hash the message
      const hash = await crypto.subtle.digest(HASH_ALGORITHM, dataToSign);
      const cryptoKey = await importRSASigningKey(this.wallet);
      const signatureRaw = await crypto.subtle.sign(
        { name: "RSA-PSS", saltLength: 32 },
        cryptoKey,
        hash
      );
      signature = arrayToBase64(new Uint8Array(signatureRaw));
    } else {
      const rawSignature = await (<any>window.arweaveWallet).signMessage(data);
      signature = arrayToBase64(rawSignature);
    }
    return signature;
  }

  async getAddress(): Promise<string> {
    if (this.keyType === KeyType.JWK) {
      return this.arweave.wallets.jwkToAddress(this.wallet);
    } else {
      return window.arweaveWallet.getActiveAddress();
    };
  }
}

const HASH_ALGORITHM = 'SHA-256'

const importRSASigningKey = async (jwk: any): Promise<CryptoKey> => {
  return await crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSA-PSS",
      hash: HASH_ALGORITHM
    },
    false,
    ["sign"]
  );
}

export {
  ArweaveSigner
}