import fs from "fs";
import path from "path";
import { Blob } from "buffer";
import * as mime from "mime-types";

export type FileLike = NodeJs.File | File

export namespace NodeJs {
  export class File extends Blob {
    name: string;
    lastModified: number;
    type: string;

    /**
     * @param filePath 
     * @returns FileStream instance
     */
    constructor(filePath: string) {
      super([]);
      if (!fs.existsSync(filePath)) {
        throw new Error("Could not find a file in your filesystem: " + filePath);
      }
      const stats = fs.statSync(filePath);
      const name = path.basename(filePath);
      const fileStream = new Blob([fs.readFileSync(filePath)], { type: mime.lookup(name) || '' }) as NodeJs.File;
      fileStream.name = name;
      fileStream.lastModified = stats.ctime.getTime();
      return fileStream;
    }
  }
}
