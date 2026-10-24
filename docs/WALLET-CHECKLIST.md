# Real browser wallet acceptance check

This checklist requires a browser with a wallet extension and the account owner to approve its prompts. Automated EIP-1193 transport tests do not certify a particular extension or its approval screen.

Use a dedicated development wallet, the local node at `http://127.0.0.1:8545`, chain ID **31337**, and Hardhat's publicly known local test accounts. Do not enter a personal recovery phrase or personal private key into this project.

| Step | Expected result | Manual status |
| --- | --- | --- |
| Select Use blockchain | Real seeded proposals appear | User to confirm |
| Connect wallet and decline | Readable rejection, no account connected | User to confirm |
| Connect and approve account 2 | Address displayed; proposals remain readable | User to confirm |
| Select another wallet network | Wrong-network message and switch action | User to confirm |
| Switch to Hardhat Local | Wrong-network message clears | User to confirm |
| Create a one-minute proposal, decline approval | No proposal added; form remains editable | User to confirm |
| Retry and approve proposal creation | Pending feedback, then new proposal | User to confirm |
| Vote Yes and approve | Count increases once; wallet marked as voted | User to confirm |
| Try voting again | No second vote action; contract tests also verify rejection | User to confirm |
| Switch to account 3 | Address and per-wallet voting status update | User to confirm |
| Vote No before deadline | No count increases once | User to confirm |
| Wait for the deadline | Closed status and final result; no vote action | User to confirm |
| Disconnect from app | Connected address hidden | User to confirm |

These statuses deliberately remain unconfirmed until observed in a real extension. Run `.\run.cmd frontend` for automated UI checks and `.\run.cmd wallet` for actual local RPC transaction checks using a test EIP-1193 wallet.
