import { NodeService } from "./node";
import { actionRefs, functions, objectTypes } from "../constants";
import { FileService } from "./file";
import { Note } from "../types/node";

class NoteService extends NodeService<Note> {
  public fileService = new FileService(this.wallet, this.api);
  objectType: string = objectTypes.NOTE;
  NodeType = Note;

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
    this.setFunction(functions.NODE_CREATE);
    const body = {
      versions: [await this.uploadNewNoteVersion(name, content)]
    };
    const { nodeId, transactionId } = await this.nodeCreate(body, { parentId });
    return { noteId: nodeId, transactionId };
  }

  /**
  * @param  {string} noteId
  * @param  {string} name note name
  * @param  {any} content JSON note content
  * @returns Promise with corresponding transaction id
  */
  public async uploadRevision(noteId: string, name: string, content: any): Promise<{
    transactionId: string
  }> {
    await this.setVaultContextFromObjectId(noteId, this.objectType);
    this.setActionRef(actionRefs.NOTE_UPLOAD_REVISION);
    const body = {
      versions: [await this.uploadNewNoteVersion(name, content)]
    };
    this.setFunction(functions.NODE_UPDATE);
    return this.nodeUpdate(body);
  }

  /**
   * Get note version by index, return the latest version by default
   * @param  {string} noteId
   * @param  {string} [index] note version index
   * @returns Promise with version name & data buffer
   */
  public async getVersion(noteId: string, index?: string): Promise<{ name: string, data: ArrayBuffer }> {
    const note = await this.api.getObject<Note>(noteId, objectTypes.NOTE);
    let version: any;
    if (index) {
      if (note.versions && note.versions[index]) {
        version = note.versions[index];
      } else {
        throw new Error("Given index: " + index + " does not exist for note: " + noteId);
      }
    } else {
      version = note.versions[note.versions.length - 1];
    }
    await this.setVaultContext(note.vaultId);
    const { fileData, headers } = await this.api.downloadFile(version.resourceUrl, this.isPublic);
    const data = await this.processReadRaw(fileData, headers);
    const name = await this.processReadString(version.name);
    return { name, data };
  }

  private async uploadNewNoteVersion(name: string, content: any) {
    const { resourceTx, resourceUrl, resourceHash } = await this.fileService.create(content, true);

    const version = {
      createdAt: JSON.stringify(Date.now()),
      name: await this.processWriteString(name),
      type: "application/rtf",
      size: Buffer.byteLength(content, 'utf8'),
      resourceUri: [`arweave:${resourceTx}`, `hash:${resourceHash}`, `s3:${resourceUrl}`]
    }
    return version;
  }

  public async setVaultContext(vaultId: string): Promise<void> {
    await super.setVaultContext(vaultId);
    this.fileService.setKeys(this.membershipKeys);
    this.fileService.setRawDataEncryptionPublicKey(this.dataEncrypter.publicKey);
    this.fileService.setVaultId(this.vaultId);
    this.fileService.setIsPublic(this.isPublic);
  }
};

export {
  NoteService
}