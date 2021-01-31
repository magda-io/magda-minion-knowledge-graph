import wdk, {
    SearchEntitiesOptionsType,
    GetReverseClaimsOptionsType
} from "wikidata-sdk";
import { Entity, SearchResult, SparqlResults } from "wikibase-types";
import fetch from "node-fetch";

export async function searchEntities(
    search: string | SearchEntitiesOptionsType,
    language?: string,
    limit?: number,
    format?: string,
    uselang?: string
): Promise<SearchResult[]> {
    language = language ? language : "en";
    const url = wdk.searchEntities(search, language, limit, format, uselang);
    const res = await fetch(url);
    const resData = await res.json();
    const searchResult = resData?.search as SearchResult[];

    if (!searchResult?.length) {
        return [];
    } else {
        return searchResult;
    }
}

export async function getEntities(
    ids: string[],
    languages?: string[],
    props?: string[],
    format?: string,
    redirects?: boolean
): Promise<Entity[]> {
    languages = languages ? languages : ["en"];
    const url = wdk.getEntities(ids, languages, props, format, redirects);
    const res = await fetch(url);
    const resData = await res.json();
    const parsedData = wdk.parse.wd.entities(resData);
    if (!parsedData) {
        return [];
    }
    return Object.values(parsedData);
}

export async function getManyEntities(
    ids: string[] | string[][],
    languages?: string[],
    props?: string[],
    format?: string,
    redirects?: boolean
): Promise<Entity[]> {
    languages = languages ? languages : ["en"];
    const urls = wdk.getManyEntities(ids, languages, props, format, redirects);
    if (!urls?.length) {
        throw new Error("Invalid wikibase API request url array generated.");
    }

    let entities = [] as Entity[];

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const res = await fetch(url);
        const resData = await res.json();
        const parsedData = wdk.parse.wd.entities(resData);
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
): Promise<Entity[]> {
    const url = wdk.getReverseClaims(property, value, options);
    const res = await fetch(url);
    const resData = (await res.json()) as SparqlResults;
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
    const res = await fetch(url, {
        method: "POST",
        body,
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });
    const resData = (await res.json()) as SparqlResults;
    return wdk.simplify.sparqlResults<T>(resData, options);
}
