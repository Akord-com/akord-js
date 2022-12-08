import { ClientConfig } from "../../client-config";
import { arweaveConfig, ArweaveConfig } from "./arweave-config";
import { Api } from "../api";
import {
  postContractTransaction,
  initContract,
  getContract,
  prepareArweaveTransaction,
  uploadChunksArweaveTransaction,
  getPublicKeyFromAddress,
} from "./arweave-helpers";
import { GraphQLClient } from "graphql-request";
import { membershipsQuery, nodeQuery, timelineQuery } from "./graphql";
import Arweave from "arweave";
import { Keys, Wallet } from "@akord/crypto";
import { ContractInput, ContractState, Tag, Tags } from "../../types/contract";
import { srcTxId } from './config';
import Bundlr from "@bundlr-network/client";
import { Vault } from "../../types/vault";
import { Membership } from "../../types/membership";
import { NodeLike } from "../../types/node";

export default class ArweaveApi extends Api {
  public config!: ArweaveConfig;
  private jwk!: object;
  public arweave: Arweave

  constructor(config: ClientConfig, jwk: any) {
    super();
    this.config = arweaveConfig(config.network);
    this.jwk = jwk;
    this.arweave = Arweave.init(this.config);
  }

  public getConfig() {
    return this.config;
  }

  public async postContractTransaction(contractId: string, input: ContractInput, tags: Tags): Promise<string> {
    const { txId } = await postContractTransaction(
      contractId,
      input,
      tags,
      this.jwk
    );
    return txId;
  };

  public async initContractId(tags: Tags, state?: any): Promise<string> {
    return initContract(srcTxId, tags, state, this.jwk);
  };

  public async getUserFromEmail(address: string): Promise<{ address: string, publicKey: string }> {
    return { address, publicKey: await getPublicKeyFromAddress(address) };
  };

  public async getProfile(wallet: Wallet): Promise<any> {
    return null;
  }

  public async uploadFile(file: ArrayBufferLike, tags: Tags): Promise<{ resourceTx: string }> {
    const transaction = await prepareArweaveTransaction(
      file,
      tags,
      this.jwk
    );
    await uploadChunksArweaveTransaction(transaction);
    return { resourceTx: transaction.id };
  };

  public async uploadData(items: { data: any, tags: Tags }[]): Promise<Array<{ id: string, resourceTx: string }>> {
    let resourceTxs = [];

    const bundlr = new Bundlr("https://node1.bundlr.network", "arweave", this.jwk);

    for (let item of items) {
      const tags = [new Tag("Content-Type", "application/json")].concat(item.tags);
      const filteredTags = tags.filter((tag) =>
        tag.name !== "Public-Key"
      )
      const transaction = bundlr.createTransaction(JSON.stringify(item.data), { tags: filteredTags });
      await transaction.sign();
      const txId = (await transaction.upload()).id;
      console.log("Transaction submitted to Bundlr Network, instantly accessible from https://arweave.net/" + txId);
      // data instantly accessible from https://arweave.net/{id}
      resourceTxs.push({ id: txId });
    }
    return resourceTxs;
  };

  public async getContractState(contractId: string): Promise<ContractState> {
    const contractObject = getContract(contractId, null);
    const contract = (await contractObject.readState()).cachedValue;
    let vault = contract.state;
    const vaultData = await this.downloadFile(vault.data[vault.data.length - 1])
    vault = { ...vault, ...vaultData };
    await this.downloadMemberships(vault)
    await this.downloadNodes(vault)
    return vault;
  };

  private async downloadMemberships(vault: ContractState) {
    for (let membership of vault.memberships) {
      const dataTx = membership.data[membership.data.length - 1];
      const state = await this.downloadFile(dataTx);
      membership = { ...membership, ...state };
    }
  }

  private async downloadNodes(vault: ContractState) {
    vault.folders = [];
    vault.stacks = [];
    vault.notes = [];
    vault.memos = [];
    for (let node of vault.nodes) {
      const dataTx = node.data[node.data.length - 1];
      const state = await this.downloadFile(dataTx);
      node = { ...node, ...state };
      vault[node.type.toLowerCase() + "s"].push(node);
    }
  }

