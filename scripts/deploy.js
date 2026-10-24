const { ethers, artifacts } = require('hardhat');
const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const contract = await (await ethers.getContractFactory('Voting')).deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const { chainId } = await ethers.provider.getNetwork();
  const config = { address, chainId: Number(chainId), rpcUrl: 'http://127.0.0.1:8545', abi: (await artifacts.readArtifact('Voting')).abi };
  fs.mkdirSync(path.join(__dirname, '../deployments'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, `../deployments/${chainId}.json`), JSON.stringify(config, null, 2));
  fs.writeFileSync(path.join(__dirname, '../frontend/src/contracts/deployment.json'), JSON.stringify(config, null, 2));
  console.log(`Voting deployed to ${address} on chain ${chainId}. Frontend configuration updated.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
