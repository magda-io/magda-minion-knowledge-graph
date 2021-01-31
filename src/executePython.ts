import { exec } from "child_process";
import { Readable } from "stream";

const env = {
    ...process.env
};

const MAX_BUFFER = 1024 * 1024 * 10;

export default function executePython<T = any>(
    pythonScriptPath: string,
    input?: string,
    cwd?: string
): Promise<T | null> {
    return new Promise((resolve, reject) => {
        const options = {
            env: env,
            encoding: "utf-8",
            shell: "/bin/bash",
            maxBuffer: MAX_BUFFER,
            cwd: cwd ? cwd : undefined
        };

        const pythonProcess = exec(
            `python ${pythonScriptPath}`,
            options,
            (error, stdout, stderr) => {
                try {
                    if (error) {
                        reject(error);
                        return;
                    } else if (stderr) {
                        reject(new Error(stderr as string));
                        return;
                    } else {
                        if (!stdout) {
                            resolve(null);
                        } else {
                            resolve(JSON.parse(stdout as string) as T);
                        }
                    }
                } catch (e) {
                    reject(e);
                }
            }
        );

        if (typeof input === "string") {
            Readable.from(input, { objectMode: false, encoding: "utf-8" }).pipe(
                pythonProcess.stdin
            );
        } else if (input) {
            Readable.from(JSON.stringify(input), {
                objectMode: false,
                encoding: "utf-8"
            }).pipe(pythonProcess.stdin);
        }
    });
}