  public async getMembershipKeys(vaultId: string, wallet: Wallet): Promise<{ isEncrypted: boolean, keys: Array<Keys>, publicKey?: string }> {
    const state = await this.getContractState(vaultId);
    const address = await wallet.getAddress();
    const membership = state.memberships.find(member => member.address === address);
    const dataTx = membership.data[membership.data.length - 1];
    const data = await this.getTransactionData(dataTx);
    return { isEncrypted: !state.public, keys: data.keys };
  };

  public async getObjectsByVaultId(vaultId: string, objectType: string, shouldListAll = false): Promise<Array<any>> {
    const state = await this.getContractState(vaultId);
    let results: any;
    if (objectType === "Membership") {
      results = await Promise.all(state.memberships.map(async (membership) => {
        const object = membership;
        const dataTx = membership.data[membership.data.length - 1];
        delete object.data;
        const data = await this.getTransactionData(dataTx);
        object.state = data;
        return object
      }));
    } else {
      results = await Promise.all(state.node
        .filter((node: NodeLike) => node.type === objectType && (shouldListAll ? true : node.status === "ACTIVE"))
        .map(async (node: NodeLike) => {
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

  public async getObject(objectId: string, objectType: string, vaultId: string): Promise<any> {
    let contractId = vaultId;
    if (!vaultId) {
      const result = await this.executeQuery(nodeQuery, { nodeId: objectId });
      for (let edge of result?.transactions.edges) {
        const vaultId = edge.node.tags.find((tag: any) => tag.name === "Contract")?.value;
        contractId = vaultId;
      }
    }
    const state = await this.getContractState(contractId);
    if (objectType === "Vault") {
      const dataTx = state.data[state.data.length - 1];
      const data = await this.getTransactionData(dataTx);
      return { ...state, ...data };
    } else if (objectType === "Membership") {
      const membership = state.memberships.find((membership) => membership.id === objectId);
      const dataTx = membership.data[membership.data.length - 1];
      const data = await this.getTransactionData(dataTx);
      return { ...membership, ...data, vaultId: contractId };
    } else {
      const node = state.nodes.find((node) => node.id === objectId);
      const dataTx = node.data[node.data.length - 1];
      const data = await this.getTransactionData(dataTx);
      return { ...node, ...data, vaultId: contractId };
    };
  }

  public async getNodeState(stateId: string): Promise<any> {
    return this.getTransactionData(stateId);
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

  public async getVaults(wallet: Wallet): Promise<Array<Vault>> {
    const address = await wallet.getAddress();
    const result = await this.executeQuery(membershipsQuery, { address });
    let vaults = []
    for (let edge of result?.transactions.edges) {
      const vaultId = edge.node.tags.find((tag: any) => tag.name === "Contract")?.value;
      const state = await this.getContractState(vaultId);
      const dataTx = state.data[state.data.length - 1];
      const data = await this.getTransactionData(dataTx);
      vaults.push({ ...state, ...data });
    }
    return vaults;
  }

  public async getMemberships(wallet: Wallet): Promise<Array<Membership>> {
    const address = await wallet.getAddress();
    const result = await this.executeQuery(membershipsQuery, { address });
    let memberships = []
    for (let edge of result?.transactions.edges) {
      const vaultId = edge.node.tags.find((tag: any) => tag.name === "Contract")?.value;
      const state = await this.getContractState(vaultId);
      const membership = state.memberships.find(member => member.address === address);
      const dataTx = membership.data[membership.data.length - 1];
      const data = await this.getTransactionData(dataTx);
      memberships.push({ ...membership, ...data });
    }
    return memberships;
  }

  public async executeQuery(query: any, variables: any) {
    const client = new GraphQLClient(this.config.url + "/graphql", { headers: {} })
    const result = await client.request(query, variables);
    return result;
  };

  public async preInviteCheck(addresses: string[], vaultId: string): Promise<Array<{ address: string, publicKey: string, membership: Membership }>> {
    const state = await this.getContractState(vaultId);
    return await Promise.all(addresses.map(async (address) => ({
      address: address,
      publicKey: await getPublicKeyFromAddress(address),
      membership: state.memberships.find(member => member.address === address)
    })));
  };

  public async getTransactions(vaultId: string): Promise<Array<any>> {
    const result = await this.executeQuery(timelineQuery, { vaultId });
    return result.transactions.edges.map((edge: any) => ({
      id: edge.node.id,
      tags: edge.node.tags
    }));
  }
}

export {
  ArweaveApi
}