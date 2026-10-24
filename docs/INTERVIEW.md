# dVote interview guide

## A 30-second introduction

“dVote is a decentralized proposal voting application. Users connect an Ethereum wallet, create a proposal with a deadline, and vote Yes or No. A Solidity contract stores proposals and vote counts, rejects duplicate votes from the same wallet, and closes voting using blockchain timestamps. React and ethers.js provide the interface. The working prototype runs on a local Hardhat chain.”

## A five-minute demonstration

Before presenting, start the local node, deploy, seed, and start the frontend using the README. Keep the node open. Configure a wallet for chain 31337 with funded local development accounts. Use account 2 or later because the seed script has already voted with accounts 0 and 1.

1. **Dashboard — 30 seconds.** Explain the difference between explicitly labeled demo data and blockchain mode. Switch to blockchain mode. Point out the live contract address, proposals and current tallies.
2. **Wallet — 30 seconds.** Connect a development wallet on Hardhat Local. Explain that the private key stays in the extension and that the wallet authorizes writes.
3. **Create — one minute.** Create “Should we hold a weekly Web3 study circle?” with a clear description and a one-minute duration. Approve the transaction. Show its confirmation and the new proposal.
4. **Vote — one minute.** Choose Yes and approve the transaction. Show the updated count and voting status. Explain why the same wallet cannot vote again. Switch to a different development account and vote No.
5. **Close and verify — one minute.** After the deadline, show Closed status and the result. Run `.\run.cmd test` to demonstrate deadline and duplicate-vote enforcement directly in the contract tests.
6. **Architecture and limitations — one minute.** Open `contracts/Voting.sol`. Explain `msg.sender`, `hasVoted`, `block.timestamp`, and the two events. Acknowledge that one wallet is not one person and choices are public.

Do not reset or redeploy the node in the middle of a presentation. If it restarts, redeploy, seed and reload the page. A local chain has no public explorer; transaction hashes can be inspected through JSON-RPC.

## Questions and direct answers

**Why blockchain?** The deployed contract provides shared voting rules and independently readable state. Participants can verify tallies without relying on a private administrator database. A local chain is a development simulation; it does not provide the independent operators or consensus assurances of a public network.

**How are duplicate votes stopped?** `hasVoted[proposalId][msg.sender]` is checked before updating state. A successful vote marks the wallet and increments exactly one tally. A revert leaves both unchanged.

**What identifies a voter?** The transaction sender's wallet address. There is no student identity check, voter registry or guarantee of one vote per human.

**Where are deadlines enforced?** The contract rejects a vote when `block.timestamp >= deadline`. The browser countdown is advisory; changing a computer clock cannot bypass the contract.

**Are votes private?** No. Addresses and choices are visible in transaction calldata and `VoteCast` events. Secret-ballot elections would need a different design.

**Can an administrator change the outcome?** The contract has no owner override, delete function, tally setter or upgrade mechanism. Anyone can create a proposal. Deploying a new contract creates a separate state history and address.

**Why no backend database?** The chain holds the core proposal and voting records. The frontend reads JSON-RPC directly. The demo workspace separately uses browser storage for exploration.

**What happens when a transaction is rejected?** The UI shows the error and leaves the form available. A wallet approval is required before a write is broadcast. Confirmation feedback follows a successful receipt.

**What is gas?** Computation and storage fees charged by the network. The local development chain uses valueless test ETH.

**Can this scale?** The contract offers bounded page reads. The current frontend still collects all pages into memory. Larger deployments should add incremental loading and an event indexer.

**Is it production ready?** It is an educational local prototype. Binding elections would require identity, privacy, accessibility, operational resilience and independent security review.

**What did you test?** Contract storage, input and duration boundaries, event fields, both choices, duplicate rejection, per-proposal voting independence, invalid IDs, deadline boundaries and pagination. Frontend tests cover demo workflows, wallet rejection, account/network changes, pending/confirmed feedback and event cleanup. A separate integration suite exercises the actual ethers wallet transport against local RPC.

## Before presenting

- Run `.\run.cmd test`, `.\run.cmd frontend` and `.\run.cmd build`.
- With the node running, run `.\run.cmd wallet` for the frontend RPC transport integration checks.
- Complete the real extension steps in `docs/WALLET-CHECKLIST.md`.
- Use the screenshots in `screenshots/` as supporting evidence; identify demo images as demo mode.
- Be ready to explain the code and limitations in your own words.
