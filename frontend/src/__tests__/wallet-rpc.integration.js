// @vitest-environment node
// Exercises the actual frontend ethers transport using a local EIP-1193 test wallet.
// This does not claim to automate a real browser extension's approval screen.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { ContractFactory, JsonRpcProvider } from 'ethers';

let provider, contract, service, addressA, addressB, activeAccount;
beforeAll(async () => {
  provider = new JsonRpcProvider('http://127.0.0.1:8545');
  const artifact = JSON.parse(readFileSync('artifacts/contracts/Voting.sol/Voting.json', 'utf8'));
  const signer = await provider.getSigner(6);
  addressA = await signer.getAddress();
  addressB = await (await provider.getSigner(7)).getAddress();
  activeAccount = addressA;
  contract = await new ContractFactory(artifact.abi, artifact.bytecode, signer).deploy();
  await contract.waitForDeployment();
  vi.doMock('../contracts/deployment.json', () => ({ default: { address: contract.target, abi: artifact.abi, chainId: 31337, rpcUrl: 'http://127.0.0.1:8545' } }));
  globalThis.window = { ethereum: { request: async ({ method, params = [] }) => {
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [activeAccount];
    return provider.send(method, params);
  } } };
  service = await import('../services/blockchain');
}, 15000);
afterAll(() => { provider?.destroy(); delete globalThis.window; });
describe('frontend transport against local RPC', () => {
  it('connects an EIP-1193 wallet and reads its chain', async () => {
    expect(await service.connectWallet()).toEqual({ account: addressA, network: 31337 });
  });
  it('submits proposal creation and returns a confirmed hash', async () => {
    const submitted = vi.fn();
    const hash = await service.submit('createProposal', ['Wallet transport check', 'Created with the frontend transaction service.', 3600], addressA, submitted);
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(submitted).toHaveBeenCalledWith(hash);
    expect((await contract.getProposal(0)).creator).toBe(addressA);
  });
  it('records a vote and decodes a rejected duplicate', async () => {
    await service.submit('vote', [0, true], addressA, () => {});
    expect((await contract.getProposal(0)).yesVotes).toBe(1n);
    let failure;
    try { await service.submit('vote', [0, false], addressA, () => {}); } catch (error) { failure = error; }
    expect(failure).toBeTruthy(); expect(service.friendlyError(failure)).toContain('already voted');
  });
  it('rejects a stale account and then accepts another wallet’s No vote', async () => {
    activeAccount = addressB;
    await expect(service.submit('vote', [0, false], addressA, () => {})).rejects.toThrow('account changed');
    await service.submit('vote', [0, false], addressB, () => {});
    const p = await contract.getProposal(0);
    expect(p.yesVotes).toBe(1n); expect(p.noVotes).toBe(1n);
  });
});
