import { Service, ServiceFactory } from "../core";
import { v4 as uuidv4 } from "uuid";
import { MembershipService } from "./membership";
import { StackService } from "./stack";
import { NodeService } from "./node";
import { Node } from "../types/node";
import { FileLike } from "../types/file";
import { BatchStackCreateResponse } from "../types/batch-response";

function* chunks<T>(arr: T[], n: number): Generator<T[], void> {
  for (let i = 0; i < arr.length; i += n) {
    yield arr.slice(i, i + n);
  }
}

class BatchService extends Service {

  public static BATCH_CHUNK_SIZE = 50;

  /**
   * @param  {{id:string,objectType:string}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async revoke<T extends Node>(items: { id: string, objectType: string }[]): Promise<{ transactionId: string }[]> {
    this.setGroupRef(items);
    const transactionIds = [] as { transactionId: string }[];
    await Promise.all(items.map(async (item) => {
      const service = new ServiceFactory(this.wallet, this.api, item.objectType).serviceInstance() as NodeService<T>;
      service.setGroupRef(this.groupRef);
      transactionIds.push(await service.revoke(item.id));
    }));
    return transactionIds;
  }

  /**
   * @param  {{id:string,objectType:string}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async restore<T extends Node>(items: { id: string, objectType: string }[]): Promise<{ transactionId: string }[]> {
    this.setGroupRef(items);
    const transactionIds = [] as { transactionId: string }[];
    await Promise.all(items.map(async (item) => {
      const service = new ServiceFactory(this.wallet, this.api, item.objectType).serviceInstance() as NodeService<T>;
      service.setGroupRef(this.groupRef);
      transactionIds.push(await service.restore(item.id));
    }));
    return transactionIds;
  }

  /**
   * @param  {{id:string,objectType:string}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async delete<T extends Node>(items: { id: string, objectType: string }[]): Promise<{ transactionId: string }[]> {
    this.setGroupRef(items);
    const transactionIds = [] as { transactionId: string }[];
    await Promise.all(items.map(async (item) => {
      const service = new ServiceFactory(this.wallet, this.api, item.objectType).serviceInstance() as NodeService<T>;
      service.setGroupRef(this.groupRef);
      transactionIds.push(await service.delete(item.id));
    }));
    return transactionIds;
  }

  /**
   * @param  {{id:string,objectType:string}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async move<T extends Node>(items: { id: string, objectType: string }[], parentId?: string): Promise<{ transactionId: string }[]> {
    this.setGroupRef(items);
    const transactionIds = [] as { transactionId: string }[];
    await Promise.all(items.map(async (item) => {
      const service = new ServiceFactory(this.wallet, this.api, item.objectType).serviceInstance() as NodeService<T>;
      service.setGroupRef(this.groupRef);
      transactionIds.push(await service.move(item.id, parentId));
    }));
    return transactionIds;
  }

  /**
   * @param  {{id:string,role:string}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async membershipChangeRole(items: { id: string, role: string }[]): Promise<{ transactionId: string }[]> {
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
   * @param  {{file:any,name:string}[]} items
   * @param  {string} [parentId]
   * @param  {(progress:number)=>void} [progressHook]
   * @param  {AbortController} [cancelHook]
   * @returns Promise with new stack ids & their corresponding transaction ids
   */
  public async stackCreate(
    vaultId: string,
    items: { file: FileLike, name: string, parentId?: string }[],
    progressHook?: (progress: number) => void,
    cancelHook?: AbortController,
    processingCountHook?: (count: number) => void,
    onStackCreated?: (item: { file: FileLike, name: string, parentId?: string }) => Promise<void>
  ): Promise<BatchStackCreateResponse> {
    const size = items.reduce((sum, stack) => {
      return sum + stack.file.size;
    }, 0);
    let progress = 0;
    let processedStacksCount = 0;
    const perFileProgress = new Map();
    this.setGroupRef(items);
    if (processingCountHook) {
      processingCountHook(processedStacksCount);
    }


    const data = [] as { stackId: string, transactionId: string }[];
    const errors = [] as { name: string, message: string }[];

    const stackProgressHook = (localProgress: number, data: any) => {
      const stackBytesUploaded = Math.floor(localProgress / 100 * data.total)
      progress += stackBytesUploaded - (perFileProgress.get(data.id) || 0)
      perFileProgress.set(data.id, stackBytesUploaded);
      progressHook(Math.min(100, Math.round(progress / size * 100)));
    }

    for (const chunk of [...chunks(items, BatchService.BATCH_CHUNK_SIZE)]) {
      await Promise.all(chunk.map(async (item) => {
        try {
          const service = new StackService(this.wallet, this.api);
          service.setGroupRef(this.groupRef);

          const stackResponse = await service.create(vaultId, item.file, item.name, item.parentId, stackProgressHook, cancelHook);
          if (cancelHook.signal.aborted) {
            return { data, errors, cancelled: items.length - processedStacksCount };
          }
          data.push(stackResponse);
          processedStacksCount += 1;
          processingCountHook(processedStacksCount);
          if (onStackCreated) {
            await onStackCreated(item);
          }
        } catch (e) {
          errors.push({ name: item.name, message: e.toString() })
        };
      }))
      if (cancelHook.signal.aborted) {
        return { data, errors, cancelled: items.length - processedStacksCount };
      }
    }
    return { data, errors, cancelled: 0 };
  }

  /**
   * @param  {string} vaultId
   * @param  {{email:string,role:string}[]} items
   * @returns Promise with new membership ids & their corresponding transaction ids
   */
  public async membershipInvite(vaultId: string, items: { email: string, role: string }[]): Promise<{
    membershipId: string,
    transactionId: string
  }[]> {
    this.setGroupRef(items);
    const emails = items.reduce((accumulator, currentValue) => {
      accumulator.push(currentValue.email);
      return accumulator;
    }, []);
    const results = await this.api.preInviteCheck(emails, vaultId);
    const response = [] as { membershipId: string, transactionId: string }[];

    await Promise.all(items.map(async (item, index) => {
      if (results[index].membership) {
        throw new Error("Membership already exists for this user.");
      }
      const { email, role } = item;
      const userHasAccount = results[index].publicKey;
      const service = new MembershipService(this.wallet, this.api);
      service.setGroupRef(this.groupRef);
      if (userHasAccount) {
        response.push(await service.invite(vaultId, email, role));
      } else {
        response.push({
          ...(await service.inviteNewUser(vaultId, email, role)),
          transactionId: null
        })
      }
    }
    ));
    return response;
  }

  public setGroupRef(items: any) {
    return items && items.length > 1 ? uuidv4() : null;
  }
}

export {
  BatchService
}
