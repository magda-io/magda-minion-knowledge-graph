import minion, { commonYargs } from "@magda/minion-sdk";
import onRecordFound from "./onRecordFound";
import wikiEntitiesAspectDef from "./wikiEntitiesAspectDef";
import path from "path";
import fs from "fs";
import tar from "tar";

// unzip nlp model files
if (!fs.existsSync("./psrc/models/nlp")) {
    const NLP_MODLE_PATH = path.resolve(
        "./psrc/models/en_entity_linking_wiki_03_lg.tar.gz"
    );

    console.log("Uncompressing entity linking language model...");

    tar.x({
        cwd: path.dirname(NLP_MODLE_PATH),
        file: NLP_MODLE_PATH,
        sync: true,
        onwarn: message => console.log("Model Uncompression WARN: " + message)
    });

    console.log("Entity linking language model uncompress completed!");
}

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
