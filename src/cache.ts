import cacheManager from "cache-manager";
import md5 from "md5";

const CACHE_TTL = 3600 * 24 * 7; // ONE WEEK

const fsStore = require("cache-manager-fs-hash");

const memoryCache = cacheManager.caching({
    store: "memory",
    max: 1000,
    ttl: CACHE_TTL
});

const fsCache = cacheManager.caching({
    store: fsStore,
    options: {
        path: "./cache",
        ttl: CACHE_TTL,
        subdirs: true
    },
    ttl: CACHE_TTL
});

const cache = cacheManager.multiCaching([memoryCache, fsCache]);

export function cachify<T>(
    workLoadFunc: (key: string) => Promise<T>,
    useOriginalKey: boolean = false
) {
    return async (key: string): Promise<T> => {
        if (!useOriginalKey) {
            key = md5(key);
        }

        let value: T;

        try {
            value = await cache.get<T>(key);
        } catch (e) {
            console.log(`Failed to retrieve key "${key}" from cache: ${e}`);
        }

        if (typeof value === "undefined") {
            value = await workLoadFunc(key);
            await cache.set(key, value);
        }

        return value;
    };
}

export function cachifyMultiple<T>(
    workLoadFunc: (keys: string[]) => Promise<T[]>,
    useOriginalKey: boolean = false
) {
    return async (keys: string[]): Promise<T[]> => {
        if (!useOriginalKey) {
            keys = keys.map(key => md5(key));
        }

        const valueList = await Promise.all(
            keys.map(async (key: string, idx) => {
                try {
                    return {
                        key,
                        idx,
                        value: await cache.get<T>(key)
                    };
                } catch (e) {
                    console.log(
                        `Failed to retrieve key "${key}" from cache: ${e}`
                    );
                    return {
                        key,
                        idx,
                        value: undefined
                    };
                }
            })
        );

        const missedKeysInfo = valueList.filter(
            item => typeof item.value === "undefined"
        );

        const retrievedMissedValues = await workLoadFunc(
            missedKeysInfo.map(item => item.key)
        );

        await Promise.all(
            retrievedMissedValues.map(async (value, idx) => {
                valueList[missedKeysInfo[idx].idx].value = value;
                await cache.set(missedKeysInfo[idx].key, value);
            })
        );

        return valueList.map(item => item.value);
    };
}

export const reset = () =>
    new Promise((resolve, reject) => {
        cache.reset(resolve);
    });

export default cache;
