import { BrowserProvider, Contract, Interface, JsonRpcProvider } from 'ethers';
import deployment from '../contracts/deployment.json';

export const chainId = deployment.chainId;
export const contractAddress = deployment.address;
export const rpcUrl = import.meta.env.VITE_RPC_URL || deployment.rpcUrl;
let reader;
const provider = () => reader ||= new JsonRpcProvider(rpcUrl, undefined, { pollingInterval: 4000 });
function contract(runner) {
  if (!contractAddress) throw new Error('Contract not deployed yet. Start the local node, then run the deployment command in the README.');
  return new Contract(contractAddress, deployment.abi, runner);
}
export async function readProposals(account) {
  const rpc = provider();
  const network = await rpc.getNetwork();
  if (Number(network.chainId) !== chainId) throw new Error(`RPC must be on chain ${chainId}.`);
  const instance = contract(rpc);
  if (await rpc.getCode(contractAddress) === '0x') throw new Error('No contract found. The local node may have restarted. Deploy again and reload this page.');
  const count = Number(await instance.proposalCount());
  const rows = [];
  for (let offset = 0; offset < count; offset += 100) rows.push(...await instance.getProposals(offset, 100));
  const latest = await rpc.getBlock('latest');
  const proposals = await Promise.all(rows.map(async p => ({
    id: Number(p.id), title: p.title, description: p.description, creator: p.creator,
    deadline: Number(p.deadline), yesVotes: Number(p.yesVotes), noVotes: Number(p.noVotes),
    voted: account ? await instance.hasVoted(p.id, account) : false,
  })));
  return { proposals, blockTime: latest.timestamp, blockNumber: latest.number };
}
export async function connectWallet() {
  if (!window.ethereum) throw new Error('No browser wallet found. Install an Ethereum-compatible wallet, then reload this page.');
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  if (!accounts.length) throw new Error('No wallet account is available.');
  return { account: accounts[0], network: Number(await window.ethereum.request({ method: 'eth_chainId' })) };
}
export async function switchNetwork() {
  if (!window.ethereum) throw new Error('Install a browser wallet first.');
  const hexId = `0x${chainId.toString(16)}`;
  try { await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexId }] }); }
  catch (error) {
    if (error.code !== 4902) throw error;
    await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: hexId, chainName: 'Hardhat Local', rpcUrls: [rpcUrl], nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 } }] });
  }
}
export async function submit(action, args, expectedAccount, onSubmitted) {
  const wallet = new BrowserProvider(window.ethereum);
  try {
    if (Number((await wallet.getNetwork()).chainId) !== chainId) throw new Error(`Switch your wallet to Hardhat Local (chain ${chainId}).`);
    const signer = await wallet.getSigner();
    if ((await signer.getAddress()).toLowerCase() !== expectedAccount.toLowerCase()) throw new Error('Your wallet account changed. Please try again.');
    const tx = await contract(signer)[action](...args);
    onSubmitted(tx.hash);
    const receipt = await tx.wait();
    if (receipt.status !== 1) throw new Error('The transaction failed.');
    return receipt.hash;
  } finally { wallet.destroy(); }
}
export function watchChanges(onChange) {
  if (!contractAddress) return () => {};
  const instance = contract(provider());
  instance.on('ProposalCreated', onChange).catch(() => {});
  instance.on('VoteCast', onChange).catch(() => {});
  return () => { instance.removeAllListeners().catch(() => {}); };
}
export function friendlyError(error) {
  if (error.code === 4001 || error.code === 'ACTION_REJECTED') return 'Request declined in your wallet. Nothing was submitted.';
  const rawData = error.data || error.info?.error?.data;
  const data = typeof rawData === 'object' ? rawData?.data : rawData;
  if (typeof data === 'string' && deployment.abi.length) {
    try {
      const name = new Interface(deployment.abi).parseError(data)?.name;
      const messages = { AlreadyVoted: 'This wallet has already voted on this proposal.', VotingClosed: 'The voting deadline has passed.', ProposalNotFound: 'This proposal does not exist.', InvalidTitle: 'Enter a title of 1–120 UTF-8 bytes.', InvalidDescription: 'Enter a description of 1–2,000 UTF-8 bytes.', InvalidDuration: 'Choose a duration between 1 minute and 30 days.' };
      if (messages[name]) return messages[name];
    } catch { /* Use the readable fallback below. */ }
  }
  if (error.code === 'INSUFFICIENT_FUNDS') return 'Your wallet needs local test ETH for transaction fees.';
  if (error.code === 'NETWORK_ERROR' || error.code === 'SERVER_ERROR' || /fetch|ECONNREFUSED|connect ECONN/i.test(error.message)) return 'Cannot reach the local blockchain. Start the node on port 8545 and try Refresh.';
  return error.shortMessage || error.message || 'Something went wrong. Please try again.';
}
