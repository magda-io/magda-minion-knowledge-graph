import minion, { commonYargs } from "@magda/minion-sdk";
import onRecordFound from "./onRecordFound";
import wikiEntitiesAspectDef from "./wikiEntitiesAspectDef";
import path from "path";
import fs from "fs";
import tar from "tar";
import { pipeRemoteFile, pipeLocalFile } from "./utils";
import { Writable } from "stream";
import neo4j from "neo4j-driver";
import { partial } from "lodash";

const NLP_MODLE_PATH = path.resolve("./psrc/models");
const DEFAULT_MODLE_FILE_NAME = "en_entity_linking_wiki_03_lg.tar.gz";
const DEFAULT_NLP_MODLE_FILE_PATH = path.resolve(
    `./psrc/models/${DEFAULT_MODLE_FILE_NAME}`
);
const DEFAULT_NLP_MODLE_URL = `https://magda-files.s3-ap-southeast-2.amazonaws.com/nlp_models/${DEFAULT_MODLE_FILE_NAME}`;

const nlpModelPromise = new Promise((resolve, reject) => {
    // unzip nlp model files
    if (fs.existsSync("./psrc/models/nlp")) {
        console.log("Decompressed model found. Skip model preparation.");
        resolve();
        return;
    }

    const stream = tar.x({
        cwd: NLP_MODLE_PATH,
        onwarn: message => console.log("Model Uncompression WARN: " + message)
    }) as Writable;

    const localCompressedModelFilePath = process?.env?.["NLP_MODEL_FILE_PATH"]
        ? process.env["NLP_MODEL_FILE_PATH"]
        : DEFAULT_NLP_MODLE_FILE_PATH;

    if (fs.existsSync(localCompressedModelFilePath)) {
        console.log(
            `Locate compressed model file: ${localCompressedModelFilePath}, start to decompress model file...`
        );
        pipeLocalFile(localCompressedModelFilePath, stream, reject);
    } else {
        console.log(
            `Downloading & decompressing model file from ${localCompressedModelFilePath}...`
        );
        pipeRemoteFile(DEFAULT_NLP_MODLE_URL, stream, reject);
    }

    stream.on("error", reject).on("close", () => {
        resolve();
        console.log("Decompress entity linking language model file completed!");
    });
});

nlpModelPromise
    .then(() => {
        const ID = "minion-knowledge-graph";

        const argv = commonYargs(6123, "http://localhost:6123", yargs =>
            yargs
                .options("neo4jUrl", {
                    describe: "the neo4j DB in cluster access url.",
                    default: process.env.NEO4J_URL,
                    type: "string"
                })
                .options("neo4jUser", {
                    describe: "the neo4j DB username",
                    default: process.env.NEO4J_USERNAME,
                    type: "string"
                })
                .options("neo4jPassword", {
                    describe: "the neo4j DB password",
                    default: process.env.NEO4J_PASSWORD,
                    type: "string"
                })
        );

        if (!argv.neo4jUrl) {
            throw new Error("`neo4jUrl` cannot be empty!");
        }

        if (!argv.neo4jUser) {
            throw new Error("`neo4jUser` cannot be empty!");
        }

        const driver = neo4j.driver(
            argv.neo4jUrl,
            neo4j.auth.basic(argv.neo4jUser, argv.neo4jPassword)
        );

        return minion({
            argv,
            id: ID,
            aspects: ["dcat-dataset-strings"],
            optionalAspects: [],
            async: true,
            writeAspectDefs: [wikiEntitiesAspectDef],
            onRecordFound: partial(onRecordFound, driver)
        }).catch(e => {
            console.error("Error:" + e.message, e);
            process.exit(1);
        });
    })
    .catch(e => {
        console.error("Error:" + e.message, e);
        process.exit(1);
    });
