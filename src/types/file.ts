import { Blob } from "buffer";
import * as mime from "mime-types";
import { BinaryLike } from "crypto";
import { Readable } from "stream";
import { NotFound } from "../errors/not-found";
import { BadRequest } from "../errors/bad-request";

export namespace NodeJs {
  export class File extends Blob {
    name: string;
    lastModified: number;

    constructor(sources: Array<BinaryLike | Blob>, name: string, mimeType?: string, lastModified?: number) {
      super(sources, { type: mimeType || mime.lookup(name) || 'text/plain' });
      if (!name) {
        throw new BadRequest("File name is required, please provide it in the file options.");
      }
      if (!mimeType) {
        console.warn("Missing file mime type. If this is unintentional, please provide it in the file options.");
      }
      this.name = name;
      this.lastModified = lastModified;
    }

    static async fromReadable(stream: Readable, name: string, mimeType?: string, lastModified?: number) {
      const chunks = []
      for await (const chunk of stream) chunks.push(chunk);
      return new File(chunks, name, mimeType, lastModified);
    }

    static async fromPath(filePath: string) {
      if (typeof window === 'undefined') {
        const fs = (await import("fs")).default;
        const path = (await import("path")).default;
        if (!fs.existsSync(filePath)) {
          throw new NotFound("Could not find a file in your filesystem: " + filePath);
        }
        const stats = fs.statSync(filePath);
        const name = path.basename(filePath);
        const file = new File([fs.readFileSync(filePath)], name, mime.lookup(name) || '', stats.ctime.getTime()) as NodeJs.File;
        return file;
      } else {
        throw new BadRequest("Method not valid for browsers.");
      }
    }
  }
}

export type FileLike = NodeJs.File | File;

export type FileSource = FileLike | ArrayBuffer | Buffer | string | Readable | Array<BinaryLike | any>;
