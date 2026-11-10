/**
 * VPS Smart Bridge & Automated Zero-Downtime Fallback
 * 
 * Flow:
 * 1. When VPS is online and VPS_BACKEND_URL is set in Vercel:
 *    100% of API traffic is forwarded to the high-performance VPS server.
 *    Response is returned with header "x-served-by: vps-primary".
 * 
 * 2. If VPS is down, stopped, or unreachable (network failure / timeout):
 *    Vercel automatically and instantly executes the local serverless function.
 *    Response is returned with header "x-served-by: vercel-fallback".
 *    Zero user downtime!
 * 
 * 3. On VPS itself:
 *    IS_VPS="true" is set, so server.js executes handlers directly with zero proxying.
 */

async function routeWithVpsFallback(req, res, localHandler) {
  // If running directly on VPS, bypass proxy and execute locally
  if (process.env.IS_VPS === "true" || process.env.IS_VPS === "1") {
    return localHandler(req, res);
  }

  const vpsUrl = (process.env.VPS_BACKEND_URL || "").trim().replace(/\/+$/, "");
  if (!vpsUrl) {
    return localHandler(req, res);
  }

  // Prevent infinite proxy loops if requests accidentally loop
  if (req.headers && req.headers["x-via-vercel-proxy"] === "1") {
    return localHandler(req, res);
  }

  try {
    const targetUrl = `${vpsUrl}${req.url}`;
    const forwardHeaders = {};

    // Forward all relevant request headers
    if (req.headers) {
      for (const [k, v] of Object.entries(req.headers)) {
        const lower = k.toLowerCase();
        if (!["host", "connection", "transfer-encoding"].includes(lower)) {
          forwardHeaders[lower] = v;
        }
      }
    }

    // Attach VPS security bridge secret and client tracking headers
    if (process.env.VPS_BRIDGE_SECRET) {
      forwardHeaders["x-vps-bridge-secret"] = process.env.VPS_BRIDGE_SECRET;
    }
    const clientIp = req.headers["x-forwarded-for"] || (req.socket && req.socket.remoteAddress) || "";
    if (clientIp) {
      forwardHeaders["x-forwarded-for"] = clientIp;
    }
    forwardHeaders["x-via-vercel-proxy"] = "1";

    let timeoutMs = parseInt(process.env.VPS_PROXY_TIMEOUT_MS, 10) || 6000;
    if (req.url && (req.url.includes("admin") || req.url.includes("wallet") || req.url.includes("withdraw"))) {
      timeoutMs = 45000; // 45s timeout for on-chain blockchain payout confirmation
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let bodyData = undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      if (typeof req.body === "object" && req.body !== null) {
        bodyData = JSON.stringify(req.body);
        if (!forwardHeaders["content-type"]) {
          forwardHeaders["content-type"] = "application/json";
        }
      } else if (typeof req.body === "string" || Buffer.isBuffer(req.body)) {
        bodyData = req.body;
      }
    }

    const vpsRes = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: bodyData,
      signal: controller.signal
    });
    clearTimeout(timer);

    // VPS is alive and responded! Forward full response to client
    res.status(vpsRes.status);
    vpsRes.headers.forEach((val, key) => {
      const lowerKey = key.toLowerCase();
      if (!["content-encoding", "transfer-encoding", "connection", "keep-alive"].includes(lowerKey)) {
        res.setHeader(key, val);
      }
    });
    res.setHeader("x-served-by", "vps-primary");

    const arrayBuf = await vpsRes.arrayBuffer();
    res.send(Buffer.from(arrayBuf));
    return;
  } catch (err) {
    // VPS is offline, unreachable, or timed out. Log and gracefully fallback to Vercel
    console.warn(`[VPS Fallback Active] VPS (${vpsUrl}) unreachable: ${err.message}. Gracefully serving via Vercel.`);
    if (!res.headersSent) {
      res.setHeader("x-served-by", "vercel-fallback");
    }
  }

  // Gracefully execute local Vercel serverless function
  return localHandler(req, res);
}

function withVpsFallback(localHandler) {
  return async function(req, res) {
    return routeWithVpsFallback(req, res, localHandler);
  };
}

module.exports = {
  routeWithVpsFallback,
  withVpsFallback
};
