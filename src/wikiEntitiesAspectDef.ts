export default {
    id: "dataset-wiki-entities",
    name: "Dataset Wikidata Entities",
    jsonSchema: require("./dataset-wiki-entities.schema.json")
};

export type WikiEnity = {
    name: string;
    label?: string;
    kb_id?: string;
};

export type WikiEnitiesAspect = {
    entities: WikiEnity[];
};
