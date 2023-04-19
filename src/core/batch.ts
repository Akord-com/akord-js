import { Service, ServiceFactory } from "../core";
import { v4 as uuidv4 } from "uuid";
import { MembershipCreateOptions, MembershipService, activeStatus } from "./membership";
import { StackCreateOptions, StackService } from "./stack";
import { NodeService } from "./node";
import { Node, NodeType, Stack } from "../types/node";
import { FileLike } from "../types/file";
import { BatchMembershipInviteResponse, BatchStackCreateResponse } from "../types/batch-response";
import { RoleType } from "../types/membership";

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
  public async revoke<T extends Node>(items: { id: string, type: NodeType }[]): Promise<{ transactionId: string }[]> {
    this.setGroupRef(items);
    const transactionIds = [] as { transactionId: string }[];
    await Promise.all(items.map(async (item) => {
      const service = new ServiceFactory(this.wallet, this.api, item.type).serviceInstance() as NodeService<T>;
      service.setGroupRef(this.groupRef);
      transactionIds.push(await service.revoke(item.id));
    }));
    return transactionIds;
  }

  /**
   * @param  {{id:string,type:NoteType}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async restore<T extends Node>(items: { id: string, type: NodeType }[]): Promise<{ transactionId: string }[]> {
    this.setGroupRef(items);
    const transactionIds = [] as { transactionId: string }[];
    await Promise.all(items.map(async (item) => {
      const service = new ServiceFactory(this.wallet, this.api, item.type).serviceInstance() as NodeService<T>;
      service.setGroupRef(this.groupRef);
      transactionIds.push(await service.restore(item.id));
    }));
    return transactionIds;
  }

  /**
   * @param  {{id:string,type:NodeType}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async delete<T extends Node>(items: { id: string, type: NodeType }[]): Promise<{ transactionId: string }[]> {
    this.setGroupRef(items);
    const transactionIds = [] as { transactionId: string }[];
    await Promise.all(items.map(async (item) => {
      const service = new ServiceFactory(this.wallet, this.api, item.type).serviceInstance() as NodeService<T>;
      service.setGroupRef(this.groupRef);
      transactionIds.push(await service.delete(item.id));
    }));
    return transactionIds;
  }

  /**
   * @param  {{id:string,type:NodeType}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async move<T extends Node>(items: { id: string, type: NodeType }[], parentId?: string): Promise<{ transactionId: string }[]> {
    this.setGroupRef(items);
    const transactionIds = [] as { transactionId: string }[];
    await Promise.all(items.map(async (item) => {
      const service = new ServiceFactory(this.wallet, this.api, item.type).serviceInstance() as NodeService<T>;
      service.setGroupRef(this.groupRef);
      transactionIds.push(await service.move(item.id, parentId));
    }));
    return transactionIds;
  }

  /**
   * @param  {{id:string,role:RoleType}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async membershipChangeRole(items: { id: string, role: RoleType }[]): Promise<{ transactionId: string }[]> {
    this.setGroupRef(items);
    const response = [] as { transactionId: string }[];
    await Promise.all(items.map(async (item) => {
      const service = new MembershipService(this.wallet, this.api);
      service.setGroupRef(this.groupRef);
      response.push(await service.changeRole(item.id, item.role));
    }));
    return response;
  }

  /**
   * @param  {string} vaultId
   * @param  {{file:FileLike,name:string}[]} items
   * @param  {BatchStackCreateOptions} [options]
   * @returns Promise with new stack ids & their corresponding transaction ids
   */
  public async stackCreate(
    vaultId: string,
    items: { file: FileLike, name: string }[],
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

    const data = [] as { stackId: string, transactionId: string, object: Stack }[];
    const errors = [] as { name: string, message: string }[];

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

    for (const chunk of [...chunks(items, BatchService.BATCH_CHUNK_SIZE)]) {
      await Promise.all(chunk.map(async (item) => {
        try {
          const service = new StackService(this.wallet, this.api);
          service.setGroupRef(this.groupRef);

          const stackResponse = await service.create(vaultId, item.file, item.name, options);
          if (options.cancelHook?.signal.aborted) {
            return { data, errors, cancelled: items.length - processedStacksCount };
          }
          data.push(stackResponse);
          processedStacksCount += 1;
          options.processingCountHook(processedStacksCount);
          if (options.onStackCreated) {
            await options.onStackCreated(stackResponse.object);
          }
        } catch (e) {
          errors.push({ name: item.name, message: e.toString() })
        };
      }))
      if (options.cancelHook?.signal.aborted) {
        return { data, errors, cancelled: items.length - processedStacksCount };
      }
    }
    return { data, errors, cancelled: 0 };
  }

  /**
   * @param  {string} vaultId
   * @param  {{email:string,role:RoleType}[]} items
   * @param  {string} [message] optional email message - unencrypted
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

  public setGroupRef(items: any) {
    this.groupRef = items && items.length > 1 ? uuidv4() : null;
  }
}

export type BatchStackCreateOptions = StackCreateOptions & {
  processingCountHook?: (count: number) => void,
  onStackCreated?: (item: Stack) => Promise<void>
};

export {
  BatchService
}
