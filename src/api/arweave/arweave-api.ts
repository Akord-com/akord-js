import { ClientConfig } from "../../client-config";
import { arweaveConfig, ArweaveConfig } from "./arweave-config";
import { Api } from '../api'
import {
  postContractTransaction,
  initContract,
  getContract,
  prepareArweaveTransaction,
  uploadChunksArweaveTransaction,
  getPublicKeyFromAddress
} from "./arweave-helpers";
import { GraphQLClient } from 'graphql-request';
import { membershipsQuery } from "./graphql";
import Arweave from 'arweave';
import { EncryptionKeys, Wallet } from "@akord/crypto";
import { Contract } from "../../types/contract";
import { srcTxId } from './config';

export default class ArweaveApi extends Api {
  public config!: ArweaveConfig;
  private jwk!: object;
  public arweave: Arweave

  constructor(config: ClientConfig, jwk: any) {
    super()
    this.config = arweaveConfig(config.network);
    this.jwk = jwk;
    this.arweave = Arweave.init(this.config);
  }

  public getConfig() {
    return this.config;
  }

  public async postContractTransaction(contractId: string, input: any, tags: any): Promise<string> {
    const { txId } = await postContractTransaction(
      contractId,
      input,
      tags,
      this.jwk
    );
    return txId;
  };

  public async initContractId(tags: any, state?: any): Promise<string> {
    return initContract(srcTxId, tags, state, this.jwk);
  };

  public async getUserFromEmail(email: string): Promise<string> {
    return getPublicKeyFromAddress(email);
  };

  public async getPublicKeyFromAddress(address: string): Promise<string> {
    return getPublicKeyFromAddress(address);
  };

  public async getProfileByPublicSigningKey(): Promise<any> {
    return {};
  }

  public async uploadFile(file: any, tags: any): Promise<string> {
    const transaction = await prepareArweaveTransaction(
      file,
      tags,
      this.jwk
    );
    await uploadChunksArweaveTransaction(transaction);
    return transaction.id;
  };

  public async uploadData(data: any[]): Promise<string[]> {
    let resourceTxs = [];

    for (let item of data) {
      const transaction = await prepareArweaveTransaction(
        JSON.stringify(item.body),
        {},
        this.jwk
      );
      await uploadChunksArweaveTransaction(transaction);
      resourceTxs.push({ id: transaction.id });
    }
    return resourceTxs;
  };

  public async getContractState(contractId: string): Promise<any> {
    const contractObject = getContract(contractId, null);
    const contract = (await contractObject.readState()).cachedValue;
    const vault = Object.assign(contract) as Contract;
    const vaultData = await this.downloadFile(vault.state.data[vault.state.data.length - 1])
    vault.state = { ...vault.state, ...vaultData };

    await this.downloadMemberships(vault)
    await this.downloadNodes(vault)
    return vault;
  };

  private async downloadMemberships(vault: Contract) {
    for (let membership of vault.state.memberships) {
      const dataTx = membership.data[membership.data.length - 1];
      const state = await this.downloadFile(dataTx);
      membership = { ...membership, ...state };
    }
  }

  private async downloadNodes(vault: Contract) {
    vault.state.folders = [];
    vault.state.stacks = [];
    vault.state.notes = [];
    vault.state.memos = [];
    for (let node of (<any>vault.state).nodes) {
      const dataTx = node.data[node.data.length - 1];
      const state = await this.downloadFile(dataTx);
      node = { ...node, ...state };
      vault.state[node.type.toLowerCase() + "s"].push(node);
    }
  }

  public async getMembershipKeys(vaultId: string, wallet: Wallet): Promise<any> {
    const state = await this.getContractState(vaultId);
    const address = await wallet.getAddress();
    const membership = state.state.memberships.filter(member => member.address === address)[0];
    const dataTx = membership.data[membership.data.length - 1];
    const data = await this.getTransactionData(dataTx);
    return new EncryptionKeys("KEYS_STRUCTURE", data.keys);
  };

  public async getObjectsByVaultId(vaultId: string, objectType: string): Promise<any> {
    const state = await this.getContractState(vaultId);
    let results;
    if (objectType === "Membership") {
      results = await Promise.all(state.state.memberships.map(async (membership) => {
        const object = membership;
        const dataTx = membership.data[membership.data.length - 1];
        delete object.data;
        const data = await this.getTransactionData(dataTx);
        object.state = data;
        return object
      }));
    } else {
      results = await Promise.all(state.state.nodes.filter(node => node.type === objectType).map(async (node) => {
        const object = node;
        const dataTx = node.data[node.data.length - 1];
        delete object.data;
        const data = await this.getTransactionData(dataTx);
        object.state = data;
        return object
      }));
    };
    return results;
  };

  public async getNodeState(objectId: string, objectType: string, vaultId: string): Promise<any> {
    const state = await this.getContractState(vaultId);
    let dataTx;
    if (objectType === "Vault") {
      dataTx = state.state.data[state.state.data.length - 1]
    } else if (objectType === "Membership") {
      const membership = state.state.memberships.filter(member => member.id === objectId)[0];
      dataTx = membership.data[membership.data.length - 1];
    } else {
      const node = state.state.nodes.filter(node => node.id === objectId)[0];
      dataTx = node.data[node.data.length - 1];
    }
    return this.getTransactionData(dataTx);
  };

  public async downloadFile(id: string): Promise<any> {
    return this.getTransactionData(id);
  }

  private async getTransactionData(transactionId: string): Promise<any> {
    // TODO: check why this is not working properly. Getting error: Unable to get transaction offset: Not Found
    // const data = await this.arweave.transactions.getData(transactionId, { decode: true, string: true });
    // return data;
    const response = await fetch('https://arweave.net/' + transactionId);
    const body = await response.json();
    return body;
  };

  public async getVaults(wallet: Wallet): Promise<any> {
    const address = await wallet.getAddress();
    const result = await this.executeQuery(membershipsQuery, { address });
    let vaults = []
    for (let edge of result?.transactions.edges) {
      const vaultId = edge.node.tags.filter(tag => tag.name === "Contract")[0]?.value;
      vaults.push(vaultId);
    }
    return vaults;
  }

  public async executeQuery(query: any, variables: any) {
    const client = new GraphQLClient(this.config.url + "/graphql", { headers: {} })
    const result = await client.request(query, variables);
    return result;
  };
}

export {
  ArweaveApi
}