import fs from "fs";
import path from "path";
import { Blob } from 'buffer';
import * as mime from "mime-types";

export class FileStream extends Blob {
    name: string;
    lastModified: number;
    type: string;

    private constructor() {
        super(null);
    }

    /**
     * Web factory method
     * @param file 
     * @returns FileStream instance
     */
    static fromFile(file: File) {
        const fileStream = file as FileStream;
        return fileStream;
    }

    /**
     * Node factory method
     * @param filePath 
     * @returns FileStream instance
     */
    static fromPath(filePath: string) {
        if (!fs.existsSync(filePath)) {
            throw new Error("Could not find a file in your filesystem: " + filePath);
          }
        const stats = fs.statSync(filePath);
        const name = path.basename(filePath);
        const fileStream = new Blob([fs.readFileSync(filePath)], { type: mime.lookup(name) || ''}) as FileStream;
        fileStream.name = name;
        fileStream.lastModified = stats.ctime.getTime();
        return fileStream;
    }
}
