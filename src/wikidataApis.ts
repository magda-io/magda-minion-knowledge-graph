import wdk, {
    SearchEntitiesOptionsType,
    GetReverseClaimsOptionsType,
    MinimisedEntity
} from "wikidata-sdk";
import { SearchResult, SparqlResults } from "wikibase-types";
import fetch from "node-fetch";

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
