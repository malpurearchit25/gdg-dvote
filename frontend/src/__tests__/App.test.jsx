import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../services/blockchain', () => ({
  chainId: 31337, contractAddress: '0x123', rpcUrl: 'http://127.0.0.1:8545',
  connectWallet: vi.fn(), readProposals: vi.fn(), submit: vi.fn(), switchNetwork: vi.fn(),
  watchChanges: vi.fn(() => () => {}), friendlyError: vi.fn(error => error.message || 'Wallet request declined.'),
}));
import * as blockchain from '../services/blockchain';
import App from '../App';

const accountA = '0x0000000000000000000000000000000000000001';
const accountB = '0x0000000000000000000000000000000000000002';
let handlers;
function proposal(overrides = {}) {
  return { id: 0, title: 'A real proposal', description: 'A community decision.', creator: accountA, deadline: Math.floor(Date.now() / 1000) + 3600, yesVotes: 0, noVotes: 0, voted: false, ...overrides };
}
function chainResult(proposals = [proposal()]) { return { proposals, blockNumber: 1, blockTime: Math.floor(Date.now() / 1000) }; }
async function openChain() {
  fireEvent.click(screen.getByRole('button', { name: 'Use blockchain', exact: true }));
  await screen.findByRole('button', { name: 'A real proposal', exact: true });
}
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks();
  handlers = {};
  window.ethereum = { on: vi.fn((name, callback) => { handlers[name] = callback; }), removeListener: vi.fn() };
  blockchain.readProposals.mockResolvedValue(chainResult());
  blockchain.connectWallet.mockResolvedValue({ account: accountA, network: 31337 });
  blockchain.switchNetwork.mockResolvedValue(null);
});
afterEach(() => { cleanup(); delete window.ethereum; });

