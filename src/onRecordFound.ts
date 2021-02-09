import {
    AuthorizedRegistryClient as Registry,
    Record
} from "@magda/minion-sdk";
import delay from "./delay";
import { WikiEnity } from "./wikiEntitiesAspectDef";
import executePython from "./executePython";
import path from "path";
import { getManyEntities, getEntities } from "./wikidataApis";
import matchWikiEnityByKeywords from "./matchWikiEnityByKeywords";
import { uniqBy } from "lodash";
import { MinimisedEntity, isEntityId } from "wikidata-sdk";
import { Driver, Integer, Session } from "neo4j-driver";
import {
    findNodes,
    namespaceList,
    createNode,
    getRelationshipBetweenNodes,
    createRelationship,
    UriNamespace
} from "./neo4jApis";
//import wdk from "wikidata-sdk";

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
        item => (nameLabelList[item.id] = item.labels["en"])
    );

    entities = entities.map(item => ({
        ...item,
        // use name label from wiki
        name: nameLabelList[item.kb_id]
    }));

    await updateRegistry(record, registry, entities);
    await updateGraphDb(neo4jDriver, record, wikiEnityitems);
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
                kb_id: isEntityId(kb_id) ? kb_id : ""
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
    entities: WikiEnity[]
) {
    await registry.putRecordAspect(
        record.id,
        "dataset-wiki-entities",
        entities
    );
}

async function updateGraphDb(
    neo4jDriver: Driver,
    record: Record,
    wikiEntityItems: MinimisedEntity[]
) {
    const session = await neo4jDriver.session();
    try {
        const datasetNodeId = await createDatasetNode(session, record);
        await createNodesForWikiEntityItems(
            session,
            datasetNodeId,
            wikiEntityItems
        );
    } finally {
        session.close();
    }
}

async function createDatasetNode(session: Session, record: Record) {
    const txc = await session.beginTransaction();
    try {
        const nodes = await findNodes(
            txc,
            {
                uri: namespaceList.magdaItem.getUriFromId(record.id)
            },
            ["Dataset"],
            1
        );

        let datasetNodeId: Integer;
        if (nodes.length) {
            datasetNodeId = nodes[0].identity;
        } else {
            datasetNodeId = await createNode(
                txc,
                {
                    id: record.id,
                    uri: namespaceList.magdaItem.getUriFromId(record.id),
                    name: record.aspects?.["dcat-dataset-strings"]?.title,
                    description:
                        record.aspects?.["dcat-dataset-strings"]?.description
                },
                ["Dataset", "MagdaItem"]
            );
        }
        await txc.commit();
        return datasetNodeId;
    } catch (e) {
        await txc.rollback();
        throw e;
    }
}

/**
 * Check if there is a wiki entity node exist in neo4j DB.
 * If not, will attempt creating the node.
 * If the `nameLabel` parameter is not provided, the function will try to retrieve the entity name label via wikidata API
 *
 * @param {Session} session neo4j driver
 * @param {string} wikiId the ID of wikidata entity. In form of `Q1231`.
 * @param {string} [nameLabel] Optional. If not provided, will try to retrieve the entity name label by `wikiId` via wikidata API instead.
 * @return {*}
 */
async function checkCreateWikiNode(
    session: Session,
    wikiId: string,
    nameLabel?: string
) {
    const txc = await session.beginTransaction();
    try {
        const nodes = await findNodes(
            txc,
            {
                uri: namespaceList.wd.getUriFromId(wikiId)
            },
            ["WikiEntity"],
            1
        );

        let wikiNodeId: Integer;
        if (nodes.length) {
            wikiNodeId = nodes[0].identity;
        } else {
            if (!nameLabel) {
                const entities = await getEntities([wikiId]);
                if (!entities?.[0]?.labels?.["en"]) {
                    throw new Error(
                        `Error@checkCreateWikiNode: Can't retrieve entity name label via wikidata API by ID: \`${wikiId}\``
                    );
                }
                nameLabel = entities[0].labels["en"];
            }

            wikiNodeId = await createNode(
                txc,
                {
                    id: wikiId,
                    uri: namespaceList.wd.getUriFromId(wikiId),
                    name: nameLabel
                },
                ["WikiEntity", "WikiItem"]
            );
        }
        await txc.commit();
        return wikiNodeId;
    } catch (e) {
        await txc.rollback();
        throw e;
    }
}

