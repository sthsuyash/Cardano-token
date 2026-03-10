/**
 * TestUSDM Minting Script
 * Creates a stablecoin-like token for testing marketplace transactions
 * Uses Lucid Evolution with Blockfrost on Preprod network
 */
import { fileURLToPath } from "url";

import {
  Lucid,
  Blockfrost,
  fromText,
  mintingPolicyToId,
  getAddressDetails,
  scriptFromNative,
} from "@lucid-evolution/lucid";
import type {
  LucidEvolution,
  Native,
  Network,
  PolicyId,
  TxHash,
} from "@lucid-evolution/lucid";

import dotenv from "dotenv";
dotenv.config();

// ==================== CONFIGURATION ====================

// Validate required env vars at startup
const BLOCKFROST_API_KEY = process.env.BLOCKFROST_API_KEY;
const NETWORK = process.env.NETWORK as Network;
const WALLET_SEED = process.env.WALLET_SEED;

if (!BLOCKFROST_API_KEY) throw new Error("❌ BLOCKFROST_API_KEY not set!");
if (!NETWORK) throw new Error("❌ NETWORK not set!");
if (!WALLET_SEED) throw new Error("❌ WALLET_SEED not set!");

const CONFIG = {
  BLOCKFROST_API_KEY,
  NETWORK,
  WALLET_SEED,

  // Token configuration
  TOKEN_NAME: "testUSDM",
  TOKEN_SYMBOL: "tUSDM",
  DECIMALS: 6, // Same as real USDM

  // Initial supply - 1 billion testUSDM (with 6 decimals)
  INITIAL_SUPPLY: 1_000_000_000_000_000n,
};

// ==================== HELPERS ====================

function blockfrostUrl(): string {
  return `https://cardano-${CONFIG.NETWORK.toLowerCase()}.blockfrost.io/api/v0`;
}

async function initLucid(): Promise<LucidEvolution> {
  const lucid = await Lucid(
    new Blockfrost(blockfrostUrl(), CONFIG.BLOCKFROST_API_KEY),
    CONFIG.NETWORK
  );
  lucid.selectWallet.fromSeed(CONFIG.WALLET_SEED);
  return lucid;
}

// ==================== TOKEN METADATA ====================

/**
 * CIP-25 compliant metadata for testUSDM
 */
const getTokenMetadata = (policyId: PolicyId) => ({
  [policyId]: {
    [CONFIG.TOKEN_NAME]: {
      name: "Test USDM",
      symbol: CONFIG.TOKEN_SYMBOL,
      decimals: CONFIG.DECIMALS,
      description: "Preprod stablecoin for testing marketplace transactions",
      icon: "https://avatars.githubusercontent.com/u/92094346?v=4",
      version: "1.0",
    },
  },
});

// ==================== MINTING POLICY ====================

/**
 * Creates a simple minting policy
 * This policy allows only the wallet owner to mint
 */
async function createMintingPolicy(lucid: LucidEvolution): Promise<{
  policy: Native;
  policyId: PolicyId;
}> {
  const { paymentCredential } = getAddressDetails(
    await lucid.wallet().address()
  );

  if (!paymentCredential) {
    throw new Error("❌ Could not extract payment credential from wallet address");
  }

  const mintingPolicy: Native = {
    type: "sig",
    keyHash: paymentCredential.hash,
  } as any;

  const policyId = mintingPolicyToId(scriptFromNative(mintingPolicy));

  return { policy: mintingPolicy, policyId };
}

/**
 * Alternative: Time-locked policy (can only mint before a deadline)
 */
async function createTimeLockedPolicy(
  lucid: LucidEvolution,
  deadlineSlot: number
): Promise<{
  policy: Native;
  policyId: PolicyId;
}> {
  const { paymentCredential } = getAddressDetails(
    await lucid.wallet().address()
  );

  if (!paymentCredential) {
    throw new Error("❌ Could not extract payment credential from wallet address");
  }

  const mintingPolicy = {
    type: "all",
    scripts: [
      {
        type: "sig",
        keyHash: paymentCredential.hash,
      },
      {
        type: "before",
        slot: deadlineSlot,
      },
    ],
  } as any;

  const policyId = mintingPolicyToId(scriptFromNative(mintingPolicy));

  return { policy: mintingPolicy, policyId };
}

// ==================== MINTING FUNCTION ====================

/**
 * Mints testUSDM tokens with metadata
 */
