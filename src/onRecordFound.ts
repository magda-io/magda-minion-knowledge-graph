import {
    AuthorizedRegistryClient as Registry,
    Record
} from "@magda/minion-sdk";
import delay from "./delay";
import { WikiEnity } from "./wikiEntitiesAspectDef";
import executePython from "./executePython";
import path from "path";
import { getManyEntities } from "./wikidataApis";
import matchWikiEnityByKeywords from "./matchWikiEnityByKeywords";
import { uniqBy } from "lodash";
import { Entity } from "wikibase-types/dist";
import { Driver } from "neo4j-driver";

/**
 * When minion works under async mode, there might be a racing condition when `onRecordFound` is resolved too quick (before one registry event cycle finishs).
 * To overcome it, we makes the minion waits if it spent less then `MIN_SPENT_TIME` (in milseconds).
 */
const MIN_SPENT_TIME = 3000;

export default async function onRecordFound(
    neo4jDriver: Driver,
    record: Record,
    registry: Registry
) {
    const startTime = new Date().getTime();
    await processRecord(neo4jDriver, record, registry);
    const timeSpent = new Date().getTime() - startTime;
    if (timeSpent < MIN_SPENT_TIME) {
        await delay(MIN_SPENT_TIME - timeSpent);
    }
}

async function processRecord(
    neo4jDriver: Driver,
    record: Record,
    registry: Registry
) {
    const datasetTitle = record?.aspects?.["dcat-dataset-strings"]?.title;
    const datasetDesc = record?.aspects?.["dcat-dataset-strings"]?.description;
    const datasetKeywords = record?.aspects?.["dcat-dataset-strings"]?.keywords;

    const nlpContent = (
        (datasetTitle ? datasetTitle + ". " : "") +
        (datasetDesc ? datasetDesc : "")
    ).trim();

    let entities = await processTextWithNlpModel(nlpContent);
    const keywordsEntities = await getEntitiesFromKeywords(datasetKeywords);
    if (keywordsEntities?.length) {
        entities = entities.concat(keywordsEntities);
    }
    entities = uniqBy(entities, item => item.kb_id);

    const wikiIds = entities.map(item => item.kb_id);
    const wikiEnityitems = await getManyEntities(wikiIds);

    const nameLabelList: { [id: string]: string } = {};
    wikiEnityitems.forEach(
        item => (nameLabelList[item.id] = item.labels["en"].value)
    );

    entities = entities.map(item => ({
        ...item,
        // use name label from wiki
        name: nameLabelList[item.kb_id]
    }));

    await updateRegistry(record, registry, entities, wikiEnityitems);
    await updateGraphDb(
        neo4jDriver,
        record,
        registry,
        entities,
        wikiEnityitems
    );
}

async function processTextWithNlpModel(text: string): Promise<WikiEnity[]> {
    const rawEntities = await executePython<string[][]>(
        "process_text.py",
        text,
        path.resolve("./psrc")
    );

    if (!rawEntities?.length) {
        return [];
    }

    let entities = rawEntities
        .map(item => {
            const [name, label, kb_id] = item;
            const entity: WikiEnity = {
                name: name ? name : "",
                label: label ? label : "",
                kb_id: kb_id ? kb_id : ""
            };
            return entity;
        })
        .filter(item => !!item.name);

    const notMatchedEntities = entities.filter(item => !item.kb_id);
    entities = entities.filter(item => !!item.kb_id);

    await Promise.all(
        notMatchedEntities.map(async item => {
            const matchedItems = await matchWikiEnityByKeywords(item.name);
            if (!matchedItems?.length) {
                entities = entities.concat(matchedItems);
            }
        })
    );

    return entities;
}

async function getEntitiesFromKeywords(
    keywords: string[]
): Promise<WikiEnity[]> {
    if (!keywords?.length) {
        return [];
    }
    let entities = [] as WikiEnity[];
    await Promise.all(
        keywords
            .map(item => item.trim().toLowerCase())
            .filter(item => !!item)
            .map(async keyword => {
                const matchedItems = await matchWikiEnityByKeywords(keyword);
                if (!matchedItems?.length) {
                    entities = entities.concat(matchedItems);
                }
            })
    );
    return entities;
}

async function updateRegistry(
    record: Record,
    registry: Registry,
    entities: WikiEnity[],
    wikiEntityItems: Entity[]
) {}

async function updateGraphDb(
    neo4jDriver: Driver,
    record: Record,
    registry: Registry,
    entities: WikiEnity[],
    wikiEntityItems: Entity[]
) {
    
}
