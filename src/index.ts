import minion, { commonYargs } from "@magda/minion-sdk";
import onRecordFound from "./onRecordFound";
import formatAspectDef from "./formatAspectDef";
import executePython from "./executePython";
import path from "path";
import fs from "fs";
import tar from "tar";

// unzip nlp model files
if (!fs.existsSync("./psrc/models/nlp")) {
    const NLP_MODLE_PATH = path.resolve(
        "./psrc/models/en_entity_linking_wiki_01_lg.tar.gz"
    );

    tar.x({
        cwd: path.dirname(NLP_MODLE_PATH),
        file: NLP_MODLE_PATH,
        sync: true
    });
}

const ID = "minion-knowledge-graph";

const argv = commonYargs(6115, "http://localhost:6115");

(async () => {
    const r = await executePython(
        "process_text.py",
        `
    Taxation statistics: an overview of the income and tax status of Australian individuals, companies, partnerships, trusts and funds for 2017-18.

For more info see: https://www.ato.gov.au/About-ATO/Research-and-statistics/In-detail/Taxation-statistics/Taxation-statistics-2017-18/
    `,
        path.resolve("./psrc")
    );

    console.log(r);
})().catch(e => {
    console.error(e);
});

minion({
    argv,
    id: ID,
    aspects: ["dcat-distribution-strings"],
    optionalAspects: [],
    async: false,
    writeAspectDefs: [formatAspectDef],
    onRecordFound
}).catch(e => {
    console.error("Error:" + e.message, e);
    process.exit(1);
});
