# GovBond — Municipal Bond Tokenization Protocol

> Municipal bond issuance and settlement on Initia EVM appchain (govbond-1).
> Built for Indonesian regional governments (Pemerintah Daerah).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-blue.svg)](https://soliditylang.org)
[![Network](https://img.shields.io/badge/Network-Initia%20EVM-blue.svg)](https://explorer.testnet.initia.xyz)
[![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-yellow.svg)](https://hardhat.org)

## Overview

GovBond tokenizes Indonesian regional government bonds (*obligasi daerah*) on the Initia EVM appchain (govbond-1), enabling compliant on-chain subscription, coupon distribution, and redemption. The protocol implements ERC-3643 (T-REX) for KYC-gated security tokens and ERC-7540 for asynchronous vault mechanics, giving treasury teams full control over investor eligibility and bond lifecycle.

The system is designed for the Palembang Municipal Bond 2025 (PMB25) as a reference deployment, but the `BondFactory` contract allows any authorized issuer to deploy new bond series without redeploying the core infrastructure.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                       Investor                           │
│  requestDeposit() ──► GovBondVault ──► fulfillDeposits() │
│  deposit()        ◄──             ◄── (admin)            │
│  requestRedeem()  ──►             ──► fulfillRedemptions │
│  redeem()         ◄──             ◄── (admin)            │
└──────────────────────────────────────────────────────────┘
         │ mint/burn                    │ canTransfer
         ▼                              ▼
  GovBondToken (PMB25)          ComplianceModule
  ERC-3643 security token            │
         │ isVerified                  │ isVerified
         ▼                            ▼
  IdentityRegistry (KYC)       IdentityRegistry (KYC)

  IDRPToken — settlement token (2 decimals, MINTER_ROLE gated)

  BondFactory — deploys GovBondToken + GovBondVault pairs
```

## Contracts

| Contract | Description | Audited |
|---|---|---|
| `IDRPToken.sol` | Indonesian Rupiah stablecoin, 2 decimals, MINTER_ROLE gated, testnet faucet | ✓ |
| `IdentityRegistry.sol` | On-chain KYC whitelist with country codes | ✓ |
| `ComplianceModule.sol` | Transfer rule engine: KYC, freeze, country blocklist, max holding cap | ✓ |
| `GovBondToken.sol` | ERC-3643 bond token, 0 decimals, maturity enforcement, forced transfer | ✓ |
| `GovBondVault.sol` | ERC-7540 async vault: subscription, coupon distribution, redemption | ✓ |
| `BondFactory.sol` | Multi-bond deployer, ISSUER_ROLE gated | ✓ |

## Token Standards

- **ERC-3643 (T-REX)** — Permissioned security token. Every transfer checks `ComplianceModule.canTransfer()`. Agents can freeze wallets and execute forced transfers for regulatory compliance.
- **ERC-7540** — Asynchronous tokenized vault. Investors request deposits/redemptions; admins fulfill them in batches. Prevents front-running and enables off-chain KYC verification before minting.
- **Privacy model** — All investor data (KYC status, country, holdings) is on-chain but pseudonymous. The `IdentityRegistry` maps wallet addresses to ISO-2 country codes; no PII is stored on-chain.

## Bond Parameters

| Parameter | Value |
|---|---|
| Name | Palembang Municipal Bond 2025 |
| Symbol | PMB25 |
| Decimals | 0 (whole units only) |
| Face Value | Rp 1,000,000 per unit (`100_000_000` IDRP base units) |
| Coupon Rate | 750 bps (7.5% p.a.) |
| Maturity | 1 year from deployment |
| Max Supply | 100,000 units |
| Settlement | IDRP (2 decimals) |

## Quick Start

### Prerequisites

- Node.js 18+
- MetaMask or Initia-compatible wallet (Keplr/Leap)
- Initia testnet tokens — [faucet](https://app.testnet.initia.xyz/faucet)

### Installation

```bash
git clone https://github.com/xvader/GovBond.git
cd GovBond
npm install
cp .env.example .env
# Edit .env: add PRIVATE_KEY and optionally ARBISCAN_API_KEY
```

### Compile & Test

```bash
npm run compile
npm test
npm run coverage
```

### Deploy

```bash
# Deploy all contracts to Initia EVM appchain
npm run deploy:initia

# Deploy to local node
npm run deploy:initia-local
```

Both scripts write addresses to `deployments/initia-testnet.json` and `frontend/deployments.json`.

### Frontend Setup

After deployment, open any of the frontend apps directly in a browser (no build step):

```bash
cd frontend
npx serve .   # or: python3 -m http.server 8080
```

## Frontend Apps

| App | File | Purpose |
|---|---|---|
| Investor Portal | `frontend/index.html` | Subscribe, view holdings, claim coupons, redeem |
| Issuer Portal | `frontend/deploy-bond.html` | Deploy new bond series via BondFactory |
| Admin Dashboard | `frontend/admin.html` | KYC management, fulfillment, coupon distribution, compliance |

## User Flows

**Subscription:**
1. Investor calls `idrp.approve(vault, amount)`
2. Investor calls `vault.requestDeposit(amount, controller, owner)`
3. Admin calls `vault.fulfillDeposits([investor])`
4. Investor calls `vault.deposit(amount, receiver, controller)` → receives PMB25

**Coupon Distribution:**
1. Admin calls `idrp.approve(vault, totalPool)`
2. Admin calls `vault.distributeCoupon(totalPool)` → pro-rata payout to all holders

**Redemption (post-maturity):**
1. Investor calls `bond.approve(vault, shares)`
2. Investor calls `vault.requestRedeem(shares, controller, owner)`
3. Admin calls `vault.fulfillRedemptions([investor])`
4. Investor calls `vault.redeem(shares, receiver, controller)` → receives IDRP, PMB25 burned

## Security

See [SECURITY_AUDIT.md](SECURITY_AUDIT.md) for the full audit report.

Key protections:
- `ReentrancyGuard` on all vault state-changing functions
- KYC-gated transfers — no token movement without both parties in `IdentityRegistry`
- Maturity enforcement — redemption requests revert before `maturityDate`
- No public mint — `IDRPToken` requires `MINTER_ROLE`; faucet has 24hr cooldown
- Custom errors for gas-efficient reverts in `GovBondVault`
- `forcedTransfer` uses a flag to bypass compliance for regulatory actions; flag is resettable by admin

## IDRP Token

`IDRPToken` uses **2 decimals** (sen subunit). Key conversions:

| Value | IDRP base units |
|---|---|
| Rp 1.00 | `100` |
| Rp 1,000,000.00 (1 bond unit) | `100_000_000` |
| Rp 100,000,000.00 (test mint) | `10_000_000_000` |

The vault requires `MINTER_ROLE` on `IDRPToken` to process redemptions. After deploying a new bond via `BondFactory`, the IDRP admin must manually call `idrp.grantRole(MINTER_ROLE, vaultAddress)`.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PRIVATE_KEY` | Yes | Deployer wallet private key (no `0x` prefix) |
| `INITIA_RPC_URL` | Yes | RPC URL from `weave init` |
| `INITIA_CHAIN_ID` | Yes | Chain ID assigned by `weave init` |
| `INITIA_EXPLORER_URL` | No | Block explorer URL when available |

## Contract Addresses

See `deployments/initia-testnet.json` after running the deploy scripts. The file is excluded from git (`.gitignore`) — add addresses to this table after deployment:

| Contract | Address |
|---|---|
| IDRPToken | — |
| IdentityRegistry | — |
| ComplianceModule | — |
| GovBondToken (PMB25) | — |
| GovBondVault | — |
| BondFactory | — |

## Development

```bash
npm run node          # Start local Hardhat node
npm run deploy:local  # Deploy to local node
npm test              # Run test suite
npm run coverage      # Coverage report
```

## License

MIT — see [LICENSE](LICENSE)

---

## Initia EVM Deployment

### Appchain Setup (govbond-1)

```bash
# 1. Install Initia agent skills
npx skills add initia-labs/agent-skills

# 2. Launch rollup with weave init
weave init
# Choices:
#   Action:           Launch a new rollup
#   L1:               Testnet (initiation-2)
#   VM:               EVM
#   Chain ID:         govbond-1
#   Gas denom:        umin (default)
#   Moniker:          govbond-operator
#   DA:               Initia L1
#   Oracle:           Enable
#   Genesis balance:  1000000000000000000000000

# 3. Start OPinit executor and IBC relayer bots
weave opinit-bots start
weave relayer start
```

### Environment Setup

Copy `.env.example` to `.env` and fill in:

```
PRIVATE_KEY=<your_deployer_private_key>
INITIA_RPC_URL=<rpc_url_from_weave_init>
INITIA_CHAIN_ID=<chain_id_assigned_by_weave_init>
```

Fund your deployer wallet from the Gas Station or testnet faucet:
https://app.testnet.initia.xyz/faucet

### Deploy Contracts

```bash
npx hardhat run scripts/deployInitia.js --network initiaTestnet
```

For local node:
```bash
npx hardhat run scripts/deployInitia.js --network initiaLocal
```

Deployment addresses are saved to `deployments/initia-testnet.json` and `frontend/deployments.json`.

### Wallet / Frontend

The frontend uses InterwovenKit for wallet connection (`frontend/interwovenkit.js`).
- Supports Initia-native wallets (Keplr/Leap) and MetaMask
- Auto-adds the govbond-1 network to MetaMask on connect
- InterwovenKit docs: https://docs.initia.xyz/interwovenkit/introduction

Open `frontend/index.html` in a browser (serve via any static file server).

### Interwoven Bridge

Bridge IDRP from Initia L1 to the govbond-1 appchain:
https://app.testnet.initia.xyz/bridge — select **govbond-1** as destination.

### Hackathon Submission Checklist

- [ ] Contracts deployed — fill addresses in `.initia/submission.json`
- [ ] `demo_video` URL added to `.initia/submission.json`
- [ ] `txn_or_deployment_link` added to `.initia/submission.json`
- [ ] Submit `.initia/submission.json` on DoraHacks

---

## Arbitrum Sepolia vs Initia EVM — Why We Migrated

| | Arbitrum Sepolia | Initia EVM (govbond-1) |
|---|---|---|
| **VM** | EVM (Arbitrum Nitro) | EVM (Initia appchain) |
| **L1** | Ethereum Sepolia | Initia (initiation-2) |
| **Chain ID** | 421614 | govbond-1 (custom) |
| **Gas token** | ETH | MIN (umin) |
| **Settlement token** | IDRP (Indonesian Rupiah, 2 decimals) | IDRP (Indonesian Rupiah, 2 decimals) |
| **KYC / compliance** | On-chain (ERC-3643) | On-chain (ERC-3643) — unchanged |
| **Vault mechanics** | ERC-7540 async | ERC-7540 async — unchanged |
| **Wallet support** | MetaMask only | MetaMask + Keplr/Leap (InterwovenKit) |
| **Cross-chain bridge** | Arbitrum bridge (ETH-centric) | Interwoven Bridge (native IBC, govbond-1 ↔ Initia L1) |
| **Block explorer** | Arbiscan | Initia Explorer (explorer.testnet.initia.xyz) |
| **Faucet** | Arbitrum Sepolia ETH faucet | https://app.testnet.initia.xyz/faucet |
| **Appchain sovereignty** | Shared sequencer (Arbitrum) | Dedicated appchain — full control over gas, governance, and validator set |
| **Hackathon track** | — | DoraHacks INITIATE — DeFi/Institutional |

### Key Reasons for Migration

- **Appchain sovereignty** — govbond-1 is a dedicated EVM rollup on Initia, giving the issuer full control over transaction ordering, gas pricing, and upgrade governance. On Arbitrum Sepolia, GovBond shared infrastructure with all other Arbitrum contracts.
- **Native IDRP settlement** — Initia's Interwoven Bridge enables IDRP to move natively between Initia L1 and the govbond-1 appchain via IBC, without wrapping or third-party bridges.
- **Interoperable wallets** — InterwovenKit unifies Cosmos-native wallets (Keplr, Leap) and EVM wallets (MetaMask) under a single connection flow, matching the dual-audience nature of Indonesian institutional DeFi.
- **Zero contract changes** — All six Solidity contracts are deployed byte-for-byte identical. Only the Hardhat network config and frontend wallet layer changed, proving EVM portability.
