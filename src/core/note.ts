import { NodeService } from "./node";
import { nodeType } from "../types/node";
import { Stack } from "../types/stack";
import { StackService } from "./stack";
import { arrayToString } from "@akord/crypto";
import { Paginated } from "../types/paginated";
import { NoteCreateOptions, NoteCreateResult, NoteOptions, NoteTypes, NoteUpdateResult } from "../types/note";

class NoteService extends NodeService<Stack> {
  public stackService = new StackService(this.wallet, this.api);
  objectType = nodeType.STACK;
  NodeType = Stack;

  defaultCreateOptions = {
    parentId: undefined,
    mimeType: NoteTypes.MD
  } as NoteCreateOptions;

  /**
   * Get note version by index, return the latest version by default
   * @param  {string} noteId
   * @param  {number} [index] note version index
   * @returns Promise with version name & data string
   */
  public async getVersion(noteId: string, index?: number): Promise<{ name: string, data: string }> {
    const { name, data } = await this.stackService.getVersion(noteId, index, { responseType: 'arraybuffer' });
    return { data: arrayToString(data as ArrayBuffer), name: name };
  }

  /**
   * @param  {string} vaultId
   * @returns Promise with all notes within given vault
   */
  public async list(vaultId: string, options = this.defaultListOptions): Promise<Paginated<Stack>> {
    const stacks = await this.stackService.list(vaultId, options) as Paginated<Stack>;
    const notes = stacks.items.filter((stack: Stack) => this.isValidNoteType(stack.getVersion().type));
    return { items: notes, nextToken: stacks.nextToken }
  }

  /**
   * @param  {string} vaultId
   * @param  {string} content note content, ex: stringified JSON
   * @param  {string} name note name
   * @param  {NoteCreateOptions} [options] parent id, mime type, etc.
   * @returns Promise with new note id & corresponding transaction id
   */
  public async create(vaultId: string, content: string, name: string, options: NoteCreateOptions = this.defaultCreateOptions): Promise<NoteCreateResult> {
    const createOptions = {
      ...this.defaultCreateOptions,
      ...options
    }
    const { stackId, transactionId, object } = await this.stackService.create(
      vaultId,
      [content],
      { ...createOptions, name }
    );
    return { noteId: stackId, transactionId, object };
  }

  /**
   * @param  {string} noteId
   * @param  {string} content note content, ex: stringified JSON
   * @param  {string} name note name
   * @param  {NoteOptions} [options] parent id, mime type, etc.
   * @returns Promise with corresponding transaction id
   */
  public async uploadRevision(noteId: string, content: string, name: string,  options: NoteOptions = this.defaultCreateOptions): Promise<NoteUpdateResult> {
    return this.stackService.uploadRevision(noteId, [content], { name, mimeType: options.mimeType });
  }

  private isValidNoteType(type: string) {
    return Object.values(NoteTypes).includes(<any>type);
  }
};

export {
  NoteService
}