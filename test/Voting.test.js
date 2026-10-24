const assert = require('node:assert/strict');
const { ethers, network } = require('hardhat');

describe('Voting', function () {
  let voting, owner, alice, bob;
  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();
    voting = await (await ethers.getContractFactory('Voting')).deploy();
    await voting.waitForDeployment();
  });
  const create = (voting, title = 'Build a learning circle', description = 'Weekly peer-led study sessions.', duration = 3600) => voting.createProposal(title, description, duration);
  async function expectError(promise, name) {
    await assert.rejects(promise, error => error.message.includes(name));
  }
  function events(receipt, name) { return receipt.logs.map(log => { try { return voting.interface.parseLog(log); } catch { return null; } }).filter(log => log?.name === name); }

  it('starts empty', async function () {
    assert.equal(await voting.proposalCount(), 0n);
    assert.equal((await voting.getAllProposals()).length, 0);
  });
  it('creates proposals with sequential IDs, creator, deadline and zero tallies', async function () {
    const receipt = await (await create(voting)).wait();
    const block = await ethers.provider.getBlock(receipt.blockNumber);
    const p = await voting.getProposal(0);
    assert.equal(p.id, 0n); assert.equal(p.title, 'Build a learning circle');
    assert.equal(p.description, 'Weekly peer-led study sessions.');
    assert.equal(p.creator, owner.address); assert.equal(p.deadline, BigInt(block.timestamp + 3600));
    assert.equal(p.yesVotes, 0n); assert.equal(p.noVotes, 0n);
    await create(voting); assert.equal((await voting.getProposal(1)).id, 1n);
    assert.equal(await voting.proposalCount(), 2n);
  });
  it('allows anyone to create proposals', async function () {
    await create(voting.connect(alice));
    assert.equal((await voting.getProposal(0)).creator, alice.address);
  });
  it('emits ProposalCreated with the correct fields', async function () {
    const receipt = await (await create(voting)).wait();
    const [event] = events(receipt, 'ProposalCreated');
    assert.equal(event.args.proposalId, 0n); assert.equal(event.args.creator, owner.address);
    assert.equal(event.args.title, 'Build a learning circle');
    assert.equal(event.args.deadline, (await voting.getProposal(0)).deadline);
  });
  it('rejects empty, whitespace-only and oversized titles', async function () {
    for (const title of ['', ' \t\n', 'a'.repeat(121), '🙂'.repeat(31)]) await expectError(create(voting, title), 'InvalidTitle');
  });
  it('enforces description bounds', async function () {
    for (const description of ['', '   ', 'a'.repeat(2001)]) await expectError(create(voting, 'Title', description), 'InvalidDescription');
    await create(voting, 'a'.repeat(120), 'b'.repeat(2000));
  });
  it('rejects durations outside 60 seconds to 30 days', async function () {
    for (const duration of [0, 59, 2592001]) await expectError(create(voting, 'Title', 'Description', duration), 'InvalidDuration');
    await create(voting, 'Minimum', 'Description', 60);
    await create(voting, 'Maximum', 'Description', 2592000);
  });
  it('counts Yes and No from distinct wallets and records voting status', async function () {
    await create(voting);
    await voting.connect(alice).vote(0, true);
    await voting.connect(bob).vote(0, false);
    const p = await voting.getProposal(0);
    assert.equal(p.yesVotes, 1n); assert.equal(p.noVotes, 1n);
    assert.equal(await voting.hasVoted(0, alice.address), true);
    assert.equal(await voting.hasVoted(0, bob.address), true);
    assert.equal(await voting.hasVoted(0, owner.address), false);
  });
  it('emits VoteCast with voter, proposal ID and choice', async function () {
    await create(voting);
    const receipt = await (await voting.connect(alice).vote(0, false)).wait();
    const [event] = events(receipt, 'VoteCast');
    assert.equal(event.args.voter, alice.address); assert.equal(event.args.proposalId, 0n); assert.equal(event.args.support, false);
  });
  it('rejects duplicate voting, including a changed choice, without altering totals', async function () {
    await create(voting); await voting.connect(alice).vote(0, true);
    await expectError(voting.connect(alice).vote(0, true), 'AlreadyVoted');
    await expectError(voting.connect(alice).vote(0, false), 'AlreadyVoted');
    const p = await voting.getProposal(0);
    assert.equal(p.yesVotes, 1n); assert.equal(p.noVotes, 0n);
  });
  it('tracks voting independently for each proposal', async function () {
    await create(voting); await create(voting);
    await voting.connect(alice).vote(0, true); await voting.connect(alice).vote(1, false);
    assert.equal((await voting.getProposal(1)).noVotes, 1n);
  });
  it('allows voting one second before the deadline', async function () {
    await create(voting);
    const p = await voting.getProposal(0);
    await network.provider.send('evm_setNextBlockTimestamp', [Number(p.deadline) - 1]);
    await voting.connect(alice).vote(0, true);
    assert.equal((await voting.getProposal(0)).yesVotes, 1n);
  });
  it('rejects voting exactly at the deadline and later', async function () {
    await create(voting); const p = await voting.getProposal(0);
    await network.provider.send('evm_setNextBlockTimestamp', [Number(p.deadline)]);
    await expectError(voting.connect(alice).vote(0, true), 'VotingClosed');
    await network.provider.send('evm_setNextBlockTimestamp', [Number(p.deadline) + 10]);
    await expectError(voting.connect(bob).vote(0, false), 'VotingClosed');
    assert.equal(await voting.hasVoted(0, alice.address), false);
    assert.equal((await voting.getProposal(0)).yesVotes, 0n);
  });
  it('rejects nonexistent proposal reads and votes', async function () {
    await expectError(voting.vote(0, true), 'ProposalNotFound');
    await expectError(voting.getProposal(0), 'ProposalNotFound');
    await create(voting);
    await expectError(voting.vote(1, true), 'ProposalNotFound');
  });
  it('retrieves complete and paginated results in ID order', async function () {
    await create(voting, 'First'); await create(voting, 'Second'); await create(voting, 'Third');
    await voting.connect(alice).vote(1, false);
    const all = await voting.getAllProposals();
    assert.equal(all.length, 3); assert.equal(all[1].noVotes, 1n);
    const page = await voting.getProposals(1, 1);
    assert.equal(page.length, 1); assert.equal(page[0].title, 'Second');
    assert.equal((await voting.getProposals(2, 100)).length, 1);
    assert.equal((await voting.getProposals(3, 10)).length, 0);
    assert.equal((await voting.getProposals(ethers.MaxUint256, 10)).length, 0);
    await expectError(voting.getProposals(0, 0), 'InvalidPageSize');
    await expectError(voting.getProposals(0, 101), 'InvalidPageSize');
  });
});
