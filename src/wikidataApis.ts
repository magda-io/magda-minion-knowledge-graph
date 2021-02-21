import wdk, {
    SearchEntitiesOptionsType,
    GetReverseClaimsOptionsType,
    MinimisedEntity
} from "wikidata-sdk";
import { SearchResult, SparqlResults } from "wikibase-types";
import fetch from "node-fetch";
import delay from "./delay";

const packageInfo = require("../package.json");

let wikiApiAccessPromise: null | Promise<any> = null;
let contactInfo: string = "";

export const setContactInfo = (info: string) => (contactInfo = info);

async function request<T>(url: string, body?: string): Promise<T> {
    while (wikiApiAccessPromise) {
        // make sure there is one current request to wikidata api
        const waitingPromise = wikiApiAccessPromise;
        try {
            await waitingPromise;
        } catch (e) {}
        if (waitingPromise === wikiApiAccessPromise) {
            wikiApiAccessPromise = null;
        }
    }
    const userAgent = `${packageInfo.name}/${packageInfo.version} (${
        contactInfo ? contactInfo : "No Contact Info Set"
    }) wikidata-sdk/7.9.0 node-fetch/2.6.1`;

    let req;
    if (body) {
        req = fetch(url, {
            method: "POST",
            body,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": userAgent
            }
        });
    } else {
        req = fetch(url, {
            headers: {
                "User-Agent": userAgent
            }
        });
    }

    wikiApiAccessPromise = req;
    const res = await req;
    const jsonStr = await res.text();
    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        console.log(e);
        console.log(jsonStr);
        throw e;
    }
}

export async function searchEntities(
    search: string | SearchEntitiesOptionsType,
    language?: string,
    limit?: number,
    format?: string,
    uselang?: string
): Promise<SearchResult[]> {
    language = language ? language : "en";
    const url = wdk.searchEntities(search, language, limit, format, uselang);
    const resData = await request<any>(url);
    const searchResult = resData?.search as SearchResult[];

    if (!searchResult?.length) {
        return [];
    } else {
        return searchResult;
    }
}

const GET_ENTITY_WAIT_TIME = 1000;
const GET_ENTITY_WAIT_NUMBER = 10;
type PENDING_FETCH_ENTITY_ITEM_TYPE = {
    id: string;
    promise: Promise<MinimisedEntity>;
    isResolved: boolean;
    resolve: (value?: MinimisedEntity | PromiseLike<MinimisedEntity>) => void;
    reject: (reason?: any) => void;
};
const pendingFetchEntityItems: PENDING_FETCH_ENTITY_ITEM_TYPE[] = [];
/**
 * Auto combine multiple single entity fetching requests to one request that retrieves multiple entities in one go.
 * By default, the function will wait `GET_ENTITY_APP_WAIT_TIME` milsecond or accumulate `GET_ENTITY_WAIT_NUMBER` entity
 *
 * @export
 * @param {string} id The id of the wiki Entity to be fetched
 * @param {(
 *         ids: string[],
 *         languages?: string[],
 *         props?: string[],
 *         format?: string,
 *         redirects?: boolean
 *     ) => Promise<MinimisedEntity[]>} [fetchMultiEntitiesFunc=getEntities] This parameter is only for test cases. By default, it uses `getManyEntities`.
 * @param {number} [getEntityWaitTime=GET_ENTITY_WAIT_TIME] This parameter is only for test cases.
 * @param {number} [getEntityWaitNumber=GET_ENTITY_WAIT_NUMBER] This parameter is only for test cases.
 * @return {*}  {Promise<MinimisedEntity>}
 */
