import { Service, ServiceFactory } from "../service";
import { v4 as uuidv4 } from "uuid";
import { MembershipService } from "./membership";
import { StackService } from "./stack";

class BatchService extends Service {
  /**
   * @param  {{id:string,objectType:string}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async revoke(items: { id: string, objectType: string }[]): Promise<{ transactionId: string }[]> {
    this.setGroupRef(items);
    const transactionIds = [] as { transactionId: string }[];
    await Promise.all(items.map(async (item) => {
      const service = new ServiceFactory(this.wallet, this.api, item.objectType).serviceInstance();
      service.setGroupRef(this.groupRef);
      transactionIds.push(await service.revoke(item.id));
    }));
    return transactionIds;
  }

  /**
   * @param  {{id:string,objectType:string}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async restore(items: { id: string, objectType: string }[]): Promise<{ transactionId: string }[]> {
    this.setGroupRef(items);
    const transactionIds = [] as { transactionId: string }[];
    await Promise.all(items.map(async (item) => {
      const service = new ServiceFactory(this.wallet, this.api, item.objectType).serviceInstance();
      service.setGroupRef(this.groupRef);
      transactionIds.push(await service.restore(item.id));
    }));
    return transactionIds;
  }

  /**
   * @param  {{id:string,objectType:string}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async delete(items: { id: string, objectType: string }[]): Promise<{ transactionId: string }[]> {
    this.setGroupRef(items);
    const transactionIds = [] as { transactionId: string }[];
    await Promise.all(items.map(async (item) => {
      const service = new ServiceFactory(this.wallet, this.api, item.objectType).serviceInstance();
      service.setGroupRef(this.groupRef);
      transactionIds.push(await service.delete(item.id));
    }));
    return transactionIds;
  }

  /**
   * @param  {{id:string,objectType:string}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async move(items: { id: string, objectType: string }[], parentId?: string): Promise<{ transactionId: string }[]> {
    this.setGroupRef(items);
    const transactionIds = [] as { transactionId: string }[];
    await Promise.all(items.map(async (item) => {
      const service = new ServiceFactory(this.wallet, this.api, item.objectType).serviceInstance();
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
    items: { file: any, name: string }[],
    parentId?: string,
    progressHook?: (progress: number) => void,
    cancelHook?: AbortController
  ): Promise<{
    stackId: string,
    transactionId: string
  }[]> {
    this.setGroupRef(items);
    const response = [] as { stackId: string, transactionId: string }[];
    await Promise.all(items.map(async (item) => {
      const service = new StackService(this.wallet, this.api);
      service.setGroupRef(this.groupRef);
      response.push(await service.create(vaultId, item.file, item.name, parentId, progressHook, cancelHook));
    }));
    return response;
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
        response.push(await service.inviteNewUser(vaultId, email, role));
      }
    }));
    return response;
  }

  public setGroupRef(items: any) {
    return items && items.length > 1 ? uuidv4() : null;
  }
}

export {
  BatchService
}