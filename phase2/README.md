# Phase 2: Redis caching extension

This folder is intentionally separate and additive. It does not modify the main project files.

Files included:
- `redis-cache.js` – Redis client, read/write/delete helpers, and fallback behavior
- `package.json` – Redis dependency for this extension

Sample usage:

```js
const { createRedisClient, cachedFetch, invalidateCache } = require("./redis-cache");

(async () => {
  const client = await createRedisClient();
  const books = await cachedFetch({
    client,
    key: "books:list",
    fetchFn: async () => [{ id: 1, title: "The Alchemist" }],
    ttlMs: 60000
  });

  console.log(books);
  await invalidateCache(client, ["books:list"]);
})();
```

Notes:
- Keeps the current project code untouched.
- Uses Redis if available, otherwise falls back to the existing DB layer.
