const neo4j = require("neo4j-driver");
const driver = neo4j.driver(
    process.env.NEO4J_URL,
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
);
const session = driver.session();

const personName = "Alice";
session
    .run("CREATE (a:Person {name: $name}) RETURN a", { name: personName })
    .then(result => {
        session.close();

        const singleRecord = result.records[0];
        const node = singleRecord.get(0);

        console.log(node.properties.name);

        // on application exit:
        driver.close();
    })
    .catch(error => console.log(error));
