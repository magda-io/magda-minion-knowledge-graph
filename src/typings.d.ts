declare module "*.json" {
    const value: any;
    export default value;
}

declare module "wikidata-sdk" {
    import { Claim, Entity, SparqlResults } from "wikibase-types";

    export const parse: {
        wd: {
            entities<T = any>(
                res: T | { body: T; [key: string]: any }
            ): { [id: string]: Entity };
        };
    };

    export const simplify: {
        sparqlResults<T>(
            input: SparqlResults | string,
            options?: {
                minimize?: boolean;
            }
        ): T;
    };

    export type SearchEntitiesOptionsType = {
        search: string;
        language?: string;
        limit?: number;
        format?: string;
        uselang?: string;
        type?: string;
    };

    function searchEntities(
        search: string | SearchEntitiesOptionsType,
        language?: string,
        limit?: number,
        format?: string,
        uselang?: string
    ): string;

    function getEntities(
        ids: string[],
        languages?: string[],
        props?: string[],
        format?: string,
        redirects?: boolean
    ): string;

    function getManyEntities(
        ids: string[] | string[][],
        languages?: string[],
        props?: string[],
        format?: string,
        redirects?: boolean
    ): string[];

    type GetReverseClaimsOptionsType = {
        limit?: number;
        keepProperties?: boolean;
        caseInsensitive?: boolean;
    };

    function getReverseClaims(
        property: string | string[],
        value: string | string[],
        options?: GetReverseClaimsOptionsType
    ): string;

    function sparqlQuery(sparql: string): string;

    // helpers
    function isEntityId(value: string): boolean;
    function isItemId(value: string): boolean;
    function isPropertyId(value: string): boolean;
    function isLexemeId(value: string): boolean;
    function isFormId(value: string): boolean;
    function isSenseId(value: string): boolean;
    function isGuid(value: string): boolean;
    function isHash(value: string): boolean;
    function isPropertyClaimsId(value: string): boolean;
    function isRevisionId(value: string): boolean;
    function isNumericId(value: string): boolean;
    function getNumericId(value: string): boolean;

    function truthyClaims(
        claims: Record<string, readonly Claim[]>
    ): Record<string, readonly Claim[]>;

    function truthyPropertyClaims(claims: Claim[]): Claim[];

    /**
     * generate wiki page url from site & title
     *
     * @param {string} site site name. e.g. enwiki
     * @param {string} title item title. e.g. Torquemada (play)
     * @return {*}  {string}
     */
    function getSitelinkUrl(site: string, title: string): string;

    /**
     * Get metadata from a site link.
     * e.g.
     *   {
     *       lang: 'en', // Using 'en' as placeholder lang for commons and wikidata
     *       project: 'wikidata',
     *       key: 'wikidata',
     *       title: 'Q13082',
     *       url: 'https://www.wikidata.org/wiki/Q13082'
     *   }
     *
     * @param {string} url
     * @return {*}  {{
     *         lang: string;
     *         project: string;
     *         key: string;
     *         title: string;
     *         url: string;
     *     }}
     */
    function getSitelinkData(
        url: string
    ): {
        lang: string;
        project: string;
        key: string;
        title: string;
        url: string;
    };

    /**
     * is a site link key.
     * e.g.
     *   isSitelinkKey('frwiki')
     *   // => true
     *   isSitelinkKey('dewikiquote')
     *   // => true
     *   isSitelinkKey('commons')
     *   // => true
     *   // Accepting wikidata as a valid sitelink for convenience
     *   isSitelinkKey('wikidata')
     *   // => true
     *   isSitelinkKey('frwikilinpinpin')
     *   // => false
     *   // /!\ langs are loosly validated
     *   isSitelinkKey('imaginarylangwiki')
     *   // => true
     *
     * @param {string} key
     * @return {*}  {boolean}
     */
    function isSitelinkKey(key: string): boolean;

    function getImageUrl(filename: string, width: number): string;

    /**
     * Get Entity Id From Guid
     * e.g. getEntityIdFromGuid('Q520$91F0CCEA-19E4-4CEB-97D9-74B014C14686') => 'Q520'
     *
     * @param {string} guid
     * @return {*}  {string}
     */
    function getEntityIdFromGuid(guid: string): string;
}
