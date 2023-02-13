import { NodeService } from "./node";
import { Stack, nodeType } from "../types/node";
import { StackService } from "./stack";
import { FolderService } from "./folder";
import { createFileLike } from "./file";
import { arrayToString } from "@akord/crypto";

const CONTENT_TYPE = "application/x.arweave-manifest+json";
const FILE_NAME = "manifest.json";
const FILE_TYPE = "application/json";

class ManifestService extends NodeService<Stack> {
  public stackService = new StackService(this.wallet, this.api);
  public folderService = new FolderService(this.wallet, this.api);
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
      manifest = await this.renderManifestJSON(vaultId);
      console.log(manifest);
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
  public async getVersion(vaultId: string, index?: string): Promise<JSON> {
    const manifest = await this.get(vaultId);
    if (!manifest) {
      throw new Error("A vault manifest does not exist yet. Use akord.manifest.generate(vaultId) to create it.");
    }
    const manifestFile = await this.stackService.getVersion(manifest.id, index);
    return JSON.parse(arrayToString(manifestFile.data));
  }

  /**
   * 
   * @returns manifest in json format
  */
  private async renderManifestJSON(vaultId: string, indexName?: string) {
    // takes a flat list of folders and stacks and generates a tree
    const treeify = (folders, stacks) => {
      // initalize our treelist with a root folder + stacks
      var treeList = [{ id: null, parentId: null, name: null, stacks: [] }];
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
      folders.forEach(function (obj) {
        if (obj["parentId"] != null) {
          lookup[obj["parentId"]]["children"].push(obj);
        } else {
          treeList.push(obj);
        }
      });
      return treeList;
    };

    // take the hierachical tree and compute the folder paths
    const computePaths = (tree: Object[], path?: string) => {
      var paths = [];
      tree.forEach((folder) => {
        folder['stacks'].forEach((stack) => {
          // construct the path name
          var pathName = [path, folder['name'], stack.name]
            .filter((p) => p != null)
            .join("/");
          var arweaveId = stack.versions
            .slice(-1)[0]
            .resourceUri.filter((r) => {
              if (r.split(":")[0] == "arweave") return r;
            })
            .map((r) => r.split(":")[1])[0];

          paths.push({
            id: arweaveId,
            path: pathName,
          });
        });
        // process the children
        if (folder['children']) {
          var pathName = folder['name'];
          if (path) pathName = [path, folder['name']].join("/");
          var children = computePaths(folder['children'], pathName);
          paths.push(...children);
        }
      });
      return paths;
    };

    // load and clean list of folders
    var folders = (await this.folderService.list(vaultId)).items.map((n) => {
      const { id, parentId, name } = n;
      return { id, parentId, name };
    });
    // console.log(JSON.stringify(folders, null, 2));

    // load and clean list of stacks
    const stacks = (await this.stackService.list(vaultId)).items.map((s) => {
      const { id, parentId, name, versions } = s;
      return { id, parentId, name, versions };
    });

    const tree = treeify(folders, stacks);
    // console.log(JSON.stringify(tree, null, 2));

    const paths = computePaths(tree, null);
    //   console.log(JSON.stringify(paths, null, 2));

    // map paths to manifest hash
    var manifest = {};
    paths.forEach((path) => {
      manifest[path.path] = { id: path.id };
    });

    return {
      manifest: "arweave/paths",
      version: "0.1.0",
      index: {
        path: indexName || "index.html",
      },
      paths: manifest,
    };
  };
};

export {
  ManifestService
}