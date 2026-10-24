const { ethers } = require('hardhat');
const config = require('../frontend/src/contracts/deployment.json');
async function main() {
  if (!config.address) throw new Error('Run the deployment first.');
  const [creator, voter] = await ethers.getSigners();
  const voting = new ethers.Contract(config.address, config.abi, creator);
  const start = await voting.proposalCount();
  const items = [
    ['Fund the next community hackathon', 'Allocate community resources for a weekend of building, mentorship, and open-source collaboration. The event will welcome developers of all experience levels.', 7 * 86400],
    ['Launch a Web3 learning circle', 'Start a weekly student-led study group covering Solidity, smart contract security, and decentralized application development.', 3 * 86400],
    ['Introduce monthly project showcases', 'Give members a regular space to share what they are building, get feedback, and find collaborators across the community.', 5 * 86400],
  ];
  for (let i = 0; i < items.length; i++) {
    await (await voting.createProposal(...items[i])).wait();
    await (await voting.vote(start + BigInt(i), true)).wait();
    await (await voting.connect(voter).vote(start + BigInt(i), i !== 1)).wait();
  }
  console.log('Created three real on-chain proposals and six votes.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
