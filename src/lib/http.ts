/**
 * Safe fetch wrapper:
 * - Implements auto-retry with exponential backoff ONLY for safe GET requests (max 2 retries).
 * - Never auto-retries mutating methods (POST, PATCH, PUT, DELETE).
 * - Supports AbortSignal for debounced cancellation.
 */
export async function safeFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = (options.method || "GET").toUpperCase();
  const isSafeMethod = method === "GET" || method === "HEAD";
  const maxRetries = isSafeMethod ? 2 : 0;

  let attempt = 0;
  let delay = 300;

  while (true) {
    try {
      const res = await fetch(url, options);
      // If safe GET returned 5xx and we have retries left, retry with backoff
      if (isSafeMethod && res.status >= 500 && attempt < maxRetries) {
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      return res;
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") {
        throw err; // Do not retry aborted requests
      }
      if (isSafeMethod && attempt < maxRetries) {
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw err;
    }
  }
}