describe('dVote user flows', () => {
  it('creates a demo proposal, saves one vote and prevents a second', async () => {
    render(<App/>);
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Create a proposal', exact: true }));
    fireEvent.change(screen.getByPlaceholderText('What should we decide together?'), { target: { value: 'Student idea' } });
    fireEvent.change(screen.getByPlaceholderText('Share the context, the idea, and what a Yes vote means.'), { target: { value: 'Build an open resource library.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create proposal', exact: true }));
    fireEvent.click(await screen.findByRole('button', { name: 'Student idea', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, I support this', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit your vote', exact: true }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const stored = JSON.parse(localStorage.getItem('dvote-demo-v1')).find(p => p.title === 'Student idea');
    expect(stored.yesVotes).toBe(1); expect(stored.noVotes).toBe(0); expect(stored.voted).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Student idea', exact: true }));
    expect(screen.getByText('Your wallet has already voted. Thanks for participating.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Submit your vote' })).toBeNull();
    expect(blockchain.submit).not.toHaveBeenCalled();
  });
  it('searches, filters closed proposals, and displays final results', () => {
    render(<App/>);
    fireEvent.change(screen.getByLabelText('Search proposals'), { target: { value: 'open source' } });
    expect(screen.getAllByRole('article').length).toBe(5); // Four statistics and one proposal.
    fireEvent.click(screen.getByRole('button', { name: 'Make our resources open source', exact: true }));
    expect(within(screen.getByRole('dialog')).getByText('Voting closed. Yes received the most votes.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Submit your vote' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    fireEvent.change(screen.getByLabelText('Search proposals'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Closed', exact: true }));
    expect(screen.getAllByRole('button', { name: 'View results', exact: true }).length).toBe(2);
    expect(screen.queryByRole('button', { name: 'Cast your vote', exact: true })).toBeNull();
  });
  it('shows wallet connection failures inside the active dialog', async () => {
    blockchain.connectWallet.mockRejectedValue(new Error('Wallet connection was declined.'));
    render(<App/>); await openChain();
    fireEvent.click(screen.getByRole('button', { name: 'A real proposal', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet to vote', exact: true }));
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveProperty('textContent', 'Wallet connection was declined.');
  });
  it('reflects account changes, disconnects and network changes', async () => {
    render(<App/>); await openChain();
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet', exact: true }));
    await waitFor(() => expect(blockchain.readProposals).toHaveBeenCalledWith(accountA));
    await act(async () => handlers.accountsChanged([accountB]));
    await waitFor(() => expect(blockchain.readProposals).toHaveBeenCalledWith(accountB));
    await act(async () => handlers.chainChanged('0x1'));
    expect(screen.getByText('Your wallet is on chain 1. Switch to Hardhat Local to vote.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Switch network', exact: true }));
    expect(blockchain.switchNetwork).toHaveBeenCalledTimes(1);
    await act(async () => handlers.accountsChanged([]));
    expect(screen.getByRole('button', { name: 'Connect wallet', exact: true })).toBeTruthy();
  });
  it('retains the vote form after a rejected transaction', async () => {
    blockchain.submit.mockRejectedValue(new Error('Vote rejected in wallet.'));
    render(<App/>); await openChain();
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet', exact: true }));
    await waitFor(() => expect(blockchain.readProposals).toHaveBeenCalledWith(accountA));
    fireEvent.click(await screen.findByRole('button', { name: 'A real proposal', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'No, I don’t support this', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit your vote', exact: true }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Vote rejected in wallet.');
    expect(screen.getByRole('button', { name: 'Submit your vote', exact: true }).disabled).toBe(false);
  });
  it('reports submitted transaction status then refreshes confirmed results', async () => {
    let confirm;
    blockchain.submit.mockImplementation(async (action, args, account, onSubmitted) => {
      onSubmitted('0xabc'); await new Promise(resolve => { confirm = resolve; }); return '0xabc';
    });
    render(<App/>); await openChain();
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet', exact: true }));
    await waitFor(() => expect(blockchain.readProposals).toHaveBeenCalledWith(accountA));
    fireEvent.click(await screen.findByRole('button', { name: 'A real proposal', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, I support this', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit your vote', exact: true }));
    expect(await screen.findByText('Transaction submitted. Waiting for confirmation…')).toBeTruthy();
    expect(screen.getByText('0xabc')).toBeTruthy();
    blockchain.readProposals.mockResolvedValue(chainResult([proposal({ yesVotes: 1, voted: true })]));
    await act(async () => confirm());
    await screen.findByText('Transaction confirmed on the local blockchain.');
    expect(screen.getByRole('button', { name: 'View vote', exact: true })).toBeTruthy();
    expect(blockchain.submit.mock.calls[0].slice(0, 3)).toEqual(['vote', [0, true], accountA]);
  });
  it('cleans up wallet event subscriptions when unmounted', () => {
    const view = render(<App/>); view.unmount();
    expect(window.ethereum.removeListener).toHaveBeenCalledWith('accountsChanged', handlers.accountsChanged);
    expect(window.ethereum.removeListener).toHaveBeenCalledWith('chainChanged', handlers.chainChanged);
  });
  it('refreshes confirmed votes even while an older background read is pending', async () => {
    blockchain.submit.mockResolvedValue('0xconfirmed');
    render(<App/>); await openChain();
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet', exact: true }));
    await waitFor(() => expect(blockchain.readProposals).toHaveBeenCalledWith(accountA));
    fireEvent.click(await screen.findByRole('button', { name: 'A real proposal', exact: true }));
    let finishOldRead;
    blockchain.readProposals.mockImplementationOnce(() => new Promise(resolve => { finishOldRead = resolve; }));
    const onEvent = blockchain.watchChanges.mock.calls.at(-1)[0];
    await act(async () => { onEvent(); });
    blockchain.readProposals.mockResolvedValue(chainResult([proposal({ yesVotes: 1, voted: true })]));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, I support this', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit your vote', exact: true }));
    await screen.findByRole('button', { name: 'View vote', exact: true });
    await act(async () => finishOldRead(chainResult([proposal()])));
    expect(screen.getByRole('button', { name: 'View vote', exact: true })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cast your vote', exact: true })).toBeNull();
  });
});
