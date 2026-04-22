require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun", viaIR: true },
  },
  networks: {
    // Initia EVM appchain (testnet) — fill INITIA_RPC_URL and INITIA_CHAIN_ID after `weave init`
    initiaTestnet: {
      url: process.env.INITIA_RPC_URL || "http://localhost:8545",
      chainId: parseInt(process.env.INITIA_CHAIN_ID || "1234"),
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    // Initia local node
    initiaLocal: {
      url: "http://localhost:8545",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    // Kept as fallback reference
    arbitrumSepolia: {
      url: "https://sepolia-rollup.arbitrum.io/rpc",
      chainId: 421614,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  // TODO: Add Initia block explorer config here when available
  // etherscan: { apiKey: { initiaTestnet: process.env.INITIA_EXPLORER_API_KEY || "" } }
};
