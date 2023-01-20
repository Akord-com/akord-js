import { NodeService } from "./node";
import { Stack } from "../types/node";
import { StackService } from "./stack";

class NoteService extends NodeService<Stack> {
  public stackService = new StackService(this.wallet, this.api);

  /**
   * @param  {string} vaultId
   * @param  {string} content note content, ex: stringified JSON
   * @param  {string} name note name
   * @param  {string} [parentId] parent folder id
   * @param  {string} [mimeType] MIME type for the note text file, default: text/markdown
   * @returns Promise with new note id & corresponding transaction id
   */
  public async create(vaultId: string, content: string, name: string, parentId?: string, mimeType?: string): Promise<{
    noteId: string,
    transactionId: string
  }> {
    const noteFile = new File([content], name, {
      type: mimeType ? mimeType : "text/markdown"
    });
    const { stackId, transactionId } = await this.stackService.create(
      vaultId,
      noteFile,
      name,
      parentId
    );
    return { noteId: stackId, transactionId };
  }

  /**
  * @param  {string} noteId
  * @param  {string} content note content, ex: stringified JSON
  * @param  {string} name note name
  * @param  {string} [mimeType] MIME type for the note text file, default: text/markdown
  * @returns Promise with corresponding transaction id
  */
  public async uploadRevision(noteId: string, content: string, name: string, mimeType?: string): Promise<{
    transactionId: string
  }> {
    const noteFile = new File([content], name, {
      type: mimeType ? mimeType : "text/markdown"
    });
    return this.stackService.uploadRevision(noteId, noteFile);
  }

  /**
   * Get note version by index, return the latest version by default
   * @param  {string} noteId
   * @param  {string} [index] note version index
   * @returns Promise with version name & data buffer
   */
  public async getVersion(noteId: string, index?: string): Promise<{ name: string, data: ArrayBuffer }> {
    return this.stackService.getVersion(noteId, index);
  }
};

export {
  NoteService
}