async function mintTestUSDM(): Promise<{
  txHash: TxHash;
  policyId: PolicyId;
  assetId: string;
}> {
  console.log("🚀 Initializing Lucid Evolution...");

  const lucid = await initLucid();

  const address = await lucid.wallet().address();
  console.log(`📍 Wallet Address: ${address}`);

  console.log("🔨 Creating minting policy...");
  const { policy, policyId } = await createMintingPolicy(lucid);
  console.log(`📜 Policy ID: ${policyId}`);

  const assetName = fromText(CONFIG.TOKEN_NAME);
  const assetId = policyId + assetName;

  console.log(`💰 Minting ${CONFIG.INITIAL_SUPPLY} ${CONFIG.TOKEN_NAME}...`);

  const tx = await lucid
    .newTx()
    .mintAssets(
      { [assetId]: CONFIG.INITIAL_SUPPLY },
      undefined // Redeemer not needed for native scripts
    )
    .attach.MintingPolicy(scriptFromNative(policy))
    .attachMetadata(721, getTokenMetadata(policyId))
    .complete();

  console.log("✍️  Signing transaction...");
  const signedTx = await tx.sign.withWallet().complete();

  console.log("📤 Submitting transaction...");
  const txHash = await signedTx.submit();

  console.log("✅ Transaction submitted successfully!");
  console.log(`📋 Transaction Hash: ${txHash}`);
  console.log(`🔗 View on CardanoScan: https://preprod.cardanoscan.io/transaction/${txHash}`);

  return { txHash, policyId, assetId };
}

// ==================== BURN FUNCTION ====================

/**
 * Burns (destroys) testUSDM tokens
 */
async function burnTestUSDM(
  policyId: PolicyId,
  amount: bigint
): Promise<TxHash> {
  console.log("🔥 Burning testUSDM tokens...");

  const lucid = await initLucid();
  const { policy } = await createMintingPolicy(lucid);
  const assetName = fromText(CONFIG.TOKEN_NAME);
  const assetId = policyId + assetName;

  const tx = await lucid
    .newTx()
    .mintAssets(
      { [assetId]: -amount }, // Negative amount = burn
      undefined
    )
    .attach.MintingPolicy(scriptFromNative(policy))
    .complete();

  const signedTx = await tx.sign.withWallet().complete();
  const txHash = await signedTx.submit();

  console.log(`✅ Burned ${amount} testUSDM`);
  console.log(`📋 Transaction Hash: ${txHash}`);

  return txHash;
}

// ==================== DISTRIBUTION FUNCTION ====================

/**
 * Distributes testUSDM to multiple addresses (faucet functionality)
 */
async function distributeTestUSDM(
  policyId: PolicyId,
  recipients: Array<{ address: string; amount: bigint }>
): Promise<TxHash> {
  console.log("💸 Distributing testUSDM...");

  const lucid = await initLucid();
  const assetName = fromText(CONFIG.TOKEN_NAME);
  const assetId = policyId + assetName;

  let tx = lucid.newTx();

  for (const recipient of recipients) {
    tx = tx.pay.ToAddress(recipient.address, { [assetId]: recipient.amount });
  }

  const completedTx = await tx.complete();
  const signedTx = await completedTx.sign.withWallet().complete();
  const txHash = await signedTx.submit();

  console.log(`✅ Distributed testUSDM to ${recipients.length} addresses`);
  console.log(`📋 Transaction Hash: ${txHash}`);

  return txHash;
}

// ==================== QUERY BALANCE ====================

/**
 * Check testUSDM balance of an address
 */
async function checkBalance(address: string, policyId: PolicyId): Promise<bigint> {
  const lucid = await initLucid();
  const assetName = fromText(CONFIG.TOKEN_NAME);
  const assetId = policyId + assetName;

  const utxos = await lucid.utxosAt(address);
  const balance = utxos.reduce((sum, utxo) => {
    return sum + (utxo.assets[assetId] ?? 0n);
  }, 0n);

  console.log(`💰 Balance for ${address}: ${balance} testUSDM`);
  return balance;
}

// ==================== MAIN EXECUTION ====================

async function main() {
  try {
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
      case "mint": {
        const result = await mintTestUSDM();
        console.log("\n📝 Save these values:");
        console.log(`POLICY_ID=${result.policyId}`);
        console.log(`ASSET_ID=${result.assetId}`);
        break;
      }
      case "burn": {
        if (!args[1] || !args[2]) {
          console.log("Usage: npm run burn <policyId> <amount>");
          process.exit(1);
        }
        await burnTestUSDM(args[1], BigInt(args[2]));
        break;
      }
      case "distribute": {
        if (!args[1]) {
          console.log("Usage: npm run distribute <policyId>");
          console.log("Edit the script to add recipient addresses");
          process.exit(1);
        }
        await distributeTestUSDM(args[1], [
          { address: "addr_test1...", amount: 1_000_000_000n }, // 1000 testUSDM
          { address: "addr_test1...", amount: 500_000_000n }, //  500 testUSDM
        ]);
        break;
      }
      case "balance": {
        if (!args[1] || !args[2]) {
          console.log("Usage: npm run balance <address> <policyId>");
          process.exit(1);
        }
        await checkBalance(args[1], args[2]);
        break;
      }
      default:
        console.log("Available commands:");
        console.log("  mint           - Mint initial testUSDM supply");
        console.log("  burn           - Burn testUSDM tokens");
        console.log("  distribute     - Distribute testUSDM to addresses");
        console.log("  balance        - Check testUSDM balance");
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}

export {
  mintTestUSDM,
  burnTestUSDM,
  distributeTestUSDM,
  checkBalance,
  createMintingPolicy,
  createTimeLockedPolicy,
};