# TestUSDM - Cardano Preprod Stablecoin

testUSDM token implementation for Cardano Preprod/Preview networks.

> [!IMPORTANT]
> Due to a packaging issue with `libsodium-wrappers-sumo`, we need to copy the ESM build from `libsodium-sumo` to ensure it works correctly in our Node.js environment. Run the following command before building or running the project:

```bash
cp node_modules/libsodium-sumo/dist/modules-sumo-esm/libsodium-sumo.mjs node_modules/libsodium-wrappers-sumo/dist/modules-sumo-esm/libsodium-sumo.mjs
```

## Quick Start

### Setup

```bash
cp .env.example .env
# Edit .env with BLOCKFROST_API_KEY and WALLET_SEED
```

### Run with Docker

```bash
# Build image
docker-compose build --no-cache

# Mint tokens
docker-compose run --rm testusdm npm run mint

# Save POLICY_ID and ASSET_ID from output
```

## Commands

### Token Operations

```bash
docker-compose run --rm testusdm npm run mint
docker-compose run --rm testusdm npm run burn <policyId> <amount>
docker-compose run --rm testusdm npm run distribute <policyId>
docker-compose run --rm testusdm npm run balance <address> <policyId>
```

### Wallet

```bash
docker-compose run --rm testusdm npm run wallet:generate
docker-compose run --rm testusdm npm run wallet:info
```

### Faucet

```bash
docker-compose up faucet
# http://localhost:3000
```

## API Endpoints

**POST /request**

```bash
curl -X POST http://localhost:3000/request \
  -H "Content-Type: application/json" \
  -d '{"address": "addr_test1..."}'
```

**GET /balance/:address**

```bash
curl http://localhost:3000/balance/addr_test1...
```

## Integration

```typescript
import { Lucid, Blockfrost } from "@lucid-evolution/lucid";

const lucid = await Lucid(
  new Blockfrost(
    "https://cardano-preprod.blockfrost.io/api/v0",
    BLOCKFROST_API_KEY
  ),
  "Preprod"
);

const walletAPI = await window.cardano.lace.enable();
lucid.selectWallet.fromAPI(walletAPI);

const tx = await lucid
  .newTx()
  .pay.ToAddress(sellerAddress, { [testUSDM_AssetId]: price })
  .pay.ToAddress(buyerAddress, { [nft_AssetId]: 1n })
  .complete();

const signedTx = await tx.sign.withWallet().complete();
const txHash = await signedTx.submit();
```

## Structure

```md
testusdm-stablecoin/
├── src/
│   ├── mint-testusdm.ts
│   ├── faucet-server.ts
│   └── wallet-utils.ts
│   
├── tests/
│   └── test-marketplace.ts
├── Dockerfile
├── docker-compose.yml
├── package.json
└── .env
```

## Troubleshooting

### Rebuild

```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose run --rm testusdm npm run mint
```

### Get Test ADA

<https://docs.cardano.org/cardano-testnet/tools/faucet/>

### View Transaction

<https://preprod.cardanoscan.io/transaction/TX_HASH>

## Resources

- Lucid Evolution: <https://anastasia-labs.github.io/lucid-evolution/>
- Blockfrost: <https://docs.blockfrost.io/>
- Cardano Faucet: <https://docs.cardano.org/cardano-testnet/tools/faucet/>

## License

MIT
