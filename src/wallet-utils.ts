/**
 * Generate New Cardano Wallet
 * Creates a new wallet with seed phrase and addresses for Preprod/Preview
 */

import { Lucid, Blockfrost, generateSeedPhrase } from "@lucid-evolution/lucid";
import type { LucidEvolution, UTxO } from "@lucid-evolution/lucid";

// ==================== GENERATE WALLET ====================

async function generateNewWallet(network: "Preprod" | "Preview" = "Preprod") {
  console.log("🔐 Generating new Cardano wallet...\n");

  // Generate 24-word seed phrase
  const seedPhrase = generateSeedPhrase();

  console.log("✅ Seed Phrase Generated:");
  console.log("━".repeat(80));
  console.log(seedPhrase);
  console.log("━".repeat(80));
  console.log("");
  console.log("⚠️  IMPORTANT: Save this seed phrase securely!");
  console.log("   - Never share it with anyone");
  console.log("   - Store it in a password manager");
  console.log("   - Never commit it to version control");
  console.log("");

  // Initialize Lucid (you need a Blockfrost key for this part)
  // If you don't have one yet, skip to just showing the seed
  const blockfrostKey = process.env.BLOCKFROST_API_KEY;

  if (!blockfrostKey) {
    console.log("💡 To see wallet addresses, add BLOCKFROST_API_KEY to .env");
    console.log("");
    console.log("📝 Add this to your .env file:");
    console.log(`WALLET_SEED="${seedPhrase}"`);
    return;
  }

  try {
    const lucid = await Lucid(
      new Blockfrost(
        `https://cardano-${network.toLowerCase()}.blockfrost.io/api/v0`,
        blockfrostKey
      ),
      network
    );

    lucid.selectWallet.fromSeed(seedPhrase);

    const address = await lucid.wallet().address();
    const rewardAddress = await lucid.wallet().rewardAddress();

    console.log("📬 Wallet Addresses:");
    console.log("━".repeat(80));
    console.log(`Network:         ${network}`);
    console.log(`Payment Address: ${address}`);
    if (rewardAddress) {
      console.log(`Reward Address:  ${rewardAddress}`);
    }
    console.log("━".repeat(80));
    console.log("");

    console.log("💰 Get Test ADA:");
    console.log(`   https://docs.cardano.org/cardano-testnet/tools/faucet/`);
    console.log("");
    console.log("📝 Add to your .env file:");
    console.log(`WALLET_SEED="${seedPhrase}"`);
    console.log("");

  } catch (error) {
    console.error("Error generating addresses:", error);
    console.log("");
    console.log("📝 Add this to your .env file:");
    console.log(`WALLET_SEED="${seedPhrase}"`);
  }
}

// ==================== IMPORT EXISTING WALLET ====================

async function importWallet(
  seedPhrase: string,
  network: "Preprod" | "Preview" = "Preprod"
) {
  console.log("📥 Importing wallet...\n");

  const blockfrostKey = process.env.BLOCKFROST_API_KEY;

  if (!blockfrostKey) {
    console.log("❌ BLOCKFROST_API_KEY not set in .env");
    return;
  }

  try {
    const lucid = await Lucid(
      new Blockfrost(
        `https://cardano-${network.toLowerCase()}.blockfrost.io/api/v0`,
        blockfrostKey
      ),
      network
    );

    lucid.selectWallet.fromSeed(seedPhrase);

    const address = await lucid.wallet().address();
    const rewardAddress = await lucid.wallet().rewardAddress();

    // Get balance
    const utxos = await lucid.wallet().getUtxos();
    const lovelace = utxos.reduce((sum: bigint, utxo: UTxO) => sum + utxo.assets.lovelace, 0n);
    const ada = Number(lovelace) / 1_000_000;

    console.log("✅ Wallet Imported Successfully!");
    console.log("━".repeat(80));
    console.log(`Network:         ${network}`);
    console.log(`Payment Address: ${address}`);
    if (rewardAddress) {
      console.log(`Reward Address:  ${rewardAddress}`);
    }
    console.log(`Balance:         ${ada.toFixed(6)} ADA`);
    console.log("━".repeat(80));
    console.log("");

    if (ada === 0) {
      console.log("💡 Wallet is empty. Get test ADA:");
      console.log(`   https://docs.cardano.org/cardano-testnet/tools/faucet/`);
    }

  } catch (error) {
    console.error("❌ Error importing wallet:", error);
  }
}

// ==================== WALLET INFO ====================

async function showWalletInfo(network: "Preprod" | "Preview" = "Preprod") {
  const seedPhrase = process.env.WALLET_SEED;

  if (!seedPhrase) {
    console.log("❌ WALLET_SEED not set in .env");
    console.log("");
    console.log("💡 To generate a new wallet, run:");
    console.log("   npm run wallet:generate");
    return;
  }

  await importWallet(seedPhrase, network);
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const network = (args[1] as "Preprod" | "Preview") || "Preprod";

  switch (command) {
    case "generate":
      await generateNewWallet(network);
      break;

    case "import":
      if (!args[1]) {
        console.log("Usage: npm run wallet:import <seed-phrase>");
        process.exit(1);
      }
      await importWallet(args.slice(1, 25).join(" "), network);
      break;

    case "info":
      await showWalletInfo(network);
      break;

    default:
      console.log("Wallet Management Commands:");
      console.log("");
      console.log("  generate      - Generate a new wallet");
      console.log("  import <seed> - Import existing wallet");
      console.log("  info          - Show current wallet info");
      console.log("");
      console.log("Examples:");
      console.log("  npm run wallet:generate");
      console.log("  npm run wallet:generate Preview");
      console.log("  npm run wallet:info");
  }
}

main().catch(console.error);

export { generateNewWallet, importWallet, showWalletInfo };