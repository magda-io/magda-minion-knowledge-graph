import minion, { commonYargs } from "@magda/minion-sdk";
import onRecordFound from "./onRecordFound";
import formatAspectDef from "./formatAspectDef";

const ID = "minion-knowledge-graph";

const argv = commonYargs(6115, "http://localhost:6115");

function sleuthLayerer() {
    return minion({
        argv,
        id: ID,
        aspects: ["dcat-distribution-strings"],
        optionalAspects: [],
        async: false,
        writeAspectDefs: [formatAspectDef],
        onRecordFound
    });
}

sleuthLayerer().catch(e => {
    console.error("Error:" + e.message, e);
    process.exit(1);
});
