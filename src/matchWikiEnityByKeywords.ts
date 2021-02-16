import tokeniseString from "./tokeniseString";
import { searchEntities } from "./wikidataApis";
import { SearchResult } from "wikibase-types/dist";
import { WikiEnity } from "./wikiEntitiesAspectDef";
import cache from "./cache";
import md5 from "md5";

const searchResult2Entity = (searchResult: SearchResult) => ({
    name: searchResult.label,
    label: "",
    kb_id: searchResult.id
});

async function doMatchWikiEnityByKeywords(
    keywords: string
): Promise<WikiEnity[]> {
    const result = await searchEntities(keywords);
    if (result?.length) {
        return result.map(searchResult2Entity);
    }
    const tokens = tokeniseString(keywords);
    if (!tokens?.length) {
        return [];
    }
    let entities = [] as WikiEnity[];
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const result = await searchEntities(token);
        if (result?.length) {
            entities = entities.concat(result.map(searchResult2Entity));
        }
    }
    return entities;
}

export default async function matchWikiEnityByKeywords(
    keywords: string
): Promise<WikiEnity[]> {
    return await cache.wrap<WikiEnity[]>(
        md5(keywords),
        doMatchWikiEnityByKeywords
    );
}
