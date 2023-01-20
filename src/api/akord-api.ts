import { Wallet, Keys } from "@akord/crypto";
import { GraphQLClient } from "graphql-request";
import gql from "graphql-tag";
import { ClientConfig } from "../config";
import { Api } from "./api";
import { apiConfig, ApiConfig } from "./config";
import * as queries from "./graphql/graphql";
import { ApiClient } from "./api-client";
import { Logger } from "../logger";
import { Membership } from "../types/membership";
import { ContractInput, ContractState, Tags } from "../types/contract";

export default class AkordApi extends Api {

  public config!: ApiConfig;
  public jwtToken: string;
  private gqlClient: any;

  constructor(config: ClientConfig, jwtToken: string) {
    super();
    this.config = apiConfig(config.env);
    this.jwtToken = jwtToken;
    this.initGqlClient()
  }

  public async uploadData(items: { data: any, tags: Tags, metadata?: any }[], shouldBundleTransaction?: boolean)
    : Promise<Array<{ id: string, resourceTx: string }>> {

    const resources = [];

    await Promise.all(items.map(async (item, index) => {
      const resource = await new ApiClient()
        .env(this.config)
        .auth(this.jwtToken)
        .data(item.data)
        .tags(item.tags)
        .bundle(shouldBundleTransaction)
        .metadata(item.metadata)
        .uploadState()
      Logger.log("Uploaded state with id: " + resource.id);
      resources[index] = resource;
    }));
    return resources;
  };

  public async postContractTransaction(contractId: string, input: ContractInput, tags: Tags, metadata?: any): Promise<string> {
    const txId = await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .contractId(contractId)
      .input(input)
      .metadata(metadata ? metadata : {})
      .tags(tags)
      .transaction()
    Logger.log("Uploaded contract interaction with id: " + txId);
    return txId;
  };

  public async getMembers(vaultId: string): Promise<Array<any>> {
    return await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .resourceId(vaultId)
      .getMembers();
  };

  public async initContractId(tags: Tags, state?: any): Promise<string> {
    const contractId = await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .tags(tags)
      .data(state)
      .contract()
    Logger.log("Created contract with id: " + contractId);
    return contractId;
  };

  public async getUserFromEmail(email: string): Promise<any> {
    const result = await this.executeRequest(queries.usersByEmail,
      {
        emails: [email]
      })
    return result.usersByEmail[0];
  };

  public async uploadFile(file: any, tags: Tags, isPublic?: boolean, shouldBundleTransaction?: boolean, progressHook?: (progress: number, data?: any) => void, cancelHook?: AbortController): Promise<{ resourceUrl: string, resourceTx: string }> {
    const resource = await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .data(file)
      .tags(tags)
      .public(isPublic)
      .bundle(shouldBundleTransaction)
      .progressHook(progressHook)
      .cancelHook(cancelHook)
      .uploadFile()
    Logger.log("Uploaded file with id: " + resource.id);

    return resource;
  };

  public async downloadFile(id: string, isPublic?: boolean, progressHook?: (progress: number, data?: any) => void, cancelHook?: AbortController, numberOfChunks?: number, loadedSize?: number, resourceSize?: number): Promise<any> {
    const { response } = await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .resourceId(id)
      .public(isPublic)
      .numberOfChunks(numberOfChunks)
      .progressHook(progressHook, loadedSize, resourceSize)
      .cancelHook(cancelHook)
      .asArrayBuffer()
      .downloadFile();

    let fileData: any;
    if (response.headers['x-amz-meta-encryptedkey']) {
      fileData = response.data;
    } else {
      fileData = Buffer.from(response.data).toJSON();
    }
    return { fileData: fileData, headers: response.headers };
  };

  public async getProfile(wallet: any): Promise<any> {
    const publicSigningKey = await wallet.signingPublicKey();
    const result = await this.paginatedQuery('profilesByPublicSigningKey',
      queries.profilesByPublicSigningKey,
      { publicSigningKey: publicSigningKey }, null)
    if (!result || result.length === 0) {
      return {};
      // throw new Error("Cannot find profile with the given public signing key.")
    }
    return result[0];
  };


  public async updateProfile(wallet: Wallet, name: string, avatarUri: string): Promise<void> {
    const address = await wallet.getAddress();
    await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .resourceId(address)
      .data({
        name: name,
        avatarUri: avatarUri
      })
      .updateProfile();
  };

  public async deleteVault(vaultId: string): Promise<void> {
    await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .resourceId(vaultId)
      .deleteVault();
  }

  public async inviteNewUser(vaultId: string, email: string, role: string): Promise<{ id: string }> {
    return await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .resourceId(vaultId)
      .data({
        email: email,
        role: role
      })
      .invite();
  }


  public async inviteResend(vaultId: string, membershipId: string): Promise<{ id: string }> {
    return await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .resourceId(vaultId)
      .data({
        membershipId: membershipId,
      })
      .invite();
  }

  public async getObject(objectId: string, objectType: string): Promise<any> {
    let queryName = "get" + objectType;
    const result = await this.executeRequest(queries[queryName],
      {
        id: objectId
      })
    const object = result && result[queryName === "getVault" ? "getDataRoom" : queryName];
    if (!object) {
      throw new Error("Cannot find object with id: " + objectId + " and type: " + objectType);
    }
    return { ...object, vaultId: object.dataRoomId };
  };

