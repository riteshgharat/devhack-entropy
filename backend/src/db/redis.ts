import IORedis from "ioredis";

let redis: IORedis | null = null;
let isConnected = false;

/**
 * Initialize Redis connection.
 * Fails gracefully — if Redis is unavailable, the game still runs.
 */
export function initRedis(): IORedis | null {
  const url = process.env.REDIS_URL || "redis://localhost:6379";

  try {
    redis = new IORedis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          console.warn("⚠️  Redis: max retries reached, giving up.");
          return null; // stop retrying
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redis.on("connect", () => {
      isConnected = true;
      console.log("🔴 Redis connected");
    });

    redis.on("error", (err) => {
      isConnected = false;
      console.warn(`⚠️  Redis error: ${err.message}`);
    });

    redis.on("close", () => {
      isConnected = false;
    });

    // Attempt connection (non-blocking)
    redis.connect().catch((err) => {
      console.warn(
        `⚠️  Redis unavailable: ${err.message}. Running without Redis.`,
      );
      redis = null;
    });

    return redis;
  } catch (err: any) {
    console.warn(
      `⚠️  Redis init failed: ${err.message}. Running without Redis.`,
    );
    return null;
  }
}

export function getRedis(): IORedis | null {
  return isConnected ? redis : null;
}

export function isRedisAvailable(): boolean {
  return isConnected && redis !== null;
}
