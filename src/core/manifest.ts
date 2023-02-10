import { NodeService } from "./node";
import { Stack, nodeType } from "../types/node";
import { StackService } from "./stack";
import { createFileLike } from "./file";

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
    if (!manifest) {
      // TODO: generate vault manifest
    }
    this.stackService.fileService.contentType = CONTENT_TYPE;
    const file = await createFileLike([JSON.stringify(manifest)], FILE_NAME, FILE_TYPE);
    return await this.stackService.create(vaultId, file, file.name);
  }
};

export {
  ManifestService
}