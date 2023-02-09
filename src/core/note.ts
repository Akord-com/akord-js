import { NodeService } from "./node";
import { Stack, nodeType } from "../types/node";
import { StackService } from "./stack";
import { defaultListOptions } from "../types/list-options";
import { arrayToString } from "@akord/crypto";
import { createFileLike } from "./file";
import { Paginated } from "../types/paginated";

enum NoteTypes {
  MD = "text/markdown",
  JSON = "application/json"
}

type NoteType = "text/markdown" | "application/json";

class NoteService extends NodeService<Stack> {
  public stackService = new StackService(this.wallet, this.api);
  objectType = nodeType.STACK;
  NodeType = Stack;

  /**
   * @param  {string} vaultId
   * @param  {string} content note content, ex: stringified JSON
   * @param  {string} name note name
   * @param  {string} [parentId] parent folder id
   * @param  {string} [mimeType] MIME type for the note text file, default: text/markdown
   * @returns Promise with new note id & corresponding transaction id
   */
  public async create(vaultId: string, content: string, name: string, parentId?: string, mimeType?: NoteType): Promise<{
    noteId: string,
    transactionId: string
  }> {
    const noteFile = await createFileLike([content], name, mimeType ? mimeType : NoteTypes.MD);
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
  public async uploadRevision(noteId: string, content: string, name: string, mimeType?: NoteType): Promise<{
    transactionId: string
  }> {
    const noteFile = await createFileLike([content], name, mimeType ? mimeType : NoteTypes.MD);
    return this.stackService.uploadRevision(noteId, noteFile);
  }

  /**
   * Get note version by index, return the latest version by default
   * @param  {string} noteId
   * @param  {string} [index] note version index
   * @returns Promise with version name & data string
   */
  public async getVersion(noteId: string, index?: string): Promise<{ name: string, data: string }> {
    const version = await this.stackService.getVersion(noteId, index);
    return { data: arrayToString(version.data), name: version.name };
  }

  /**
   * @param  {string} vaultId
   * @returns Promise with all notes within given vault
   */
  public async list(vaultId: string, listOptions = defaultListOptions): Promise<Paginated<Stack>> {
    const stacks = await this.stackService.list(vaultId, listOptions) as Paginated<Stack>;
    const notes = stacks.items.filter((stack: Stack) => this.isValidNoteType(stack.versions?.[stack.versions.length - 1].type));
    return { items: notes, nextToken: stacks.nextToken }
  }

  private isValidNoteType(type: string) {
    return Object.values(NoteTypes).includes(<any>type);
  }
};

export {
  NoteService
}