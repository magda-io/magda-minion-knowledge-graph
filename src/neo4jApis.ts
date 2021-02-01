import { Transaction, Node, Relationship, Integer } from "neo4j-driver";

type PropType = {
    [key: string]: any;
};

/**
 * Create a neo4j node and return its id
 *
 * @param {Transaction} txc  neo4j transaction instance
 * @param {PropType} [props={}] the properties of the node. Defaults to {}.
 * @param {string[]} [labels=[]] a list of node labels. Defaults to [].
 * @return {*} {Promise<number>}
 */
export async function createNode(
    txc: Transaction,
    props: PropType = {},
    labels: string[] = []
): Promise<Integer> {
    const labelStr = labels.map(item => `:${item}`).join("");
    const result = await txc.run(
        `CREATE (n${labelStr} $props) RETURN id(n) AS id`,
        {
            props
        }
    );

    return result.records[0].get("id");
}

/**
 * Create Relationship between nodes (from n1 -> n2)
 *
 * @param {Transaction} txc
 * @param {Integer} startNodeId
 * @param {Integer} endNodeId
 * @param {string} relType
 * @param {PropType} [props={}]
 * @return {*}  {Promise<Integer>}
 */
export async function createRelationship(
    txc: Transaction,
    startNodeId: Integer,
    endNodeId: Integer,
    relType: string,
    props: PropType = {}
): Promise<Integer> {
    const result = await txc.run(
        `MATCH (a),(b) WHERE id(a) = $id1 AND id(b) = $id2
         CREATE (a)-[r${relType ? `${relType}` : ""} $props]->(b)
         RETURN id(r) AS id`,
        {
            props,
            id1: startNodeId,
            id2: endNodeId
        }
    );
    return result.records[0].get("id");
}

/**
 * find nodes by props or labels
 *
 * @template T
 * @param {Transaction} txc
 * @param {PropType} [props={}]
 * @param {string[]} [labels=[]]
 * @return {*}  {Promise<T[]>}
 */
export async function findNodes(
    txc: Transaction,
    props: PropType = {},
    labels: string[] = [],
    limit?: number
): Promise<Node[]> {
    const labelStr = labels.map(item => `:${item}`).join("");
    const propsMatchStr = Object.keys(props)
        .map(key => `${key}:$${key}`)
        .join(", ");

    const result = await txc.run(
        `MATCH (n${labelStr} ${
            propsMatchStr ? `{${propsMatchStr}}` : ""
        }) RETURN n ${limit > 0 ? `LIMIT ${limit}` : ""}`,
        props
    );
    return result.records.map(item => item.get("n") as Node);
}

/**
 * get node by id
 *
 * @template T
 * @param {Transaction} txc
 * @param {Integer} id
 * @return {*}  {(Promise<Node | null>)}
 */
export async function getNodeById(
    txc: Transaction,
    id: Integer
): Promise<Node | null> {
    const result = await txc.run(`MATCH (n)  WHERE id(n)=$id RETURN n`, {
        id
    });
    if (!result?.records?.length) {
        return null;
    }
    return result.records[0].get("n");
}

/**
 * get relationship between nodes
 *
 * @param {Transaction} txc
 * @param {Integer} nodeId1
 * @param {Integer} nodeId2
 * @return {*}
 */
export async function getRelationshipBetweenNodes(
    txc: Transaction,
    nodeId1: Integer,
    nodeId2: Integer
): Promise<Relationship[]> {
    const result = await txc.run(
        `MATCH (n1)-[r]-(n2) WHERE id(n1) = $id1 AND id(n2) = $id2 RETURN r`,
        {
            id1: nodeId1,
            id2: nodeId2
        }
    );
    return result.records.map(item => item.get("r") as Relationship);
}
