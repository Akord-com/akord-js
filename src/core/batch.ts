import { Service } from "../core";
import { v4 as uuidv4 } from "uuid";
import { MembershipCreateOptions, MembershipService, activeStatus } from "./membership";
import { StackCreateOptions, StackService } from "./stack";
import { Node, NodeLike, NodeType, Stack } from "../types/node";
import { FileLike } from "../types/file";
import { BatchMembershipInviteResponse, BatchStackCreateResponse } from "../types/batch-response";
import { Membership, RoleType } from "../types/membership";
import { Hooks } from "./file";
import { actionRefs, functions, objectType, protocolTags } from "../constants";
import { ContractInput, Tag, Tags } from "../types/contract";
import { ObjectType } from "../types/object";
import { IncorrectEncryptionKey } from "../errors/incorrect-encryption-key";
import { NodeService } from "./node";

function* chunks<T>(arr: T[], n: number): Generator<T[], void> {
  for (let i = 0; i < arr.length; i += n) {
    yield arr.slice(i, i + n);
  }
}

class BatchService extends Service {

  public static BATCH_CHUNK_SIZE = 50;

  /**
   * @param  {{id:string,type:NoteType}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async revoke<T extends Node>(items: { id: string, type: NodeType }[])
    : Promise<{ transactionId: string, object: T }[]> {
    return this.batchUpdate<T>(items.map((item) => ({
      ...item,
      input: { function: functions.NODE_REVOKE },
      actionRef: item.type.toUpperCase() + "_REVOKE"
    })));
  }

  /**
   * @param  {{id:string,type:NoteType}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async restore<T extends Node>(items: { id: string, type: NodeType }[])
    : Promise<{ transactionId: string, object: T }[]> {
    return this.batchUpdate<T>(items.map((item) => ({
      ...item,
      input: { function: functions.NODE_RESTORE },
      actionRef: item.type.toUpperCase() + "_RESTORE"
    })));
  }

  /**
   * @param  {{id:string,type:NodeType}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async delete<T extends Node>(items: { id: string, type: NodeType }[])
    : Promise<{ transactionId: string, object: T }[]> {
    return this.batchUpdate<T>(items.map((item) => ({
      ...item,
      input: { function: functions.NODE_DELETE },
      actionRef: item.type.toUpperCase() + "_DELETE"
    })));
  }

  /**
   * @param  {{id:string,type:NodeType}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async move<T extends Node>(items: { id: string, type: NodeType }[], parentId?: string)
    : Promise<{ transactionId: string, object: T }[]> {
    return this.batchUpdate<T>(items.map((item) => ({
      ...item,
      input: {
        function: functions.NODE_MOVE,
        parentId: parentId
      },
      actionRef: item.type.toUpperCase() + "_MOVE"
    })));
  }

  /**
   * @param  {{id:string,role:RoleType}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async membershipChangeRole(items: { id: string, role: RoleType }[])
    : Promise<{ transactionId: string, object: Membership }[]> {
    return this.batchUpdate<Membership>(items.map((item) => ({
      id: item.id,
      type: objectType.MEMBERSHIP,
      input: {
        function: functions.MEMBERSHIP_CHANGE_ROLE,
        role: item.role
      },
      actionRef: actionRefs.MEMBERSHIP_CHANGE_ROLE
    })));
  }

  /**
   * @param  {string} vaultId
   * @param  {{file:FileLike,name:string,options:StackCreateOptions}[]} items
   * @param  {BatchStackCreateOptions} [options]
   * @returns Promise with new stack ids & their corresponding transaction ids
   */
  public async stackCreate(
    vaultId: string,
    items: { file: FileLike, name: string, options?: StackCreateOptions }[],
    options: BatchStackCreateOptions = {}
  ): Promise<BatchStackCreateResponse> {
    const size = items.reduce((sum, stack) => {
      return sum + stack.file.size;
    }, 0);
    let progress = 0;
    let processedStacksCount = 0;
    const perFileProgress = new Map();
    this.setGroupRef(items);
    if (options.processingCountHook) {
      options.processingCountHook(processedStacksCount);
    }

    let data = [] as BatchStackCreateResponse["data"];
    const errors = [] as BatchStackCreateResponse["errors"];

    if (options.progressHook) {
      const onProgress = options.progressHook
      const stackProgressHook = (localProgress: number, data: any) => {
        const stackBytesUploaded = Math.floor(localProgress / 100 * data.total)
        progress += stackBytesUploaded - (perFileProgress.get(data.id) || 0)
        perFileProgress.set(data.id, stackBytesUploaded);
        onProgress(Math.min(100, Math.round(progress / size * 100)));
      }
      options.progressHook = stackProgressHook;
    }

    const vault = await this.api.getVault(vaultId);
    this.setVault(vault);
    this.setVaultId(vaultId);
    this.setIsPublic(vault.public);
    await this.setMembershipKeys(vault);

    const stackCreateOptions = {
      ...options,
      cacheOnly: this.vault.cacheOnly
    }

    for (const chunk of [...chunks(items, BatchService.BATCH_CHUNK_SIZE)]) {
      const transactions = [] as {
        vaultId: string,
        input: ContractInput,
        tags: Tags,
        item: { file: FileLike, name: string, options?: StackCreateOptions }
      }[];

      // upload file data & metadata
      await Promise.all(chunk.map(async (item) => {
        const service = new StackService(this.wallet, this.api);
        service.setVault(vault);
        service.setVaultId(vaultId);
        service.setIsPublic(vault.public);
        await service.setMembershipKeys(vault);
        service.setVaultContextForFile();
        service.setActionRef(actionRefs.STACK_CREATE);
        service.setFunction(functions.NODE_CREATE);
        service.setGroupRef(this.groupRef);

        const nodeId = uuidv4();
        service.setObjectId(nodeId);

        const createOptions = {
          ...stackCreateOptions,
          ...(item.options || {})
        }
        service.setAkordTags((service.isPublic ? [item.name] : []).concat(createOptions.tags));
        service.arweaveTags = await service.getTxTags();
        service.arweaveTags.push(new Tag(
          protocolTags.PARENT_ID,
          createOptions.parentId ? createOptions.parentId : "root"
        ));

        const state = {
          name: await service.processWriteString(item.name ? item.name : item.file.name),
          versions: [await service.uploadNewFileVersion(item.file, createOptions)],
          tags: service.tags
        };
        const id = await service.uploadState(state);
        const input = {
          function: service.function,
          data: id,
          parentId: createOptions.parentId
        }
        // queue the stack transaction for posting
        transactions.push({
          vaultId: service.vaultId,
          input: input,
          tags: service.arweaveTags,
          item
        });
      }
      ));

      let currentTx: {
        vaultId: string,
        input: ContractInput,
        tags: Tags,
        item: { file: FileLike, name: string, options?: StackCreateOptions }
      };
      while (processedStacksCount < items.length) {
        if (options.cancelHook?.signal.aborted) {
          return { data, errors, cancelled: items.length - processedStacksCount };
        }
        if (transactions.length === 0) {
          // wait for a while if the queue is empty before checking again
          await new Promise((resolve) => setTimeout(resolve, 100));
        } else {
          try {
            currentTx = transactions.shift();
            // process the dequeued stack transaction
            const { id, object } = await this.api.postContractTransaction<Stack>(
              currentTx.vaultId,
              currentTx.input,
              currentTx.tags
            );
            processedStacksCount += 1;
            if (options.processingCountHook) {
              options.processingCountHook(processedStacksCount);
            }
            if (options.onStackCreated) {
              await options.onStackCreated(object);
            }
            const stack = new Stack(object, this.keys);
            if (!this.isPublic) {
              try {
                await stack.decrypt();
              } catch (error) {
                throw new IncorrectEncryptionKey(error);
              }
            }
            data.push({ transactionId: id, object: stack, stackId: object.id });
            if (options.cancelHook?.signal.aborted) {
              return { data, errors, cancelled: items.length - processedStacksCount };
            }
          } catch (error) {
            errors.push({ name: currentTx.item.name, message: error.toString(), error });
          };
        }
      }
      if (options.cancelHook?.signal.aborted) {
        return { data, errors, cancelled: items.length - processedStacksCount };
      }
    }
    return { data, errors, cancelled: 0 };
  }

