/**
 * interwovenkit.js — Wallet integration for GovBond on Initia EVM
 * Supports MetaMask/injected EVM wallets with Initia-native wallet fallback.
 * InterwovenKit React SDK docs: https://docs.initia.xyz/interwovenkit/introduction
 */

let _provider = null;
let _signer = null;

/**
 * Load network config from deployments.json (single source of truth).
 */
async function _getNetworkConfig() {
  const res = await fetch("./deployments.json");
  return res.json();
}

/**
 * Add govbond-1 network to MetaMask if not already present.
 */
async function addNetwork() {
  const config = await _getNetworkConfig();
  const chainIdHex = "0x" + config.chainId.toString(16);
  const rpcUrl = window.__INITIA_RPC_URL__ || "http://localhost:8545";

  await window.ethereum.request({
    method: "wallet_addEthereumChain",
    params: [{
      chainId: chainIdHex,
      chainName: "GovBond Initia (govbond-1)",
      nativeCurrency: { name: "MIN", symbol: "MIN", decimals: 18 },
      rpcUrls: [rpcUrl],
      blockExplorerUrls: [],
    }],
  });
}

/**
 * Connect wallet. Tries InterwovenKit (window.interwovenkit) first,
 * then falls back to injected window.ethereum (MetaMask).
 * Auto-adds govbond-1 network if chainId mismatch detected.
 */
async function connectWallet() {
  // Try Initia-native wallet (Keplr/Leap via InterwovenKit injection)
  if (window.interwovenkit) {
    await window.interwovenkit.connect();
    _provider = window.interwovenkit.getProvider();
    _signer = await _provider.getSigner();
    return _signer;
  }

  // Fallback: injected EVM wallet (MetaMask)
  if (!window.ethereum) throw new Error("No wallet detected. Install MetaMask or an Initia-compatible wallet.");

  await window.ethereum.request({ method: "eth_requestAccounts" });
  _provider = new ethers.BrowserProvider(window.ethereum);
  _signer = await _provider.getSigner();

  // Auto-add network if chainId doesn't match
  const config = await _getNetworkConfig();
  const network = await _provider.getNetwork();
  if (Number(network.chainId) !== config.chainId) {
    try { await addNetwork(); } catch (e) { console.warn("Could not add network:", e.message); }
  }

  return _signer;
}

/**
 * Get the connected wallet address.
 */
async function getAddress() {
  if (!_signer) await connectWallet();
  return _signer.getAddress();
}

/**
 * Get the ethers.js signer.
 */
async function getSigner() {
  if (!_signer) await connectWallet();
  return _signer;
}

/**
 * Get the ethers.js provider.
 */
function getProvider() {
  return _provider;
}

// Export for use in HTML via script tag
window.InterwovenKit = { connectWallet, getAddress, getSigner, getProvider, addNetwork };
