/**
 * TestUSDM Faucet Server
 * Simple HTTP server to distribute testUSDM to users for testing
 */

import { createServer } from "http";
import { distributeTestUSDM, checkBalance } from "./mint-testusdm";
import * as dotenv from "dotenv";

dotenv.config();

// ==================== CONFIGURATION ====================

const FAUCET_CONFIG = {
  PORT: parseInt(process.env.FAUCET_PORT || "3000"),
  POLICY_ID: process.env.TESTUSDM_POLICY_ID || "",
  FAUCET_AMOUNT: BigInt(process.env.FAUCET_AMOUNT || "1000000000"), // 1000 testUSDM
  MAX_REQUESTS_PER_DAY: parseInt(process.env.MAX_REQUESTS_PER_DAY || "5"),
};

// Simple in-memory rate limiting
const requestLog: Map<string, number[]> = new Map();

// ==================== RATE LIMITING ====================

function checkRateLimit(address: string): boolean {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  
  const requests = requestLog.get(address) || [];
  const recentRequests = requests.filter((timestamp) => timestamp > dayAgo);
  
  if (recentRequests.length >= FAUCET_CONFIG.MAX_REQUESTS_PER_DAY) {
    return false;
  }
  
  recentRequests.push(now);
  requestLog.set(address, recentRequests);
  return true;
}

// ==================== SERVER ====================

const server = createServer(async (req, res) => {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Parse URL
  const url = new URL(req.url || "", `http://localhost:${FAUCET_CONFIG.PORT}`);

  // ==================== ROUTES ====================

  // GET / - Faucet info
  if (url.pathname === "/" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        faucet: "TestUSDM Faucet",
        network: process.env.NETWORK || "Preprod",
        amount: FAUCET_CONFIG.FAUCET_AMOUNT.toString(),
        maxRequestsPerDay: FAUCET_CONFIG.MAX_REQUESTS_PER_DAY,
        endpoints: {
          request: "POST /request",
          balance: "GET /balance/:address",
        },
      })
    );
    return;
  }

  // POST /request - Request testUSDM
  if (url.pathname === "/request" && req.method === "POST") {
    let body = "";
    
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const { address } = JSON.parse(body);

        if (!address || !address.startsWith("addr_test")) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid testnet address" }));
          return;
        }

        // Check rate limit
        if (!checkRateLimit(address)) {
          res.writeHead(429, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Rate limit exceeded",
              message: `Maximum ${FAUCET_CONFIG.MAX_REQUESTS_PER_DAY} requests per 24 hours`,
            })
          );
          return;
        }

        // Distribute tokens
        console.log(`💸 Sending ${FAUCET_CONFIG.FAUCET_AMOUNT} testUSDM to ${address}`);
        
        const txHash = await distributeTestUSDM(FAUCET_CONFIG.POLICY_ID, [
          { address, amount: FAUCET_CONFIG.FAUCET_AMOUNT },
        ]);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
            txHash,
            amount: FAUCET_CONFIG.FAUCET_AMOUNT.toString(),
            explorerUrl: `https://preprod.cardanoscan.io/transaction/${txHash}`,
          })
        );
      } catch (error) {
        console.error("Error distributing tokens:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Failed to distribute tokens",
            message: error instanceof Error ? error.message : "Unknown error",
          })
        );
      }
    });
    return;
  }

  // GET /balance/:address - Check balance
  if (url.pathname.startsWith("/balance/") && req.method === "GET") {
    const address = url.pathname.split("/")[2];

    if (!address || !address.startsWith("addr_test")) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid testnet address" }));
      return;
    }

    try {
      const balance = await checkBalance(address, FAUCET_CONFIG.POLICY_ID);
      
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          address,
          balance: balance.toString(),
          formattedBalance: (Number(balance) / 1_000_000).toFixed(6),
        })
      );
    } catch (error) {
      console.error("Error checking balance:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Failed to check balance",
          message: error instanceof Error ? error.message : "Unknown error",
        })
      );
    }
    return;
  }

  // 404
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

// ==================== START SERVER ====================

server.listen(FAUCET_CONFIG.PORT, () => {
  console.log(`🚰 TestUSDM Faucet running on http://localhost:${FAUCET_CONFIG.PORT}`);
  console.log(`💰 Distributing ${FAUCET_CONFIG.FAUCET_AMOUNT} testUSDM per request`);
  console.log(`⏱️  Max ${FAUCET_CONFIG.MAX_REQUESTS_PER_DAY} requests per 24 hours per address`);
  console.log("\nEndpoints:");
  console.log("  GET  /              - Faucet info");
  console.log("  POST /request       - Request testUSDM");
  console.log("  GET  /balance/:addr - Check balance");
});