export async function getEntityAgg(
    id: string,
    fetchMultiEntitiesFunc: (
        ids: string[],
        languages?: string[],
        props?: string[],
        format?: string,
        redirects?: boolean
    ) => Promise<MinimisedEntity[]> = getManyEntities,
    getEntityWaitTime: number = GET_ENTITY_WAIT_TIME,
    getEntityWaitNumber: number = GET_ENTITY_WAIT_NUMBER
): Promise<MinimisedEntity> {
    const pendingItemWithSameId = pendingFetchEntityItems.find(
        item => item.id === id
    );
    if (pendingItemWithSameId) {
        return await pendingItemWithSameId.promise;
    }

    let pendingFetchItem: PENDING_FETCH_ENTITY_ITEM_TYPE;
    const pendingFetchItemPromise = new Promise((resolve, reject) => {
        pendingFetchItem = {
            id,
            resolve,
            reject,
            isResolved: false
        } as any;
    });
    pendingFetchItem.promise = pendingFetchItemPromise as Promise<
        MinimisedEntity
    >;

    pendingFetchEntityItems.push(pendingFetchItem);

    let processingItems: PENDING_FETCH_ENTITY_ITEM_TYPE[];

    if (pendingFetchEntityItems.length >= getEntityWaitNumber) {
        processingItems = pendingFetchEntityItems.splice(0);
    } else {
        await delay(getEntityWaitTime);
        // if the promise is already resolve, it shouldn't try to consume the queue
        // otherwise, consequence might be triggered earlier
        processingItems = pendingFetchItem.isResolved
            ? []
            : pendingFetchEntityItems.splice(0);
    }

    const itemKeys = processingItems.map(item => item.id);

    if (itemKeys.length) {
        //  `processingItems` could be empty and consumed by other pending requests
        try {
            const fecthedItems = await fetchMultiEntitiesFunc(itemKeys);
            fecthedItems.forEach((value, idx) => {
                processingItems[idx].isResolved = true;
                processingItems[idx].resolve(value);
            });
        } catch (e) {
            console.log(
                `Error@getEntityAgg: failed to invoke fetchMultiEntitiesFunc with keys: ${JSON.stringify(
                    itemKeys
                )}`
            );
            processingItems.forEach(item => {
                item.reject(e);
            });
            throw e;
        }
    }

    return await pendingFetchItem.promise;
}

export async function getEntities<T = MinimisedEntity>(
    ids: string[],
    languages?: string[],
    props?: string[],
    format?: string,
    redirects?: boolean
): Promise<T[]> {
    languages = languages ? languages : ["en"];
    const url = wdk.getEntities(ids, languages, props, format, redirects);
    const resData = await request<any>(url);
    const parsedData = wdk.parse.wd.entities<T>(resData);
    if (!parsedData) {
        return [];
    }
    return Object.values(parsedData);
}

export async function getManyEntities<T = MinimisedEntity>(
    ids: string[] | string[][],
    languages?: string[],
    props?: string[],
    format?: string,
    redirects?: boolean
): Promise<T[]> {
    languages = languages ? languages : ["en"];
    const urls = wdk.getManyEntities(ids, languages, props, format, redirects);
    if (!urls?.length) {
        console.log("ids:", ids, "urls:", urls);
        throw new Error("Invalid wikibase API request url array generated.");
    }

    let entities = [] as T[];

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const resData = await request<any>(url);
        const parsedData = wdk.parse.wd.entities<T>(resData);
        entities = entities.concat(parsedData ? Object.values(parsedData) : []);
    }

    return entities;
}

interface GetReverseClaimsOptionsTypeWithExtras
    extends GetReverseClaimsOptionsType {
    languages?: string[];
    props?: string[];
    format?: string;
    redirects?: boolean;
}

export async function getReverseClaims(
    property: string | string[],
    value: string | string[],
    options?: GetReverseClaimsOptionsTypeWithExtras
): Promise<MinimisedEntity[]> {
    const url = wdk.getReverseClaims(property, value, options);
    const resData = await request<SparqlResults>(url);
    const entitiesIds = wdk.simplify.sparqlResults<string[]>(resData, {
        minimize: true
    });

    if (!entitiesIds?.length) {
        return [];
    }

    const { languages, props, format, redirects } = options;
    return await getManyEntities(
        entitiesIds,
        languages,
        props,
        format,
        redirects
    );
}

export async function sparqlQuery<T = any>(
    sparql: string,
    options: {
        minimize?: boolean;
    } = {}
): Promise<T> {
    if (typeof options?.minimize === "undefined") {
        options.minimize = true;
    }
    const [url, body] = wdk.sparqlQuery(sparql).split("?");
    const resData = await request<SparqlResults>(url, body);
    return wdk.simplify.sparqlResults<T>(resData, options);
}
