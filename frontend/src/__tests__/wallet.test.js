import { afterEach, describe, expect, it, vi } from 'vitest';
import { Interface } from 'ethers';
vi.mock('../contracts/deployment.json', () => ({ default: { chainId: 31337, address: '', rpcUrl: 'http://127.0.0.1:8545', abi: ['error AlreadyVoted(uint256 proposalId, address voter)', 'error VotingClosed(uint256 proposalId)'] } }));
import { connectWallet, switchNetwork, friendlyError } from '../services/blockchain';

afterEach(() => { delete window.ethereum; });
describe('browser wallet boundary', () => {
  it('explains when no browser wallet is installed', async () => {
    await expect(connectWallet()).rejects.toThrow('No browser wallet found');
  });
  it('requests accounts and reports the selected chain', async () => {
    const request = vi.fn().mockResolvedValueOnce(['0x123']).mockResolvedValueOnce('0x7a69');
    window.ethereum = { request };
    expect(await connectWallet()).toEqual({ account: '0x123', network: 31337 });
    expect(request.mock.calls.map(([arg]) => arg.method)).toEqual(['eth_requestAccounts', 'eth_chainId']);
  });
  it('rejects an empty account list', async () => {
    window.ethereum = { request: vi.fn().mockResolvedValue([]) };
    await expect(connectWallet()).rejects.toThrow('No wallet account');
  });
  it('preserves wallet rejection for readable UI feedback', async () => {
    const rejection = { code: 4001, message: 'User rejected' };
    window.ethereum = { request: vi.fn().mockRejectedValue(rejection) };
    await expect(connectWallet()).rejects.toBe(rejection);
    expect(friendlyError(rejection)).toContain('Request declined');
    expect(friendlyError({ code: 'ACTION_REJECTED' })).toContain('Nothing was submitted');
  });
  it('switches to the configured chain', async () => {
    window.ethereum = { request: vi.fn().mockResolvedValue(null) };
    await switchNetwork();
    expect(window.ethereum.request).toHaveBeenCalledWith({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x7a69' }] });
  });
  it('adds the local network when the wallet reports it as unknown', async () => {
    window.ethereum = { request: vi.fn().mockRejectedValueOnce({ code: 4902 }).mockResolvedValueOnce(null) };
    await switchNetwork();
    expect(window.ethereum.request.mock.calls[1][0]).toEqual({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x7a69', chainName: 'Hardhat Local', rpcUrls: ['http://127.0.0.1:8545'], nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 } }] });
  });
  it('does not add a network when the user rejects switching', async () => {
    window.ethereum = { request: vi.fn().mockRejectedValue({ code: 4001 }) };
    await expect(switchNetwork()).rejects.toEqual({ code: 4001 });
    expect(window.ethereum.request).toHaveBeenCalledTimes(1);
  });
  it('decodes direct and nested contract reverts', () => {
    const abi = new Interface(['error AlreadyVoted(uint256,address)', 'error VotingClosed(uint256)']);
    const duplicate = abi.encodeErrorResult('AlreadyVoted', [0, '0x0000000000000000000000000000000000000001']);
    expect(friendlyError({ data: duplicate })).toContain('already voted');
    const closed = abi.encodeErrorResult('VotingClosed', [0]);
    expect(friendlyError({ info: { error: { data: { data: closed } } } })).toContain('deadline has passed');
  });
  it('explains unavailable RPC and insufficient test ETH', () => {
    expect(friendlyError({ code: 'NETWORK_ERROR' })).toContain('Cannot reach');
    expect(friendlyError({ code: 'INSUFFICIENT_FUNDS' })).toContain('test ETH');
  });
});
