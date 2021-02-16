import cacheManager from "cache-manager";

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

export default cache;
