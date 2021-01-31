import {
    AuthorizedRegistryClient as Registry,
    Record
} from "@magda/minion-sdk";
import delay from "./delay";
import { WikiEnity } from "./wikiEntitiesAspectDef";
import executePython from "./executePython";
import path from "path";

//import { unionToThrowable } from "@magda/utils";

//import { FormatAspect } from "./formatAspectDef";

/**
 * When minion works under async mode, there might be a racing condition when `onRecordFound` is resolved too quick (before one registry event cycle finishs).
 * To overcome it, we makes the minion waits if it spent less then `MIN_SPENT_TIME` (in milseconds).
 */
const MIN_SPENT_TIME = 3000;

export default async function onRecordFound(
    record: Record,
    registry: Registry
) {
    const startTime = new Date().getTime();
    await processRecord(record, registry);
    const timeSpent = new Date().getTime() - startTime;
    if (timeSpent < MIN_SPENT_TIME) {
        await delay(MIN_SPENT_TIME - timeSpent);
    }
}

async function processRecord(record: Record, registry: Registry) {
    const datasetTitle = record?.aspects?.["dcat-dataset-strings"]?.title;
    const datasetDesc = record?.aspects?.["dcat-dataset-strings"]?.description;
    //const datasetKeywords = record?.aspects?.["dcat-dataset-strings"]?.keywords;

    const nlpContent = (
        (datasetTitle ? datasetTitle + ". " : "") +
        (datasetDesc ? datasetDesc : "")
    ).trim();

    processTextWithNlpModel(nlpContent);
}

export function StringTokenizer(txt: string): string[] {
    return [""];
}

async function processTextWithNlpModel(text: string): Promise<WikiEnity[]> {
    const rawEntities = await executePython<string[3][]>(
        "process_text.py",
        text,
        path.resolve("./psrc")
    );

    if (!rawEntities?.length) {
        return [];
    }

    /*
    const entities = await Promise.all(rawEntities.map(async(item) => {
        const [name, label, kb_id] = item;
        const entity:WikiEnity = {
            name: name ? name: "",
            label: label? label: "",
            kb_id: kb_id? kb_id: ""
        };
        if(entity.kb_id){
            // return the enity immediately if a kb entity id has been identified by nlp model
            return entity;
        }
        if(!entity.name  ) {
            return entity;
        }
    }));*/

    return {} as any;
}
