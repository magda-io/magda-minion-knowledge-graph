import {
    AuthorizedRegistryClient as Registry,
    Record
} from "@magda/minion-sdk";
//import { unionToThrowable } from "@magda/utils";

//import { FormatAspect } from "./formatAspectDef";

export default async function onRecordFound(
    record: Record,
    registry: Registry
) {
    console.log(record);
}
