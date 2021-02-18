import {} from "mocha";
import { expect } from "chai";
import cache, { cachify, cachifyMultiple, reset } from "../cache";

describe("Cache Manager", () => {
    beforeEach(async () => {
        await reset();
    });

    describe("#cachify()", () => {
        it("should call workload function with correct key when the key is not availble in cache ", async () => {
            const dummyValue = "dummyValue_" + Math.random().toString();
            const dummyKey = "dummyKey_" + Math.random().toString();
            let calledKey = "";
            const dummyWorkLoad = (key: string) => {
                calledKey = key;
                return Promise.resolve(dummyValue);
            };

            const cachifiedFunc = cachify(dummyWorkLoad, true);
            // dummyKey not set yet
            expect(await cache.get(dummyKey)).to.be.undefined;
            const retrievedValue = await cachifiedFunc(dummyKey);
            // dummyKey has set to dummyValue
            expect(await cache.get(dummyKey)).to.equal(dummyValue);
            expect(calledKey).to.equal(dummyKey);
            expect(retrievedValue).to.equal(dummyValue);
        });

        it("should NOT call workload function with correct key when the key is not availble in cache ", async () => {
            const dummyValue = "dummyValue_" + Math.random().toString();
            const dummyKey = "dummyKey_" + Math.random().toString();
            let calledKey = "";
            const dummyWorkLoad = (key: string) => {
                calledKey = key;
                return Promise.resolve(dummyValue);
            };

            const cachifiedFunc = cachify(dummyWorkLoad, true);
            // set cache directly before calling cached version work load function
            await cache.set(dummyKey, dummyValue);
            const retrievedValue = await cachifiedFunc(dummyKey);
            // dummyKey has set to dummyValue
            expect(await cache.get(dummyKey)).to.equal(dummyValue);
            expect(calledKey).to.equal("");
            expect(retrievedValue).to.equal(dummyValue);
        });
    });

    describe("#cachifyMultiple()", () => {
        it("should call workload function with correct keys for keys are not available in cache", async () => {
            const dummyData = {} as {
                [key: string]: {
                    value: string;
                    key: string;
                    shouldSetCacheInAdvance: boolean;
                    calledKey: string;
                };
            };

            for (let i = 0; i < 20; i++) {
                const dummyValue = "dummyValue_" + Math.random().toString();
                const dummyKey = "dummyKey_" + Math.random().toString();
                const shouldSetCacheInAdvance =
                    Math.random() > 0.5 ? true : false;

                dummyData[dummyKey] = {
                    value: dummyValue,
                    key: dummyKey,
                    shouldSetCacheInAdvance,
                    calledKey: ""
                };
            }

            await Promise.all(
                Object.keys(dummyData).map(async key => {
                    const item = dummyData[key];
                    if (item.shouldSetCacheInAdvance) {
                        await cache.set(item.key, item.value);
                    }
                })
            );

            const dummyWorkLoad = (keys: string[]) => {
                const values = keys.map(key => {
                    if (dummyData[key].calledKey) {
                        throw new Error(
                            "dummyWorkLoad tried to retrieve value from the same key again."
                        );
                    }
                    dummyData[key].calledKey = key;
                    return dummyData[key].value;
                });
                return Promise.resolve(values);
            };

            const cachifiedFunc = cachifyMultiple(dummyWorkLoad, true);
            // key should not be set yet for all not selected items
            await Promise.all(
                Object.keys(dummyData)
                    .filter(key => !dummyData[key].shouldSetCacheInAdvance)
                    .map(async key => {
                        expect(await cache.get(key)).to.be.undefined;
                    })
            );

            const retrievedValues = await cachifiedFunc(Object.keys(dummyData));
            // all not selected key has been set to cache
            await Promise.all(
                Object.keys(dummyData)
                    .filter(key => !dummyData[key].shouldSetCacheInAdvance)
                    .map(async key => {
                        expect(await cache.get(key)).to.equal(
                            dummyData[key].value
                        );
                        expect(dummyData[key].calledKey).to.equal(key);
                    })
            );

            const allValues = Object.values(dummyData).map(item => item.value);

            retrievedValues.forEach((value, idx) => {
                expect(value).to.equal(allValues[idx]);
            });
        });

        it("should NOT call workload function with any keys WHEN all keys are available in cache", async () => {
            const dummyData = {} as {
                [key: string]: {
                    value: string;
                    key: string;
                    shouldSetCacheInAdvance: boolean;
                    calledKey: string;
                };
            };

            for (let i = 0; i < 20; i++) {
                const dummyValue = "dummyValue_" + Math.random().toString();
                const dummyKey = "dummyKey_" + Math.random().toString();
                const shouldSetCacheInAdvance = true;

                dummyData[dummyKey] = {
                    value: dummyValue,
                    key: dummyKey,
                    shouldSetCacheInAdvance,
                    calledKey: ""
                };
            }

            await Promise.all(
                Object.keys(dummyData).map(async key => {
                    const item = dummyData[key];
                    if (item.shouldSetCacheInAdvance) {
                        await cache.set(item.key, item.value);
                    }
                })
            );

            const dummyWorkLoad = (keys: string[]) => {
                const values = keys.map(key => {
                    if (dummyData[key].calledKey) {
                        throw new Error(
                            "dummyWorkLoad tried to retrieve value from the same key again."
                        );
                    }
                    dummyData[key].calledKey = key;
                    return dummyData[key].value;
                });
                return Promise.resolve(values);
            };

            const cachifiedFunc = cachifyMultiple(dummyWorkLoad, true);
            // all key should be set in cache
            await Promise.all(
                Object.keys(dummyData).map(async key => {
                    expect(await cache.get(key)).to.equal(dummyData[key].value);
                })
            );

            const retrievedValues = await cachifiedFunc(Object.keys(dummyData));
            // no key will be retrieved by work load func as all are in cache
            await Promise.all(
                Object.keys(dummyData).map(async key => {
                    expect(dummyData[key].calledKey).to.equal("");
                })
            );

            const allValues = Object.values(dummyData).map(item => item.value);

            retrievedValues.forEach((value, idx) => {
                expect(value).to.equal(allValues[idx]);
            });
        });
    });
});
