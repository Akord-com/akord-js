import { NodeService } from "./node";
import { Stack, nodeType } from "../types/node";
import { StackService } from "./stack";
import { createFileLike } from "./file";
import { arrayToString } from "@akord/crypto";

const CONTENT_TYPE = "application/x.arweave-manifest+json";
const FILE_NAME = "manifest.json";
const FILE_TYPE = "application/json";

class ManifestService extends NodeService<Stack> {
  public stackService = new StackService(this.wallet, this.api);
  objectType = nodeType.STACK;
  NodeType = Stack;

  /**
   * @param  {string} vaultId
   * @param  {JSON} manifest manifest JSON
   * @returns Promise with corresponding transaction id
   */
  public async generate(vaultId: string, manifest?: JSON | Object): Promise<{ transactionId: string }> {
    this.stackService.fileService.contentType = CONTENT_TYPE;
    if (!manifest) {
      // TODO: generate vault manifest
    }
    const file = await createFileLike([JSON.stringify(manifest)], FILE_NAME, FILE_TYPE);
    const manifestNode = await this.get(vaultId);
    if (manifestNode) {
      // update vault manifest
      return await this.stackService.uploadRevision(manifestNode.id, file);
    } else {
      // create new vault manifest
      return await this.stackService.create(vaultId, file, file.name);
    }
  }

  /**
   * @returns Promise with vault manifest node
   */
  public async get(vaultId: string): Promise<Stack> {
    const stacks = await this.stackService.listAll(vaultId);
    const manifest = stacks.find((stack) => stack.name === FILE_NAME) as Stack;
    return manifest;
  }

  /**
   * @returns Promise with vault manifest JSON data
   */
  public async getVersion(vaultId: string): Promise<JSON> {
    const manifest = await this.get(vaultId);
    if (!manifest) {
      throw new Error("A vault manifest does not exist yet. Use akord.manifest.generate(vaultId) to create it.");
    }
    const manifestFile = await this.stackService.getVersion(manifest.id);
    return JSON.parse(arrayToString(manifestFile.data));
  }
};

export {
  ManifestService
}