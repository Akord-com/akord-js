import { Api } from '../api'
import { ContractState, Tags } from "../../types/contract";
import { Membership } from "../../types/membership";
import { WarpFactory, LoggerFactory, DEFAULT_LEVEL_DB_LOCATION, Contract } from "warp-contracts";
import GUN from 'gun';
import { digest } from '@akord/crypto';
import { cloneDeep } from 'lodash';

// Set up SmartWeave client
LoggerFactory.INST.logLevel("error");
const smartweave = WarpFactory.forMainnet({ inMemory: true, dbLocation: DEFAULT_LEVEL_DB_LOCATION });

const getContract = (contractId, wallet): Contract<ContractState> => {
  const contract = <any>smartweave
    .contract(contractId)
  if (wallet) {
    return contract.connect(wallet);
  }
  return contract;
};
export default class DefaultApi extends Api {
  public gun = GUN();


  constructor() {
    super();
  }

  async getMemberships(wallet): Promise<any> {
    const address = await wallet.address();
    const that = this;
    return new Promise(function (resolve, reject) {
      that.gun.get('akord-js-test').get("members").get(address).on((data, key) => {
        resolve(data);
      });
    });
  };

  async getObject(objectId: string, objectType: string): Promise<any> {
    const that = this;
    const collection = this.getCollectionName(objectType);
    const data = await new Promise(function (resolve, reject) {
      that.gun.get('akord-js-test').get(collection).get(objectId).on((data, key) => {
        resolve(data);
      });
    });
    return data;
  };

  async getMembershipKeys(vaultId: string, wallet: any): Promise<any> {
    const address = await wallet.getAddress();
    const that = this;
    const keys = await new Promise(function (resolve, reject) {
      that.gun.get("akord-js-test").get('members').get(address).get(vaultId).on((membership, key) => {
        const keys = JSON.parse(membership.keys);
        resolve(JSON.parse(keys));
      });
    });
    return { keys: keys, isEncrypted: true };
  };

  async getVaults(wallet: any): Promise<any> {
    const address = await wallet.getAddress();
    const that = this;
    return new Promise(function (resolve, reject) {
      that.gun.get('akord-js-test').get('members').get(address).on((vaults, key) => {
        resolve({ keys: "", isEncrypted: true });
      });
    });
  };

  async getObjectsByVaultId(vaultId: string, objectType: string): Promise<any> {
    const that = this;
    const collection = objectType.toLowerCase() === "membership"
      ? "members"
      : objectType.toLowerCase() + "s";
    return new Promise(function (resolve, reject) {
      that.gun.get('akord-js-test').get(collection).get(vaultId).on((data, key) => {
        resolve(data);
      });
    });
  };

  async getProfile(wallet: any) {
    return null;
  };

  async postContractTransaction(vaultId: string, input: any, tags: any) {
    const response = await this.fetch("postTransaction", {
      vaultId,
      input,
      tags
    })
    await this.getContractState(vaultId);
    return response.id;
  };

  async uploadFile(file: any, tags: Tags) {
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
    const that = this;
    await Promise.all(items.map(async (item: { data: any, tags: Tags }, index: number) => {
      const response = await this.fetch("uploadData", item);
      const id = response.id;
      const another = that;
      await new Promise(function (resolve, reject) {
        if (item.data.keys) {
          item.data.keys = JSON.stringify(item.data.keys);
        }
        another.gun.get("akord-js-test").get("states").get(id).put(item.data);
        resolve("");
      });
      resources[index] = { id: id, resourceTx: id, resourceUrl: id };
    }));
    return resources;
  };

  async initContractId() {
    const response = await this.fetch("initContractId", {});
    return response.id;
  };

  async downloadState(id: string): Promise<any> {
    const that = this;
    const state = await new Promise(function (resolve, reject) {
      that.gun.get('akord-js-test').get('states').get(id).on((data, key) => {
        resolve(data);
      });
    });
    return state;
  };

  async downloadFile(id: string) {
    const response = await fetch("https://arweave.net/" + id);
    if (response.status == 200 || response.status == 202) {
      const buffer = await response.arrayBuffer();
      return buffer;
    } else {
      console.log("INFO: Data endpoint not available : ", id);
      return {};
    }
  };

  public async getContractState(contractId: string): Promise<any> {
    const contractObject = getContract(contractId, null);
    const contract = (await contractObject.readState()).cachedValue;
    let vault = contract.state;
    const vaultData = await this.downloadState(vault.data[vault.data.length - 1]);
    vault = { ...vault, ...vaultData };
    const that = this;
    await new Promise(function (resolve, reject) {
      const vaultObject = cloneDeep(vault);
      delete vaultObject.data;
      delete vaultObject.nodes;
      delete vaultObject.memberships;
      that.gun.get('akord-js-test').get("vaults").get(vault.id).put(vaultObject);
      resolve("");
    });
    await this.downloadMemberships(vault);
    await this.downloadNodes(vault);
    return vault;
  };

  private async downloadMemberships(vault: ContractState) {
    for (let membership of vault.memberships) {
      const dataTx = membership.data[membership.data.length - 1];
      const state = await this.downloadState(dataTx);
      membership = { ...membership, ...state, vaultId: vault.id };
      const that = this;
      await new Promise(function (resolve, reject) {
        let object = membership as any;
        if (object.keys) {
          object.keys = JSON.stringify(membership.keys);
        }
        delete object.data;
        that.gun.get("akord-js-test").get("members").get(object.vaultId).get(object.id).put(object);
        that.gun.get("akord-js-test").get("members").get(object.id).put(object);
        that.gun.get("akord-js-test").get("members").get(object.address).get(object.vaultId).put(object);
        resolve("");
      });
    }
  }

  public async getUserFromEmail(email: string): Promise<any> {
    const that = this;
    const emailHash = await digest(email);
    return new Promise(function (resolve, reject) {
      that.gun.get('akord-js-test').get('wallets').get(emailHash).on((data, key) => {
        resolve(data);
      });
    });
  };

  public async preInviteCheck(emails: string[], vaultId: string): Promise<Array<{ address: string, publicKey: string, membership: Membership }>> {
    const memberships = await this.getObjectsByVaultId(vaultId, "Membership");
    return await Promise.all(emails.map(async (email) => ({
      ...await this.getUserFromEmail(email),
      membership: memberships.find(member => member.email === email)
    })));
  };

  private async downloadNodes(vault: ContractState) {
    vault.folders = [];
    vault.stacks = [];
    vault.notes = [];
    vault.memos = [];
    for (let node of (<any>vault).nodes) {
      const dataTx = node.data[node.data.length - 1];
      const state = await this.downloadState(dataTx);
      node = { ...node, ...state, vaultId: vault.id };
      const collection = node.type.toLowerCase() + "s";
      vault[collection].push(node);
      const that = this;
      await new Promise(function (resolve, reject) {
        delete node.data;
        if (!node.parentId) {
          node.parentId = null;
        }
        that.gun.get("akord-js-test").get(collection).get(node.vaultId).get(node.id).put(node);
        that.gun.get('akord-js-test').get(collection).get(node.id).put(node);
        resolve("");
      });
    }
  }

  public async getNodeState(stateId: string): Promise<any> {
    const that = this;
    const state = await new Promise(function (resolve, reject) {
      that.gun.get('akord-js-test').get('states').get(stateId).on((data, key) => {
        resolve(data);
      });
    });
    return state;
  }

  private async fetch(functionName: string, body: any) {
    const url = "https://europe-west1-akord-js-test.cloudfunctions.net/" + functionName;
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
    throw new Error("Method not implemented")
  }
}

export {
  DefaultApi
}