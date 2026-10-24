# dVote — Blockchain-Based Decentralized Voting System

## Overview

dVote is a full-stack educational dApp for transparent proposal voting on an Ethereum-compatible blockchain. The prototype uses Solidity 0.8.24, Hardhat, React, Vite, Tailwind CSS and ethers.js. Its intended demonstration environment is a local Hardhat network.

## Problem and approach

Conventional voting applications often depend on a central database and an administrator to record and count votes. dVote demonstrates shared, inspectable rules in a smart contract. Anyone can create a proposal, wallets can cast one Yes or No vote per proposal, and readers can retrieve the current counts independently through JSON-RPC.

A blockchain does not itself verify voter identity or keep a basic ballot secret. The prototype deliberately documents those limits.

## Implemented design

The frontend connects directly to the blockchain. Read-only ethers calls retrieve proposal pages and account voting status; a browser wallet authorizes state changes. The contract stores proposals in an array and voting status in a nested mapping. It emits indexed creation and voting events. The UI refreshes after confirmations and also responds to events and periodic reads.

The contract validates proposal text and duration and rejects nonexistent IDs, duplicate votes and expired voting. There is no administrator override. A separate, visibly labeled demo workspace uses browser storage for exploration without a wallet.

See [Architecture](ARCHITECTURE.md) for the full flow and invariants.

## Demonstrated behavior

The local deployment and seed scripts created three proposals and recorded six real votes. Browser screenshots show those contract reads and vote distributions. Automated checks cover the contract, React interface, wallet boundary and actual frontend ethers transaction service. See [Validation](../VALIDATION.md) and [screenshots](../screenshots/README.md) for evidence and verification limits.

## Evaluation

The system demonstrates wallet authorization, persistent contract state, atomic transaction validation, timestamp deadlines and independently readable results. It needs no traditional database for core voting. Paging bounds individual contract read responses, although the frontend currently loads all pages into memory.

The local network is a single development process and loses its state when restarted. Public deployments would introduce transaction fees, operational concerns and stronger requirements for review. The contract has not been independently audited.

## Limitations and future work

- Multiple wallets can belong to the same person.
- Votes, addresses and proposal contents are public.
- There is no voter registry, quorum, delegated voting or proposal execution.
- There is no privacy-preserving ballot mechanism or audited production election workflow.
- Larger installations would benefit from eligibility controls, incremental loading, event indexing and independent security review.

## Conclusion

dVote implements the requested local prototype and provides a practical demonstration of Solidity voting rules and React wallet integration. The repository includes reproducible commands, automated checks, screenshots and an interview walkthrough. Real extension approval remains an account-owner acceptance step, recorded separately rather than inferred from automated API tests.
