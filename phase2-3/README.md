# Phase 2 and Phase 3 additive extension

This folder is intentionally separate from the existing service and sidecar implementations.
It is designed to add the following without modifying any current working files:

- Phase 2: Redis-based read caching with invalidation on write operations
- Phase 3: weighted routing based on the control plane trafficWeight values

Files in this folder:

- `redis-cache.js` – Redis wrapper with in-memory fallback behavior
- `weighted-router.js` – weighted target selection using the control plane state
- `package.json` – lightweight dependency file for the Redis client

How to use:

1. Install dependencies in this folder:

```bash
cd phase2-3
npm install
```

2. Start Redis locally (optional for a real validation run):

```bash
redis-server
```

3. You can then import the modules from a future integration point:

```js
const { createRedisClient, cachedFetch, invalidateCache } = require("./redis-cache");
const { chooseWeightedTarget } = require("./weighted-router");
```

Important notes:

- These files do not replace the current service code or sidecars.
- They are meant to be added as a separate extension layer.
- The existing control plane continues to expose `/traffic-weights` and `/health-status`.
- The weighted router reads those values and selects a service target using the configured traffic distributions.
