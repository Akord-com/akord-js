import { Wallet, Keys } from "@akord/crypto";
import AWSAppSyncClient, { AUTH_TYPE } from "aws-appsync";
import gql from "graphql-tag";
import { ClientConfig } from "../../client-config";
import { Api } from "../api";
import { awsConfig, AWSConfig } from "./aws-config";
import * as queries from "./graphql/graphql";
import { PermapostExecutor } from "./permapost";
import { Logger } from "../../logger";
import { Vault } from "../../types/vault";
import { Membership } from "../../types/membership";
import { ContractState } from "../../types/contract";

export default class AkordApi extends Api {

  public config!: AWSConfig;
  public jwtToken: string;
  private gqlClient: any;

  constructor(config: ClientConfig, jwtToken: string) {
    super();
    this.config = awsConfig(config.env);
    this.jwtToken = jwtToken;
    this.initGqlClient()
  }

  public async uploadData(data: any[], shouldBundleTransaction?: boolean): Promise<Array<{ resourceId: string, resourceTx: string }>> {
    const resources = [];

    await Promise.all(data.map(async (item, index) => {
      const resource = await new PermapostExecutor()
        .env(this.config)
        .auth(this.jwtToken)
        .data(item.body)
        .tags(item.tags)
        .bundle(shouldBundleTransaction)
        .metadata(item.metadata)
        .uploadState()
      Logger.log("Uploaded state with id: " + resource.id);
      resources[index] = resource;
    }));
    return resources;
  };

  public async postContractTransaction(contractId: string, input: any, tags: any, metadata?: any): Promise<string> {
    const txId = await new PermapostExecutor()
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

  public async postLedgerTransaction(transactions: any): Promise<any> {
    const result = await this.executeMutation(queries.postLedgerTransaction,
      { transactions: transactions })
    return result.data.postLedgerTransaction[0];
  };

  public async preInviteCheck(emails: string[], vaultId: string): Promise<Array<{ address: string, publicKey: string, membership: Membership}>> {
    const result = await this.executeQuery(queries.preInviteCheck,
      { emails: emails, dataRoomId: vaultId })
    return result.data.preInviteCheck;
  };

  public async initContractId(tags: any, state?: any): Promise<string> {
    const contractId = await new PermapostExecutor()
      .env(this.config)
      .auth(this.jwtToken)
      .tags(tags)
      .data(state)
      .contract()
    Logger.log("Created contract with id: " + contractId);
    return contractId;
  };

  public async getUserFromEmail(email: string): Promise<any> {
    const result = await this.executeQuery(queries.usersByEmail,
      {
        emails: [email]
      })
    return result.data.usersByEmail[0];
  };

  public async uploadFile(file: any, tags: any, isPublic?: boolean, shouldBundleTransaction?: boolean, progressHook?: (progress: number) => void, cancelHook?: AbortController): Promise<{ resourceUrl: string, resourceTx: string }> {
    const resource = await new PermapostExecutor()
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

  public async downloadFile(id: string, isPublic?: boolean, progressHook?: (progress: number) => void, cancelHook?: AbortController, numberOfChunks?: number, loadedSize?: number, resourceSize?: number): Promise<any> {
    const { response } = await new PermapostExecutor()
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
      { publicSigningKey: publicSigningKey }, {})
    if (!result || result.length === 0) {
      return {};
      // throw new Error("Cannot find profile with the given public signing key.")
    }
    return result[0];
  };

  public async getObject(objectId: string, objectType: string): Promise<any> {
    let queryName = "get" + objectType;
    const result = await this.executeQuery(queries[queryName],
      {
        id: objectId
      })
    const object = result && result.data[queryName === "getVault" ? "getDataRoom" : queryName];
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
    const { response } = await new PermapostExecutor()
      .env(this.config)
      .auth(this.jwtToken)
      .resourceId(stateId)
      .downloadState()

    return response.data
  };

  public async getContractState(objectId: string): Promise<ContractState> {
    const contract = await new PermapostExecutor()
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

  public async getVaults(wallet: Wallet): Promise<Array<Vault>> {
    const publicSigningKey = await wallet.signingPublicKey();
    const results = await this.paginatedQuery('membershipsByMemberPublicSigningKey',
      queries.listVaults,
      { memberPublicSigningKey: publicSigningKey }, { status: { eq: "ACCEPTED" } });
    return results;
  };

  public async getObjectsByVaultId(vaultId: string, objectType: string): Promise<Array<any>> {
    let queryName = objectType.toLowerCase() + "sByDataRoomId";
    const filter = objectType === "Membership"
      ? { status: { eq: "ACCEPTED" } }
      : objectType === "Memo"
        ? {}
        :
        {
          status: { ne: "REVOKED" },
          and: {
            status: { ne: "DELETED" }
          }
        };
    const results = await this.paginatedQuery(
      queryName,
      queries[queryName],
      {
        dataRoomId: vaultId
      }, filter);
    return results.map((object: any) => ({ ...object, vaultId: object.dataRoomId }));
  };

  private async executeMutation(mutation: string | readonly string[], variables: any) {
    try {
      const response = await this.gqlClient.mutate({
        mutation: gql(mutation),
        variables,
        fetchPolicy: "no-cache",
      });
      return response;
    } catch (err) {
      Logger.log("Error while trying to mutate data");
      Logger.log(err);
      throw Error(JSON.stringify(err));
    }
  };

  private async executeQuery(query: string | readonly string[], variables: any) {
    try {
      const response = await this.gqlClient.query({
        query: gql(query),
        variables,
        fetchPolicy: "no-cache",
      });
      return response;
    } catch (err) {
      Logger.log("Error while trying to query data");
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
    let queryResult = await this.executeQuery(query, variables);
    let nextToken = queryResult.data[queryName].nextToken;
    let results = queryResult.data[queryName].items;
    while (nextToken) {
      variables.nextToken = nextToken;
      queryResult = await this.executeQuery(query, variables);
      results = results.concat(queryResult.data[queryName].items);
      nextToken = queryResult.data[queryName].nextToken;
    }
    return results;
  };

  private initGqlClient() {
    this.gqlClient = new AWSAppSyncClient({
      url: this.config.aws_appsync_graphqlEndpoint,
      region: this.config.aws_appsync_region,
      auth: {
        type: AUTH_TYPE.AMAZON_COGNITO_USER_POOLS,
        jwtToken: this.jwtToken
      },
      disableOffline: true
    });
  }
}

export {
  AkordApi
}
