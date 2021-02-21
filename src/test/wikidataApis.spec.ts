import {} from "mocha";
import { expect } from "chai";
import { getEntityAgg } from "../wikidataApis";
import delay from "../delay";

describe("Wikidata APIs", () => {
    describe("#getEntityAgg()", () => {
        it("should hold on the request before reach the time limit.", async function(this) {
            this.timeout(6000);
            const dummyValueItems = new Array(15).fill(0).map(item => ({
                key: "dummyKey_" + Math.random().toString(),
                value: "dummyValue_" + Math.random().toString()
            }));

            let callCount = 0;

            const dummyMultiEnityLoader: any = async (ids: string[]) => {
                if (!ids.length) {
                    throw new Error(`ids cannot be empty []!`);
                }
                callCount++;
                return ids.map(
                    id => dummyValueItems.find(item => item.key === id).value
                );
            };

            const first11ResultPromise = Promise.all(
                dummyValueItems.slice(0, 12).map(async item => {
                    return await getEntityAgg(
                        item.key,
                        dummyMultiEnityLoader,
                        3000,
                        20
                    );
                })
            );

            // wait for 1 seconds
            await delay(1000);

            // should not call `dummyMultiEnityLoader` yet as not either reach 20 items or 3 seconds
            expect(callCount).to.be.equal(0);

            await delay(2500);

            // should called `dummyMultiEnityLoader` only once now as it reached 3 seconds
            expect(callCount).to.be.equal(1);

            const first11Result = await first11ResultPromise;
            // fetched result should be correct
            first11Result.forEach((value, idx) =>
                expect(value).to.be.equal(dummyValueItems[idx].value)
            );
        });

        it("should process 50 request on 0~600ms interval when setting max no. to 10 and max. time to 500ms", async function(this) {
            this.timeout(33000);
            const totalSampleNumber = 50;
            const dummyValueItems = new Array(totalSampleNumber)
                .fill(0)
                .map(item => ({
                    key: "dummyKey_" + Math.random().toString(),
                    value: "dummyValue_" + Math.random().toString()
                }));

            const callStack: string[][] = [];

            const dummyMultiEnityLoader: any = async (ids: string[]) => {
                if (!ids.length) {
                    throw new Error(`ids cannot be empty []!`);
                }
                callStack.push(ids);
                return ids.map(
                    id => dummyValueItems.find(item => item.key === id).value
                );
            };

            const resultValuesPromise: Promise<string>[] = [];
            for (let i = 0; i < totalSampleNumber; i++) {
                const delayTime = Math.ceil(Math.random() * 600);
                await delay(delayTime);
                const valuePromise = getEntityAgg(
                    dummyValueItems[i].key,
                    dummyMultiEnityLoader,
                    500,
                    10
                );
                resultValuesPromise.push(valuePromise as any);
            }
            const resultValues = await Promise.all(resultValuesPromise);
            resultValues.forEach((value, idx) =>
                expect(value).to.be.equal(dummyValueItems[idx].value)
            );
        });

        it("should hold on the request before reach the pending request limit.", async function(this) {
            this.timeout(8000);
            const dummyValueItems = new Array(25).fill(0).map(item => ({
                key: "dummyKey_" + Math.random().toString(),
                value: "dummyValue_" + Math.random().toString()
            }));

            let callCount = 0;

            const dummyMultiEnityLoader: any = async (ids: string[]) => {
                if (!ids.length) {
                    throw new Error(`ids cannot be empty []!`);
                }
                callCount++;
                return ids.map(
                    id => dummyValueItems.find(item => item.key === id).value
                );
            };

            const first11ResultPromise = Promise.all(
                dummyValueItems.slice(0, 12).map(async item => {
                    return await getEntityAgg(
                        item.key,
                        dummyMultiEnityLoader,
                        3000,
                        20
                    );
                })
            );

            // wait for 0.5 seconds
            await delay(500);

            // should not call `dummyMultiEnityLoader` yet as not either reach 20 items or 3 seconds
            expect(callCount).to.be.equal(0);

            const restResultPromise = Promise.all(
                dummyValueItems.slice(12).map(async item => {
                    return await getEntityAgg(
                        item.key,
                        dummyMultiEnityLoader,
                        3000,
                        20
                    );
                })
            );

            // wait for 0.5 seconds
            await delay(500);

            // should called `dummyMultiEnityLoader` only once now as it cached reached 20 requests
            // the request will retrieve 20 items
            expect(callCount).to.be.equal(1);

            // wait for 2 seconds
            await delay(2001);

            // should still just called `dummyMultiEnityLoader` only once as it has reached 3s since last request
            // Last request happened around the first 0.5-1s when 20 records was reached
            expect(callCount).to.be.equal(1);

            // wait for 1 seconds
            await delay(1000);

            // should called `dummyMultiEnityLoader` twice now as it has reached 3s since last request
            expect(callCount).to.be.equal(2);

            const allResult = (await first11ResultPromise).concat(
                await restResultPromise
            );
            // fetched result should be correct
            expect(allResult.length).to.be.equal(25);
            allResult.forEach((value, idx) =>
                expect(value).to.be.equal(dummyValueItems[idx].value)
            );
            // should called `dummyMultiEnityLoader` twice in total
            expect(callCount).to.be.equal(2);
        });
    });
});
