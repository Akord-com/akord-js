import { NodeService } from "./node";
import { nodeType } from "../types/node";
import { Stack } from "../types/stack";
import { StackService } from "./stack";
import { FolderService } from "./folder";
import { arrayToString } from "@akord/crypto";
import { BadRequest } from "../errors/bad-request";

export const CONTENT_TYPE = "application/x.arweave-manifest+json";
export const FILE_TYPE = "application/json";
const FILE_NAME = "manifest.json";
const MANIFEST_TYPE = "arweave/paths";
const MANIFEST_VERSION = "0.1.0";

class ManifestService extends NodeService<Stack> {
  public stackService = new StackService(this.wallet, this.api);
  public folderService = new FolderService(this.wallet, this.api);
  objectType = nodeType.STACK;
  NodeType = Stack;

  /**
   * @returns Promise with vault manifest node
   */
  public async get(vaultId: string): Promise<Stack> {
    const stacks = await this.stackService.listAll(vaultId);
    const manifest = stacks.find((stack) => stack.name === FILE_NAME) as Stack;
    return manifest;
  }

  /**
   * Get manifest version by index, return the latest version by default
   * @param  {string} vaultId
   * @param  {number} [index] manifest version index
   * @returns Promise with vault manifest JSON data
   */
  public async getVersion(vaultId: string, index?: number): Promise<JSON> {
    const manifest = await this.get(vaultId);
    if (!manifest) {
      throw new BadRequest("A vault manifest does not exist yet. Use akord.manifest.generate(vaultId) to create it.");
    }
    const manifestFile = await this.stackService.getVersion(manifest.id, index, { responseType: 'arraybuffer' });
    return JSON.parse(arrayToString(manifestFile.data as ArrayBuffer));
  }

  /**
   * @param  {string} vaultId
   * @param  {JSON} manifest manifest JSON
   * @returns Promise with corresponding transaction id
   */
  public async generate(vaultId: string, manifest?: JSON | Object, indexName?: string): Promise<{ transactionId: string, object: Stack, uri: string }> {
    this.stackService.fileService.contentType = CONTENT_TYPE;

    const vault = await this.api.getVault(vaultId);
    if (!vault.public) {
      throw new BadRequest("Manifest applies only to public vaults.")
    }

    if (!manifest) {
      manifest = await this.renderManifestJSON(vaultId, indexName);
    }
    const manifestNode = await this.get(vaultId);
    if (manifestNode) {
      // update vault manifest
      return await this.stackService.uploadRevision(manifestNode.id, [JSON.stringify(manifest)], { name: FILE_NAME, mimeType: FILE_TYPE });
    } else {
      // create new vault manifest
      return await this.stackService.create(vaultId, [JSON.stringify(manifest)], { name: FILE_NAME, mimeType: FILE_TYPE });
    }
  }

  /**
   * 
   * @returns manifest in json format
   */
  private async renderManifestJSON(vaultId: string, indexName?: string) {
    // takes a flat list of folders and stacks and generates a tree
    const treeify = (folders: any, stacks: any) => {
      // initalize our treelist with a root folder + stacks
      var treeList = [{ id: null, parentId: null, name: null, stacks: [] as Stack[] }];
      stacks.forEach((s) => {
        if (!s["parentId"]) treeList[0]["stacks"].push(s);
      });
      // setup a lookup table
      var lookup = {};
      folders.forEach(function (obj) {
        lookup[obj["id"]] = obj;
        obj["children"] = [];
        obj["stacks"] = [];
        // add the related stacks to this folder
        stacks.forEach((s) => {
          if (s["parentId"] === obj["id"]) obj["stacks"].push(s);
        });
      });
      // add the folders  to its parent folder (tree)
      folders.forEach((obj) => {
        if (obj["parentId"] != null) {
          lookup[obj["parentId"]]["children"].push(obj);
        } else {
          treeList.push(obj);
        }
      });
      return treeList;
    };

    // take the hierachical tree and compute the folder paths
    const computePaths = (tree: Array<Object>, path?: string) => {
      const paths = [];
      tree.forEach((folder) => {
        folder['stacks'].forEach((stack: Stack) => {
          // construct the path name
          const pathName = [path, this.encode(folder['name']), this.encode(stack.name)]
            .filter((p) => p != null)
            .join("/");
          const arweaveId = stack.getUri();

          paths.push({
            id: arweaveId,
            path: pathName,
          });
        });
        // process the children
        if (folder['children']) {
          let pathName = folder['name'];
          if (path) pathName = [path, this.encode(folder['name'])].join("/");
          const children = computePaths(folder['children'], pathName);
          paths.push(...children);
        }
      });
      return paths;
    };

    // load and clean list of folders
    const folders = (await this.folderService.listAll(vaultId)).map((n) => {
      const { id, parentId, name } = n;
      return { id, parentId, name };
    });

    // load and clean list of stacks
    const stacks = (await this.stackService.listAll(vaultId)).map((s) => {
      const { id, parentId, name, versions } = s;
      return new Stack({ id, parentId, name, versions }, null);
    });

    const tree = treeify(folders, stacks);

    const paths = computePaths(tree, null);

    // map paths to manifest hash
    const manifest = {};
    paths.forEach((path) => {
      manifest[path.path] = { id: path.id };
    });

    return {
      manifest: MANIFEST_TYPE,
      version: MANIFEST_VERSION,
      index: {
        path: indexName || "index.html",
      },
      paths: manifest,
    };
  };

  private encode (str?: string) {
    if (str) {
      return encodeURIComponent(str);
    }
    return null;
  };
};

export {
  ManifestService
}