const createRelTypeFromString = (label: string) =>
    label.replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase();

/**
 *
 *
 * @param {Session} session
 * @param {Integer} startNodeId
 * @param {Integer} endNodeId
 * @param {string} relType Optional; The type of the created relationship.
 * If `relType` is not provided, the function will try to pull label from wikidata API by `relId`
 * @param {string} [uri] Optional; the uri of created relationship.
 * If not provided, the function will try to construct uri with `relId` & `namespace`.
 * @param {string} [relId] Optional; The entity id of the wiki property / relationship.
 * When `uri` & `relType` is provided, `relId` will be ignored.
 * @param {UriNamespace} [namespace] Optional; The namespace obj of the uri. Used to create `uri` from `relId`.
 * @return {*}
 */
async function checkCreateWikiNodeRel(
    session: Session,
    startNodeId: Integer,
    endNodeId: Integer,
    relType: string,
    uri?: string,
    relId?: string,
    namespace?: UriNamespace
) {
    const txc = await session.beginTransaction();
    try {
        const rels = await getRelationshipBetweenNodes(
            txc,
            startNodeId,
            endNodeId
        );

        const matchedRels = rels.filter(
            item =>
                item.type === relType && (item?.properties as any)?.uri === uri
        );

        let wikiRelId: Integer;
        if (matchedRels.length) {
            wikiRelId = matchedRels[0].identity;
        } else {
            if (!relType) {
                if (!relId) {
                    throw new Error(
                        "Error@checkCreateWikiNodeRel: `relId` must be provided when `relType` was not provided."
                    );
                }
                const entities = await getEntities([relId]);
                if (!entities?.[0]?.labels?.["en"]) {
                    throw new Error(
                        `Error@checkCreateWikiNode: Can't retrieve entity name label via wikidata API by ID: \`${relId}\``
                    );
                }
                relType = createRelTypeFromString(entities[0].labels["en"]);
            }
            wikiRelId = await createRelationship(
                txc,
                startNodeId,
                endNodeId,
                relType,
                {
                    id: relId ? relId : "",
                    uri:
                        relId && namespace
                            ? namespace.getUriFromId(relId)
                            : uri
                            ? uri
                            : ""
                }
            );
        }
        await txc.commit();
        return wikiRelId;
    } catch (e) {
        await txc.rollback();
        throw e;
    }
}

export async function createNodesForWikiEntityItems(
    session: Session,
    datasetNodeId: Integer,
    wikiEntityItems: MinimisedEntity[]
) {
    await Promise.all(
        wikiEntityItems.map(async wikiEntityItem => {
            await createNodeForWikiEntityItem(
                session,
                datasetNodeId,
                wikiEntityItem
            );
        })
    );
}

export async function createNodeForWikiEntityItem(
    session: Session,
    datasetNodeId: Integer,
    wikiEntityItem: MinimisedEntity
) {
    const wikiNodeId = await checkCreateWikiNode(
        session,
        wikiEntityItem.id,
        wikiEntityItem.labels?.["en"]
    );

    await checkCreateWikiNodeRel(
        session,
        datasetNodeId,
        wikiNodeId,
        "RELEVANT",
        namespaceList.magdaRel.getUriFromId("RELEVANT"),
        "RELEVANT"
    );

    await Promise.all(
        Object.keys(wikiEntityItem.claims).map(async propId => {
            const claimValues = wikiEntityItem.claims[propId].filter(item =>
                isEntityId(item)
            ) as string[];
            if (!claimValues?.length) {
                return;
            }
            await Promise.all(
                claimValues.map(async wikiEntityId => {
                    const propWikiNodeId = await checkCreateWikiNode(
                        session,
                        wikiEntityId
                    );

                    await checkCreateWikiNodeRel(
                        session,
                        wikiNodeId,
                        propWikiNodeId,
                        undefined,
                        undefined,
                        wikiEntityId,
                        namespaceList.wdt
                    );
                })
            );
        })
    );
}
