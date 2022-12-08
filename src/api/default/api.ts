import { Api } from '../api'
import { ContractInput, Tags } from "../../types/contract";
import { Membership } from "../../types/membership";
import { Vault } from "../../types/vault";
import { digest, Wallet, Keys } from '@akord/crypto';
import { ClientConfig } from '../../client-config';
import { ApiConfig, apiConfig } from './config';
import { get } from './gun';

export default class DefaultApi extends Api {
  public config: ApiConfig;

  constructor(config: ClientConfig) {
    super();
    this.config = apiConfig(config);
  }

  async getMemberships(wallet: Wallet): Promise<Array<Membership>> {
    const address = await wallet.getAddress();
    return get("membersByAddress/" + address);
  };

  async getObject(objectId: string, objectType: string): Promise<any> {
    const collection = this.getCollectionName(objectType);
    return get(collection + "/" + objectId);
  };

  async getMembershipKeys(vaultId: string, wallet: Wallet): Promise<{ isEncrypted: boolean, keys: Array<Keys>, publicKey?: string }> {
    const address = await wallet.getAddress();
    const membership = await get("membersByAddressAndVaultId/" + address + "/" + vaultId);
    const keys = JSON.parse(JSON.parse(membership.keys));
    return { keys, isEncrypted: true };
  };

  async getVaults(wallet: Wallet):  Promise<Array<Vault>> {
    const address = await wallet.getAddress();
    const ids = await get("membersByAddress/" + address);
    const vaults = [];
    if (ids) {
      for (let id of Object.keys(ids)) {
        if (id !== "_") {
          const membership = await this.getObject(id, "Membership");
          const vault = await this.getObject(membership.vaultId, "Vault");
          vaults.push(vault);
        }
      };
    }
    return vaults;
  };

  async getObjectsByVaultId(vaultId: string, objectType: string): Promise<any> {
    const collection = this.getCollectionName(objectType);
    const ids = await get(collection + "ByVaultId/" + vaultId);
    const objects = [];
    if (ids) {
      for (let id of Object.keys(ids)) {
        if (id !== "_") {
          const object = await this.getObject(id, objectType);
          objects.push(object);
        }
      };
    }
    return objects;
  };

  async getProfile(wallet: Wallet) {
    return null;
  };

  async postContractTransaction(vaultId: string, input: ContractInput, tags: Tags) {
    const response = await this.fetch("postTransaction", {
      vaultId,
      input,
      tags
    })
    await this.fetch("refreshState", { vaultId })
    return response.id;
  };

  async uploadFile(file: ArrayBufferLike, tags: Tags) {
    const body = {
      data: file,
      tags: tags
    };

    // const storage = getStorage(this.app);
    // const resourceUrl = uuidv4();
    // const storageRef = ref(storage, resourceUrl);
    // const result = await uploadBytes(storageRef, file);
    // console.log(result);
    const response = await this.fetch("uploadData", body);
    const id = response.id;
    return { resourceTx: id, /*resourceUrl: resourceUrl */ };
  };

  async uploadData(items: { data: any, tags: Tags }[]) {
    const resources = [];
    await Promise.all(items.map(async (item: { data: any, tags: Tags }, index: number) => {
      const response = await this.fetch("uploadData", item);
      const id = response.id;
      resources[index] = { id: id, resourceTx: id, resourceUrl: id };
    }));
    return resources;
  };

  async initContractId() {
    const response = await this.fetch("initContractId", {});
    return response.id;
  };

  async downloadFile(id: string):  Promise<any> {
    const response = await fetch("https://arweave.net/" + id);
    if (response.status == 200 || response.status == 202) {
      const buffer = await response.arrayBuffer();
      return buffer;
    } else {
      console.log("INFO: Data endpoint not available : ", id);
      return null;
    }
  };

  public async getContractState(contractId: string): Promise<any> {
    const response = await this.fetch("refreshState", { vaultId: contractId });
    return response;
  };

  public async getUserFromEmail(email: string): Promise<any> {
    const emailHash = await digest(email);
    return get("wallets/" + emailHash);
  };

  public async preInviteCheck(emails: string[], vaultId: string): Promise<Array<{ address: string, publicKey: string, membership: Membership }>> {
    const memberships = await this.getObjectsByVaultId(vaultId, "Membership");
    return await Promise.all(emails.map(async (email) => ({
      ...await this.getUserFromEmail(email),
      membership: memberships.find(member => member.email === email)
    })));
  };

  public async getNodeState(stateId: string): Promise<any> {
    return get("states/" + stateId);
  }

  private async fetch(functionName: string, body: any) {
    const url = this.config.endpoint + functionName;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, origin, Authorization, x-requested-with',
          'Content-Type': 'application/json',
          'Access-Control-Allow-Methods': 'PUT, GET, POST, DELETE, OPTIONS'
        },
        body: JSON.stringify(body)
      });
      const jsonResponse = await response.json();
      console.log(jsonResponse)
      return jsonResponse;
    } catch (error) {
      console.log(error);
    }
  }

  private getCollectionName(objectType: string) {
    return objectType.toLowerCase() === "membership"
      ? "members"
      : objectType.toLowerCase() + "s";
  }

  public async getTransactions(vaultId: string): Promise<Array<any>> {
    throw new Error("Method not implemented");
  }
}

export {
  DefaultApi
}