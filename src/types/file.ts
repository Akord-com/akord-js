import fs from "fs";
import path from "path";
import { Blob } from "buffer";
import * as mime from "mime-types";
import { BinaryLike } from "crypto";
import { Readable } from "stream";
import { NotFound } from "../errors/not-found";

export type FileLike = NodeJs.File | File

export namespace NodeJs {
  export class File extends Blob {
    name: string;
    lastModified: number;

    constructor(sources: Array<BinaryLike | Blob>, name: string, mimeType: string, lastModified?: number) {
      super(sources, { type: mimeType });
      this.name = name;
      this.lastModified = lastModified;
    }

    static async fromReadable(stream: Readable, name: string, mimeType: string, lastModified?: number) {
      const chunks = []
      for await (const chunk of stream) chunks.push(chunk);
      return new File(chunks, name, mimeType, lastModified);
    }

    static fromPath(filePath: string) {
      if (!fs.existsSync(filePath)) {
        throw new NotFound("Could not find a file in your filesystem: " + filePath);
      }
      const stats = fs.statSync(filePath);
      const name = path.basename(filePath);
      const file = new File([fs.readFileSync(filePath)], name, mime.lookup(name) || '', stats.ctime.getTime()) as NodeJs.File;
      return file;
    }
  }
}