  public async getMembershipKeys(vaultId: string, wallet: Wallet): Promise<{ isEncrypted: boolean, keys: Array<Keys>, publicKey?: string }> {
    const publicSigningKey = await wallet.signingPublicKey();
    const result = await this.paginatedQuery('membershipsByMemberPublicSigningKey',
      queries.listVaults,
      { memberPublicSigningKey: publicSigningKey }, { dataRoomId: { eq: vaultId } });
    if (!result || result.length === 0) {
      throw new Error("Cannot find membership for vault: " + vaultId +
        ", with the given public signing key: " + publicSigningKey);
    }
    const membership = result[0];
    const publicKey = membership.dataRoom.publicKeys ? membership.dataRoom.publicKeys[membership.dataRoom.publicKeys.length - 1] : null
    return { isEncrypted: !membership.dataRoom.public, keys: membership.keys, publicKey: publicKey };
  };

  public async getNodeState(stateId: string): Promise<any> {
    const { response } = await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .resourceId(stateId)
      .downloadState()

    return response.data
  };

  public async getNode(id: string): Promise<any> {
    const response = await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .resourceId(id)
      .getNode()

    return response.data
  };

  public async getContractState(objectId: string): Promise<ContractState> {
    const contract = await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .contractId(objectId)
      .getContract();
    return contract.state;
  };

  public async getMemberships(wallet: Wallet): Promise<Array<Membership>> {
    const publicSigningKey = await wallet.signingPublicKey();
    const results = await this.paginatedQuery('membershipsByMemberPublicSigningKey',
      queries.membershipsByMemberPublicSigningKey,
      { memberPublicSigningKey: publicSigningKey }, { status: { eq: "ACCEPTED" } });
    return results.map((object: any) => ({ ...object, vaultId: object.dataRoomId }));
  };

  public async getVaults(wallet: Wallet): Promise<Array<any>> {
    const publicSigningKey = await wallet.signingPublicKey();
    const results = await this.paginatedQuery('membershipsByMemberPublicSigningKey',
      queries.listVaults,
      { memberPublicSigningKey: publicSigningKey }, { status: { eq: "ACCEPTED" } });
    return results.map((object: any) => ({ ...object.dataRoom, ...{ keys: object.keys } }));
  };

  public async getObjectsByVaultId(vaultId: string, objectType: string, shouldListAll = false): Promise<Array<any>> {
    let queryName = objectType.toLowerCase() + "sByDataRoomId";
    const results = await this.paginatedQuery(
      queryName,
      queries[queryName],
      {
        dataRoomId: vaultId
      }, this.filter(objectType, shouldListAll));
    return results.map((object: any) => {
      if (object.storageTransactions) {
        const versions = object.versions.map((version, idx) => (
          {
            ...version,
            status: object.storageTransactions.items.length > idx ? object.storageTransactions.items[idx].status : "REJECTED"
          }
        )
        );
        return { ...object, versions, vaultId: object.dataRoomId }
      }
      return { ...object, vaultId: object.dataRoomId }
    });
  };

  private filter(objectType: string, shouldListAll: boolean) {
    if (shouldListAll) {
      return {};
    } else {
      const filter = objectType === "Membership"
        ? {
          or: [
            { status: { eq: "ACCEPTED" } },
            { status: { eq: "PENDING" } }
          ]
        }
        : objectType === "Memo"
          ? {}
          :
          {
            status: { ne: "REVOKED" },
            and: {
              status: { ne: "DELETED" }
            }
          };
      return filter;
    }
  };

  private async executeRequest(request: string | readonly string[], variables: any) {
    try {
      const response = await this.gqlClient.request(
        gql(request),
        variables
      );
      return response;
    } catch (err) {
      Logger.log("Error while trying to make gql request");
      Logger.log(err);
      throw new Error(JSON.stringify(err));
    }
  };

  private async paginatedQuery(queryName: string | number, query: any, args: { [x: string]: any; }, filter: {}) {
    let variables = {
      filter: null,
      nextToken: null
    };
    for (let index in args) {
      variables[index] = args[index];
    }
    if (filter && Object.keys(filter).length != 0)
      variables.filter = filter;
    let queryResult = await this.executeRequest(query, variables);
    let nextToken = queryResult[queryName].nextToken;
    let results = queryResult[queryName].items;
    while (nextToken) {
      variables.nextToken = nextToken;
      queryResult = await this.executeRequest(query, variables);
      results = results.concat(queryResult[queryName].items);
      nextToken = queryResult[queryName].nextToken;
    }
    return results;
  };

  private initGqlClient() {
    this.gqlClient = new GraphQLClient(
      this.config.aws_appsync_graphqlEndpoint,
      {
        headers: {
          'Authorization': 'Bearer ' + this.jwtToken
        }
      }
    )
  }

  public async getTransactions(vaultId: string): Promise<Array<any>> {
    throw new Error("Method not implemented")
  }
}

export {
  AkordApi
}