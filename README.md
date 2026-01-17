# Coset Relayer Node

Coset Relayer Node is the backend that powers Coset oracle reads and updates.

At a high level it:

- serves **free read** endpoints for any deployed oracle
- performs **paid updates** by fetching provider data, writing it on-chain, and paying the provider
- hosts an **x402 facilitator** so clients can settle payments
- stores oracle metadata + payment history in MongoDB

## How updates work

1. A requester calls `POST /update` with `networkName`, `oracleAddress`, and `paymentToken`.
2. The node loads oracle details on-chain (oracle + factory), estimates the update gas cost, and computes a **total cost**:
   - `totalCost = updatePrice + estimatedGasCostInToken`
3. The route is protected by **x402** (`exact` scheme). The requester settles the payment to the node’s admin wallet.
4. After payment, the node calls the provider’s private API URL (stored in MongoDB) with:
   - `Authorization: Bearer <providerAccessToken>`
5. The node writes the new payload on-chain by calling:
   - `OracleFactory.updateOracleData(...)`
6. The provider is paid via **EIP-3009** (`transferWithAuthorization`) inside the factory call.
7. The node saves a `Payment` record in MongoDB (total paid, provider earning, platform fee, gas fee, currency, network).

## HTTP API

### Health

- `GET /health` → `{ status: "OK" }`

### Read (free)

All read routes are namespaced under:

- `GET /call/:oracleAddress/...`

Endpoints:

- `GET /call/:oracleAddress/get-data`
  - strict read (oracle-level staleness checks apply)
- `GET /call/:oracleAddress/get-data-without-check`
  - non-strict read
- `GET /call/:oracleAddress/get-update-metadata`
  - returns `recommendedUpdateDuration` and `lastUpdateTimestamp`
- `GET /call/:oracleAddress/get-data-update-price`
  - returns `units` and `amount` (formatted with 6 decimals)
- `GET /call/:oracleAddress/get-balance?sender=0x...&currency=0x...`
  - reads an ERC20 balance and returns `units` and `amount`

Important:

- The node resolves `:oracleAddress` through MongoDB (`Oracle` document). If the oracle is not in the DB, reads return `404`.

### Update (paid)

- `POST /update`

Body:

```json
{
  "networkName": "mantle-testnet",
  "oracleAddress": "0x...",
  "paymentToken": "0x..."
}
```

Notes:

- This route is protected by x402 payment middleware. In practice you should call it via a client that supports x402 (e.g. Coset SDK).
- The node uses the admin wallet (`WALLET_PRIVATE_KEY`) as the `payTo` address for x402 payments.

### x402 facilitator

The node exposes an x402 facilitator under:

- `POST /facilitator/:chainId/verify`
- `POST /facilitator/:chainId/settle`
- `GET /facilitator/:chainId/supported`
- `GET /facilitator/chains`

This is used by the x402 middleware on `/update` (and by clients during payment settlement).

## Configuration

Required:

- `MONGO_URI`: MongoDB connection string
- `SERVER_PORT`: HTTP port to listen on
- `WALLET_PRIVATE_KEY`: admin wallet private key (used for x402 facilitator + on-chain updates)
- `LOG_DIR`: directory for `info.log` and `error.log`

## Supported networks

Networks and token addresses are defined in `lib/networks.ts`:

- `mantle-testnet` (chainId `5003`)
- `mantle` (chainId `5000`)

## Run locally

```bash
cd node
npm install
npm run dev
```

Build + run:

```bash
npm run build
npm start
```
