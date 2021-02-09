import http from "http";
import https from "https";
import urijs from "urijs";
import { Writable } from "stream";
import fs from "fs";

export function pipeRemoteFile(
    remoteFileUrl: string,
    targetStream: Writable,
    reject: (reason: any) => void
) {
    const requestUri = urijs(remoteFileUrl);
    (requestUri.protocol() === "https" ? https : http).get(
        remoteFileUrl,
        function(res) {
            res.on("error", reject).pipe(targetStream);
        }
    );
}

export function pipeLocalFile(
    localFilePath: string,
    targetStream: Writable,
    reject: (reason: any) => void
) {
    try {
        fs.createReadStream(localFilePath, {
            flags: "r",
            autoClose: true,
            emitClose: true
        }).pipe(targetStream);
    } catch (e) {
        reject(e);
    }
}
