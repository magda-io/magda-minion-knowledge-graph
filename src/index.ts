import minion, { commonYargs } from "@magda/minion-sdk";
import onRecordFound from "./onRecordFound";
import wikiEntitiesAspectDef from "./wikiEntitiesAspectDef";
import path from "path";
import fs from "fs";
import tar from "tar";
import http from "http";
import { Writable } from "stream";

const nlpModelPromise = new Promise((resolve, reject) => {
    // unzip nlp model files
    if (fs.existsSync("./psrc/models/nlp")) {
        resolve();
    }

    const NLP_MODLE_URL =
        "https://magda-files.s3-ap-southeast-2.amazonaws.com/nlp_models/en_entity_linking_wiki_03_lg.tar.gz";
    const NLP_MODLE_PATH = path.resolve("./psrc/models");

    console.log("Uncompressing entity linking language model...");

    const stream = tar.x({
        cwd: NLP_MODLE_PATH,
        onwarn: message => console.log("Model Uncompression WARN: " + message)
    }) as Writable;

    http.get(NLP_MODLE_URL, function(res) {
        res.on("error", reject).pipe(stream);
    });

    stream.on("error", reject).on("close", () => {
        resolve();
        console.log("Entity linking language model uncompress completed!");
    });
});

nlpModelPromise
    .then(() => {
        const ID = "minion-knowledge-graph";

        const argv = commonYargs(6115, "http://localhost:6123");

        minion({
            argv,
            id: ID,
            aspects: ["dcat-dataset-strings"],
            optionalAspects: [],
            async: true,
            writeAspectDefs: [wikiEntitiesAspectDef],
            onRecordFound
        }).catch(e => {
            console.error("Error:" + e.message, e);
            process.exit(1);
        });
    })
    .catch(e => {
        console.error("Error:" + e.message, e);
        process.exit(1);
    });
