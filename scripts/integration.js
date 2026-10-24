// Uses an already-running local node and the frontend's generated deployment configuration.
const assert = require('node:assert/strict');
const { JsonRpcProvider, Contract } = require('ethers');
const config = require('../frontend/src/contracts/deployment.json');
async function main() {
  const provider = new JsonRpcProvider(config.rpcUrl);
  try {
    assert.ok(config.address, 'Run deploy first');
    const creator = await provider.getSigner(2), voter = await provider.getSigner(3);
    const voting = new Contract(config.address, config.abi, creator);
    const id = await voting.proposalCount();
    const receipt = await (await voting.createProposal('Integration check', 'Created through ethers on the live local RPC.', 3600)).wait();
    assert.equal(receipt.status, 1);
    await (await voting.connect(voter).vote(id, false)).wait();
    const proposal = await voting.getProposal(id);
    assert.equal(proposal.noVotes, 1n); assert.equal(proposal.yesVotes, 0n);
    assert.equal(await voting.hasVoted(id, await voter.getAddress()), true);
    await assert.rejects(voting.connect(voter).vote.staticCall(id, true));
    console.log(`PASS: deployed contract ${config.address}; created proposal ${id}, recorded No vote, rejected duplicate vote.`);
  } finally { provider.destroy(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
