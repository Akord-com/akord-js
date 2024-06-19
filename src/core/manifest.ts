import { Stack } from "../types/stack";
import { StackModule } from "./stack";
import { FolderModule } from "./folder";
import { Wallet, arrayToString } from "@akord/crypto";
import { BadRequest } from "../errors/bad-request";

export const CONTENT_TYPE = "application/x.arweave-manifest+json";
export const FILE_TYPE = "application/json";
const FILE_NAME = "manifest.json";
const MANIFEST_TYPE = "arweave/paths";
const MANIFEST_VERSION = "0.1.0";
const MANIFEST_DEFAULT_INDEX_FILE = "index.html";
import { Api } from "../api/api";
import { Service } from ".";
import { ROOT_FOLDER } from "../types/folder";

export type ManifestOptions = {
  manifest?: JSON | Object, // manually created manifest, by default the manifest will be automatically generated
  indexName?: string, // index file name, defaults to index.html
  parentId?: string // parent id, if provided the manifest will be generated for given folder
}

class ManifestModule {
  private stackModule: StackModule;
  private folderModule: FolderModule;
  private api: Api;

  constructor(wallet: Wallet, api: Api, service?: Service) {
    this.api = api;
    this.stackModule = new StackModule(wallet, api, service, CONTENT_TYPE);
    this.folderModule = new FolderModule(wallet, api);
  }

  /**
   * @returns Promise with vault manifest node
   */
  public async get(vaultId: string, parentId?: string): Promise<Stack> {
    const byParentId = parentId ? parentId : ROOT_FOLDER;
    const stacks = await this.stackModule.listAll(vaultId, { parentId: byParentId });
    const manifest = stacks.find((stack) => stack.name === FILE_NAME) as Stack;
    return manifest;
  }

  /**
   * Get manifest version by index, return the latest version by default
   * @param  {string} vaultId
   * @param  {number} [index] manifest version index
   * @returns Promise with vault manifest JSON data
   */
  public async getVersion(vaultId: string, parentId?: string, index?: number): Promise<JSON> {
    const manifest = await this.get(vaultId, parentId);
    if (!manifest) {
      throw new BadRequest("A vault manifest does not exist yet. Use akord.manifest.generate() to create it.");
    }
    const manifestFile = await this.stackModule.getVersion(manifest.id, index, { responseType: 'arraybuffer' });
    return JSON.parse(arrayToString(manifestFile.data as ArrayBuffer));
  }

  /**
   * @param  {string} vaultId
   * @param  {ManifestOptions} options index name, parent id, etc.
   * @returns Promise with corresponding transaction id
   */
  public async generate(vaultId: string, options: ManifestOptions = {}): Promise<{ transactionId: string, object: Stack, uri: string }> {
    const vault = await this.api.getVault(vaultId);
    if (!vault.public) {
      throw new BadRequest("Manifest applies only to public vaults.")
    }

    let manifest = options?.manifest;

    if (!manifest) {
      manifest = await this.renderManifestJSON(vaultId, options.parentId, options.indexName);
    }
    const manifestNode = await this.get(vaultId, options.parentId);
    if (manifestNode) {
      // update vault manifest
      return await this.stackModule.uploadRevision(manifestNode.id, [JSON.stringify(manifest)], { name: FILE_NAME, mimeType: FILE_TYPE });
    } else {
      // create new vault manifest
      return await this.stackModule.create(vaultId, [JSON.stringify(manifest)], { name: FILE_NAME, mimeType: FILE_TYPE, parentId: options.parentId });
    }
  }

  /**
   * 
   * @returns manifest in json format
   */
  private async renderManifestJSON(vaultId: string, parentId?: string, indexName?: string) {
    // takes a flat list of folders and stacks and generates a tree
    const treeify = (folders: any, stacks: any, parentId?: string) => {
      // initalize our treelist with a root folder + stacks
      const treeList = [{ id: null, parentId: parentId, name: null, stacks: [] as Stack[] }];
      stacks.forEach((s) => {
        if ((!parentId && !s["parentId"]) || s["parentId"] === parentId) {
          treeList[0]["stacks"].push(s);
        }
      });
      // setup a lookup table
      const lookup = {};
      folders.forEach(function (obj) {
        obj["children"] = [];
        obj["stacks"] = [];
        if (obj["id"] !== parentId) {
          lookup[obj["id"]] = obj;
          // add the related stacks to this folder
          stacks.forEach((s) => {
            if (s["parentId"] === obj["id"]) obj["stacks"].push(s);
          });
        }
      });
      // add the folders to its parent folder (tree)
      folders.forEach((obj) => {
        if (obj["parentId"] && obj["parentId"] !== parentId) {
          lookup[obj["parentId"]]["children"].push(obj);
        } else if(!parentId || obj["parentId"] === parentId) {
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
          let pathName = this.encode(folder['name']);
          if (path) pathName = [path, this.encode(folder['name'])].join("/");
          const children = computePaths(folder['children'], pathName);
          paths.push(...children);
        }
      });
      return paths;
    };

    // load and clean list of folders
    const folders = (await this.folderModule.listAll(vaultId, { limit: 1000 })).map((n) => {
      const { id, parentId, name } = n;
      return { id, parentId, name };
    });

    // load and clean list of stacks
    const stacks = (await this.stackModule.listAll(vaultId, { limit: 1000 })).map((s) => {
      const { id, parentId, name, versions } = s;
      return new Stack({ id, parentId, name, versions }, null);
    });

    const tree = treeify(folders, stacks, parentId);

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
        path: indexName || MANIFEST_DEFAULT_INDEX_FILE,
      },
      paths: manifest,
    };
  };

  private encode(str?: string) {
    if (str) {
      return encodeURIComponent(str);
    }
    return null;
  };
};

export {
  ManifestModule
}