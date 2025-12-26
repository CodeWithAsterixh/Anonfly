import https from "https";

/**
 * Checks if a web API is reachable over HTTP/HTTPS
 * @param {string} url - The URL to test
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<boolean>} True if reachable
 */
export default function checkHttpConnectivity(url: string = "https://example.com", timeoutMs: number = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const req = https.get(url, (res) => {
      // Success if status code is 2xx or 3xx
      resolve(res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 400);
      res.destroy(); // Close the socket immediately
    });

    req.on("error", () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
  });
}
