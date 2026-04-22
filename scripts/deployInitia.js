require("dotenv").config();
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // 1. IDRPToken
  const idrp = await (await ethers.getContractFactory("IDRPToken")).deploy();
  await idrp.waitForDeployment();
  console.log("IDRPToken:", await idrp.getAddress());

  // 2. IdentityRegistry
  const registry = await (await ethers.getContractFactory("IdentityRegistry")).deploy();
  await registry.waitForDeployment();
  console.log("IdentityRegistry:", await registry.getAddress());

  // 3. ComplianceModule
  const compliance = await (await ethers.getContractFactory("ComplianceModule")).deploy(await registry.getAddress());
  await compliance.waitForDeployment();
  console.log("ComplianceModule:", await compliance.getAddress());

  // 4. GovBondToken — Palembang Municipal Bond 2025
  const maturity = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
  const faceValueIDRP = 100_000_000n;
  const bond = await (await ethers.getContractFactory("GovBondToken")).deploy(
    "Palembang Municipal Bond 2025", "PMB25",
    await registry.getAddress(), await compliance.getAddress(),
    maturity, 750, 100_000n, faceValueIDRP
  );
  await bond.waitForDeployment();
  console.log("GovBondToken:", await bond.getAddress());

  await compliance.setBondToken(await bond.getAddress());

  // 5. GovBondVault
  const vault = await (await ethers.getContractFactory("GovBondVault")).deploy(
    await bond.getAddress(), await idrp.getAddress(), faceValueIDRP
  );
  await vault.waitForDeployment();
  console.log("GovBondVault:", await vault.getAddress());

  // 6. BondFactory
  const factory = await (await ethers.getContractFactory("BondFactory")).deploy();
  await factory.waitForDeployment();
  console.log("BondFactory:", await factory.getAddress());

  // 7. Grant roles
  const AGENT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AGENT_ROLE"));
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const ISSUER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ISSUER_ROLE"));
  await bond.grantRole(AGENT_ROLE, await vault.getAddress());
  await idrp.grantRole(MINTER_ROLE, await vault.getAddress());
  await factory.grantRole(ISSUER_ROLE, deployer.address);
  console.log("Roles granted");

  // 8. Register deployer + vault in IdentityRegistry
  await registry.registerInvestor(deployer.address, "ID");
  await registry.registerInvestor(await vault.getAddress(), "ID");
  console.log("Deployer and vault registered in IdentityRegistry");

  // 9. Mint 10,000,000,000 IDRP to deployer
  await idrp.mint(deployer.address, 10_000_000_000n);
  console.log("Minted 10,000,000,000 IDRP to deployer");

  // 10. Save deployments
  const chainId = parseInt(process.env.INITIA_CHAIN_ID || "1234");
  const deployments = {
    network: "initiaTestnet",
    chainId,
    deployer: deployer.address,
    IDRPToken: await idrp.getAddress(),
    IdentityRegistry: await registry.getAddress(),
    ComplianceModule: await compliance.getAddress(),
    GovBondToken: await bond.getAddress(),
    GovBondVault: await vault.getAddress(),
    BondFactory: await factory.getAddress(),
    maturityDate: maturity,
    deployedAt: new Date().toISOString(),
  };

  const json = JSON.stringify(deployments, null, 2);
  const dir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, "initia-testnet.json"), json);
  fs.writeFileSync(path.join(__dirname, "../frontend/deployments.json"), json);
  console.log("Saved deployments to deployments/initia-testnet.json and frontend/deployments.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
