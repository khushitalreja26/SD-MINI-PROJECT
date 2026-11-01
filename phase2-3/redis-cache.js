const Redis = require("redis");

const DEFAULT_TTL_MS = 60_000;

async function createRedisClient(url = process.env.REDIS_URL || "redis://localhost:6379") {
  const client = Redis.createClient({
    url,
    socket: {
      reconnectStrategy: retries => Math.min(retries * 100, 2000)
    }
  });

  client.on("error", err => {
    console.warn("Redis unavailable; falling back to the database layer:", err.message);
  });

  try {
    await client.connect();
    return client;
  } catch (error) {
    console.warn("Redis connection failed, caching disabled:", error.message);
    return null;
  }
}

function buildCacheKey(prefix, key) {
  return `${prefix}:${String(key)}`;
}

async function readCache(client, key) {
  if (!client) return null;

  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.warn(`Cache read failed for ${key}:`, error.message);
    return null;
  }
}

async function writeCache(client, key, value, ttlMs = DEFAULT_TTL_MS) {
  if (!client) return false;

  try {
    const payload = JSON.stringify(value);
    await client.set(key, payload, {
      PX: ttlMs
    });
    return true;
  } catch (error) {
    console.warn(`Cache write failed for ${key}:`, error.message);
    return false;
  }
}

async function invalidateCache(client, keys) {
  if (!client) return false;

  try {
    const normalizedKeys = [...new Set(keys.filter(Boolean))];
    if (normalizedKeys.length === 0) {
      return true;
    }

    await client.del(normalizedKeys);
    return true;
  } catch (error) {
    console.warn("Cache invalidation failed:", error.message);
    return false;
  }
}

async function cachedFetch({
  client,
  key,
  fetchFn,
  ttlMs = DEFAULT_TTL_MS,
  fallbackOnError = true
}) {
  if (!client) {
    return fetchFn();
  }

  const cachedValue = await readCache(client, key);
  if (cachedValue !== null) {
    return cachedValue;
  }

  try {
    const freshValue = await fetchFn();
    await writeCache(client, key, freshValue, ttlMs);
    return freshValue;
  } catch (error) {
    console.warn(`Cache fetch failed for ${key}; trying database fallback:`, error.message);

    if (fallbackOnError) {
      return fetchFn();
    }

    throw error;
  }
}

module.exports = {
  DEFAULT_TTL_MS,
  createRedisClient,
  buildCacheKey,
  readCache,
  writeCache,
  invalidateCache,
  cachedFetch
};