  /**
   * @param  {string} vaultId
   * @param  {{email:string,role:RoleType}[]} items
   * @param  {MembershipCreateOptions} [options] invitation email message, etc.
   * @returns Promise with new membership ids & their corresponding transaction ids
   */
  public async membershipInvite(vaultId: string, items: { email: string, role: RoleType }[], options: MembershipCreateOptions = {}): Promise<BatchMembershipInviteResponse> {
    this.setGroupRef(items);
    const members = await this.api.getMembers(vaultId);
    const data = [] as { membershipId: string, transactionId: string }[];
    const errors = [];

    await Promise.all(items.map(async (item) => {
      const email = item.email.toLowerCase();
      const role = item.role;
      const member = members.find(item => item.email?.toLowerCase() === email);
      if (member && activeStatus.includes(member.status)) {
        errors.push({ email: email, message: "Membership already exists for this user." });
      } else {
        const userHasAccount = await this.api.existsUser(email);
        const service = new MembershipService(this.wallet, this.api);
        service.setGroupRef(this.groupRef);
        if (userHasAccount) {
          data.push(await service.invite(vaultId, email, role, options));
        } else {
          data.push({
            ...(await service.inviteNewUser(vaultId, email, role, options)),
            transactionId: null
          })
        }
      }
    }
    ));
    return { data: data, errors: errors };
  }

