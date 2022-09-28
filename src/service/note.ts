import { NodeService } from "./node";
import { actionRefs, commands, objectTypes } from "../constants";

class NoteService extends NodeService {
  objectType: string = objectTypes.NOTE;

  /**
   * @param  {string} vaultId
   * @param  {string} name note name
   * @param  {any} content JSON note content
   * @param  {string} [parentId] parent folder id
   * @returns Promise with new note id & corresponding transaction id
   */
  public async create(vaultId: string, name: string, content: any, parentId?: string): Promise<{
    noteId: string,
    transactionId: string
  }> {
    await this.setVaultContext(vaultId);
    this.setActionRef(actionRefs.NOTE_CREATE);
    this.setCommand(commands.NODE_CREATE);
    const body = {
      revisions: [{
        title: await this.processWriteString(name),
        content: await this.processWriteString(JSON.stringify(content)),
        size: Buffer.byteLength(content, 'utf8'),
        postedAt: new Date()
      }]
    };
    const { nodeId, transactionId } = await this.nodeCreate(body, {
      parent: parentId
    });
    return { noteId: nodeId, transactionId };
  }

  /**
  * @param  {string} noteId
  * @param  {string} name note name
  * @param  {string} content JSON note content
  * @returns Promise with corresponding transaction id
  */
  public async uploadRevision(noteId: string, name: string, content: string): Promise<{
    transactionId: string
  }> {
    await this.setVaultContextFromObjectId(noteId, this.objectType);
    this.setActionRef(actionRefs.NOTE_UPLOAD_REVISION);
    const body = {
      revisions: [{
        title: await this.processWriteString(name),
        content: await this.processWriteString(JSON.stringify(content)),
        size: Buffer.byteLength(content, 'utf8'),
        postedAt: new Date()
      }]
    };
    this.setCommand(commands.NODE_UPDATE);
    return this.nodeUpdate(body);
  }
};

export {
  NoteService
}