  private async batchUpdate<T>(items: { id: string, type: ObjectType, input: ContractInput, actionRef: string }[])
    : Promise<{ transactionId: string, object: T }[]> {
    this.setGroupRef(items);
    const result = [] as { transactionId: string, object: T }[];
    for (const [itemIndex, item] of items.entries()) {
      const node = item.type === objectType.MEMBERSHIP
        ? await this.api.getMembership(item.id)
        : await this.api.getNode<NodeLike>(item.id, item.type);

      const service = item.type === objectType.MEMBERSHIP
        ? new MembershipService(this.wallet, this.api)
        : new NodeService<T>(this.wallet, this.api);
      if (itemIndex === 0 || this.vaultId !== node.vaultId) {
        this.setVaultId(node.vaultId);
        this.setIsPublic(node.__public__);
        await this.setMembershipKeys(node);
      }
      service.setVaultId(this.vaultId);
      service.setIsPublic(this.isPublic);
      await service.setMembershipKeys(node);
      service.setFunction(item.input.function);
      service.setActionRef(item.actionRef);
      service.setObject(node);
      service.setObjectId(item.id);
      service.setObjectType(item.type);
      service.arweaveTags = await service.getTxTags();
      const { id, object } = await this.api.postContractTransaction<T>(this.vaultId, item.input, service.arweaveTags);
      const processedObject = item.type === objectType.MEMBERSHIP
        ? await (<MembershipService>service).processMembership(object as Membership, !this.isPublic, this.keys)
        : await (<NodeService<T>>service).processNode(object as any, !this.isPublic, this.keys) as any;
      result.push({ transactionId: id, object: processedObject });
    }
    return result;
  }

  public setGroupRef(items: any) {
    this.groupRef = items && items.length > 1 ? uuidv4() : null;
  }
}

export type BatchStackCreateOptions = Hooks & {
  processingCountHook?: (count: number) => void,
  onStackCreated?: (item: Stack) => Promise<void>
};

export {
  BatchService
}
