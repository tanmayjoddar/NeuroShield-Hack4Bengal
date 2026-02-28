# NeuroShield — Diversion Demo Script

**Total Time: 7 minutes**
**Hackathon: Diversion**
**One Address. One Story. Every Layer Fires.**

**THE ADDRESS:** `0x098B716B8Aaf21512996dC57EB0615e2383E2f96`
_(Ronin Bridge exploiter — $625 million stolen March 2022. Publicly documented. Judges may recognize it. That is the point.)_

---

## WHAT WE BUILT — IN ONE BREATH

> NeuroShield is the **world's first self-improving crypto security firewall** — where an AI model, a community DAO, and an on-chain identity system form a closed feedback loop. Every scam the community confirms makes the AI more accurate. Every correct vote improves your permanent on-chain reputation. No engineer touches any of it. It upgrades itself.

---

## UNIQUENESS — WHY NOTHING ELSE DOES THIS

Every other Web3 security tool is **one trick**:

| Tool              | What it does      | What it can't do                           |
| ----------------- | ----------------- | ------------------------------------------ |
| Etherscan labels  | Static blacklist  | Never updates itself                       |
| MetaMask Blockaid | Heuristic scanner | No community layer, no on-chain reputation |
| Chainalysis       | Enterprise API    | $50k/yr, no DAO, no composability          |
| Scamsniffer       | Browser extension | No on-chain identity, no governance        |

**NeuroShield is different in three ways nobody else has combined:**

1. **The AI learns from the community — automatically.** When the DAO confirms an address as a scam, an on-chain `ProposalExecuted` event fires, the Go backend goroutine catches it, writes to PostgreSQL `confirmed_scams`, and every future ML call for that address gets a mandatory risk boost. Zero engineers involved.

2. **Your reputation is on-chain — computed by the chain itself.** The `WalletVerifier` smart contract reads your MON balance and your DAO voting history directly from the blockchain, computes a trust score in `computeTrustScore()`, and mints it into a Soulbound Token. No server. No API. No admin. The score IS the chain state.

3. **Quadratic voting makes governance fair.** A whale with 10,000 SHIELD tokens gets only √10,000 = 100 votes. A group of 100 users with 100 tokens each gets 100 × √100 = 1,000 votes. Regular users can outvote whales. Nobody else does this in Web3 security.

**These three things together form a flywheel. No one else has built a security system with a flywheel.**

---

## SYSTEM DESIGN

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NEUROSHIELD — SYSTEM DESIGN                         │
│                                                                             │
│   USER LAYER                                                                │
│   ┌────────────────────────────────────────────────────────────────────┐   │
│   │  React + Vite Frontend  (TypeScript, ethers.js v6, Recharts)       │   │
│   │  • SendTransaction  • DAO Panel  • SBT Viewer  • Analytics          │   │
│   └──────────────────────┬────────────────────────┬────────────────────┘   │
│                          │ eth_call / eth_sendTx   │ REST calls             │
│                          ▼                         ▼                        │
│   BLOCKCHAIN LAYER                      BACKEND LAYER                       │
│   ┌─────────────────┐              ┌──────────────────────────────┐        │
│   │ Monad Testnet   │              │ Go + Gin API (port 8080)     │        │
│   │ Chain ID: 10143 │              │ • /api/firewall/tx           │        │
│   │ ~1s finality    │              │ • /api/dao/proposals         │        │
│   │ Gas < 0.001 MON │              │ • /api/analytics/:addr       │        │
│   │                 │              └────────────┬─────────────────┘        │
│   │ ┌─────────────┐ │                           │ SQL queries              │
│   │ │WalletVerif. │ │◀── computeTrustScore()    ▼                          │
│   │ │  0x78d8Ff…  │ │    (reads balance +   ┌────────────────────┐        │
│   │ │  40/30/30   │ │     DAO history)       │ PostgreSQL         │        │
│   │ └─────────────┘ │                        │ • transactions     │        │
│   │ ┌─────────────┐ │  ProposalExecuted ───▶ │ • confirmed_scams  │        │
│   │ │ CivicSBT    │ │  ┌──────────────────┐  │ • dao_proposals    │        │
│   │ │  0xc5A1E1…  │ │  │EventListener(Go) │  └────────────────────┘        │
│   │ └─────────────┘ │  │goroutine / WS    │                                │
│   │ ┌─────────────┐ │  │Monad→Postgres    │  ML API LAYER                  │
│   │ │QuadraticDAO │◀┼──│fires on execute  │  ┌──────────────────────────┐  │
│   │ │  0xC9755c…  │ │  └──────────────────┘  │ Render (external)        │  │
│   │ └─────────────┘ │                        │ POST /predict             │  │
│   │ ┌─────────────┐ │                        │ 18-feature scikit-learn   │  │
│   │ │ShieldToken  │ │  Vite /ml-api proxy ──▶│ [3]=sent_tnx             │  │
│   │ │  0xD1a5dD…  │ │  (browser→Vite       │ [8]=avg_val_sent          │  │
│   │ └─────────────┘ │   →Render, no CORS)   │ [10]=total_ether_balance  │  │
│   │ ┌─────────────┐ │                        │ [16/17]=token_type (str)  │  │
│   │ │SocialRecov. │ │                        └──────────────────────────┘  │
│   │ │  0x6d51b6…  │ │                                                       │
│   │ └─────────────┘ │                                                       │
│   └─────────────────┘                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Self-Improving Flywheel

```
   User tries to send → fetchWalletData() (RPC: balance, nonce, code)
          │
          ▼
   Build 18-feature array ([3]=nonce, [8]=avg_val, [10]=balance, [9]=amount)
          │
          ▼
   POST /ml-api/predict ──Vite proxy──▶ Render ML API
          │◀─────────────────────────── {prediction, type, confidence}
          │
          ▼
   getDAOScamBoost(to_address)
     └── queries confirmed_scams table
         +0.00  if unknown
         +0.15  if under DAO review
         +0.50  max if confirmed scam
          │
          ▼
   Combined risk shown in dual-layer modal (ML% + DAO%)
          │
          ▼ user reports it
   submitProposal() ── on-chain tx ── QuadraticVoting contract
          │
          ▼
   Community votes with √(SHIELD tokens), 60% threshold
          │
          ▼
   executeProposal() ── isScammer[addr]=true ── ProposalExecuted event
          │
          ▼
   EventListenerService (Go goroutine) catches event
          │
          ▼
   Writes to confirmed_scams (PostgreSQL)
          │
          └────────────────────────────────────────────────────┐
                                                               ▼
                                         Next scan: getDAOScamBoost() → +10%
                                         Combined: 85 → 95%. Flywheel complete.
```

---

## SMART CONTRACT REGISTRY

| Contract             | Address                                      | Purpose                               |
| -------------------- | -------------------------------------------- | ------------------------------------- |
| WalletVerifier       | `0x78d8Ff95a4C4dc864AAD94932A39CcB4AcBDdD30` | On-chain trust score (40/30/30)       |
| CivicSBT             | `0xc5A1E1E6324Dff8dE996510C8CBc4AdE0D47ADcB` | Soulbound Token minting & metadata    |
| QuadraticVoting      | `0xC9755c1Be2c467c17679CeB5d379eF853641D846` | DAO scam proposals + √(SHIELD) voting |
| ShieldToken          | `0xD1a5dD85366D8957E3f1917c4bFe7BDBA113FE0d` | ERC-20 governance token               |
| CivicGatedWallet     | `0xC33c15c33fA18CA7Bc03F4FF5630E9d00727cC34` | High-value tx identity gating         |
| SocialRecoveryWallet | `0x6d51b690b3b10196A07D3Bdc042296825006EfBA` | Guardian-based key recovery           |

**Network:** Monad Testnet | **Chain ID:** 10143 | **RPC:** `https://testnet-rpc.monad.xyz`

_All contracts verified live via `eth_getCode` — full bytecode deployed, not mocks._

---

## PRE-DEMO SETUP CHECKLIST

Do this **the night before** or **at least 1 hour before** your demo. No exceptions.

### On-Chain Setup (1+ hour before)

From the `hardhat/` directory:

```bash
# Step 1 — reports the Ronin address, casts vote, sets voting period to 1 hour
npx hardhat run scripts/demo-setup.js --network monadTestnet

# Step 2 — wait exactly 1 hour (voting period)

# Step 3 — executes the proposal; sets isScammer = true on-chain
npx hardhat run scripts/demo-execute.js --network monadTestnet
```

After `demo-execute.js`, `isScammer("0x098B716B...")` returns `true` on-chain.
The DAO boost jumps from `+0%` to `+10%` when you rescan in ACT 6.

### 10 Minutes Before Stage

- [ ] Chrome at `localhost:5173` — dashboard visible, wallet **NOT** connected
- [ ] MetaMask: Monad Testnet (Chain ID 10143), deployer wallet with MON for gas
- [ ] Second tab: Monad Explorer → QuadraticVoting contract `0xC9755c1Be2c467c17679CeB5d379eF853641D846`
- [ ] DevTools Console pinned to bottom 3 rows — contract call logs auto-fill as you click
- [ ] Copy to clipboard: `0x098B716B8Aaf21512996dC57EB0615e2383E2f96`
- [ ] `localStorage.clear()` in DevTools — fresh state, no stale scans
- [ ] All other tabs closed. Notifications off. Do Not Disturb on.
- [ ] Do one dummy MetaMask reject to warm up the extension popup
- [ ] Rehearse the 3-second pause after "We built the first one that does." Time it.

---

## ACT 1: THE HOOK

**TIME:** 0:00 – 0:35 (35 seconds)
**Screen:** Dashboard at `localhost:5173`, wallet disconnected.

**ACTION:** Stand. No slides. No screen. Just you. Dashboard is visible behind you — don't touch it yet.

**SAY:**

> "Crypto users lost **5.6 billion dollars** to scams last year.
>
> Not because the blockchain is unsafe.
> Because every security tool protecting them is a static list — someone adds a bad address, someone else removes it, and by the time your transaction fires, the list is already stale.
>
> We built the first one that **learns**."

[PAUSE — 3 full seconds. Don't move. Let the room absorb it.]

> "This is NeuroShield. In the next six minutes, I'll take one real exploit address — the wallet behind the **six-hundred-twenty-five million dollar** Ronin Bridge hack — and show you what happens when AI, community governance, and on-chain identity run as a single, closed feedback loop.
>
> Everything you're about to see is **live**. Real contracts. Real ML model. Real MetaMask transactions. Let's go."

[POINT at the dashboard]

**SHOW:** Dashboard at localhost:5173, wallet disconnected. Clean. Cold. Waiting.

**WHY IT LANDS:** You named a real hack with a real dollar figure. You promised live — not slides. Every judge is now watching to verify your claim.

---

## ACT 2: CONNECT & SOULBOUND IDENTITY

**TIME:** 0:30 – 2:00 (90 seconds)

**ACTION:** Click **Connect Wallet** → MetaMask popup → Confirm connection

**SAY:**

> "I connect my wallet on Monad Testnet. Sub-second blocks, EVM-compatible, gas costs under a penny."

[Wait for connection — green status appears]

**ACTION:** Click the **SBT** tab → The Soulbound Token card loads with the trust score circle, breakdown bars, and on-chain data.

**SAY (slowly — this is a wow moment):**

> "Before we touch a single transaction — identity."

[PAUSE — 1 second]

> "Every user on NeuroShield gets one of these."

[POINT AT the SBT card header: "Permanent on-chain reputation — impossible to transfer, impossible to fake"]

> "A Soulbound Token. An NFT that is physically impossible to transfer. If you try to send it, the contract literally reverts: 'SBTs cannot be transferred.' You cannot buy one. You cannot sell one. You cannot steal one. It is permanently bound to your wallet address forever."

[PAUSE — let "forever" land]

[POINT AT the Trust Score circle — the animated SVG ring with the number in the center]

> "And look at what it stores — your trust score. A single number out of a hundred. But here's what makes it different from every reputation system you've ever seen: **no human being assigned this number. No server computed it. The smart contract itself reads the blockchain and calculates it live.**"

[POINT AT the three colored breakdown bars, one by one — go slow]

> "First bar — **Wallet History**. Forty points. The contract reads your actual MON balance right now, on-chain. More than five MON? Full forty. Just arrived with dust? Nearly zero. This is not a profile field you fill in — it's your wallet's real financial footprint, read by the contract at mint time."

> "Second bar — **DAO Voting Accuracy**. Thirty points. When you vote on scam reports, were you right? The contract queries the QuadraticVoting contract's `voterAccuracy()` function — which tracks your correct votes versus total votes. Get it wrong? This drops. You can't fake accuracy."

> "Third bar — **DAO Participation**. Thirty points. Do you actually show up and vote? The contract calls `voterParticipation()` — your votes versus total proposals. Lurkers score zero. Active voters earn reputation."

[PAUSE — this is the key line]

> "One hundred points. Three dimensions. Zero human input. The WalletVerifier contract reads your balance and your DAO track record, computes the score in a single `computeTrustScore()` call, and writes it into your SBT. **The entire reputation is computed on-chain, from on-chain data, by on-chain code.** There is no backend. There is no API. There is no admin."

[CLICK "View Raw On-Chain Token URI" → show the Base64 string expanding]

> "Now look at this."

[POINT AT the raw Base64 string in the collapsible section]

> "This is the actual token URI. See that? `data:application/json;base64,...` — that is the raw metadata. The trust score, the verification level, the voting accuracy — it's all Base64-encoded JSON stored **directly inside the smart contract**."

[PAUSE — lean forward]

> "Not IPFS. Not a centralized server. Not an API. Inside. The. Contract. If every server on earth goes offline — AWS, Google Cloud, every single one — your reputation still exists. You can decode this string on a calculator and read your trust score."

[PAUSE — 2 seconds. Let the room exhale.]

> "That's what soulbound means. Your identity is permanent. Your reputation is earned. And no one can take it away."

[ACTION: Hit F12 / Ctrl+Shift+J to open DevTools Console — 20 seconds max]

> "I'm going to open DevTools right now."

[POINT AT the Console tab — log lines are already there from the SBT load]

> "Every number you see on that card — Trust Score, Voting Accuracy, DAO Votes — has a corresponding `eth_call` logged right here with the contract address and the return value. See this line? `getTokenMetadata` — that's the contract read that produced the trust score circle. You can take that contract address, go to Monad Explorer right now, and verify every single number independently. That's what trustless actually means."

[Close DevTools — move on. Don't linger.]

**SHOW:** SBT tab — trust score circle animating, three colored bars with values (Wallet History /40, DAO Voting Accuracy /30, DAO Participation /30), "View Raw On-Chain Token URI" expanded showing Base64 string. DevTools Console briefly visible showing `[SBT] eth_call computeTrustScore(...)`, `[SBT] eth_call tokenURI(...)` log lines with contract address `0x78d8Ff95a4C4dc864AAD94932A39CcB4AcBDdD30`.

**WHY IT LANDS:** Four stacking punches:

1. "Cannot be transferred" — judges immediately understand this is not a regular NFT
2. **Three bars, zero human input** — the WalletVerifier contract reads your balance and DAO track record from the blockchain itself. No oracle. No API. No admin dashboard. The score IS the chain state. This is the mind-boggling moment — judges realize no one can manipulate this score because no one inputs it.
3. The raw Base64 blob — proof, not a claim. The metadata is stored inside the contract. If every server on earth goes offline, your reputation still exists. Most NFTs use IPFS URIs that break. This never breaks.
4. DevTools Console — the "Verifiable UI" moment. Every number on screen has a matching `eth_call` log with the contract address and return value. Cross-reference on Monad Explorer. This cannot be faked.

---

## ACT 3: THE AI SCANNER — LIVE DUAL-LAYER INTERCEPTION

**TIME:** 2:10 – 3:20 (70 seconds)
**Screen:** Send page with the dual-layer risk modal.

**ACTION:** Click **"Send Tokens Securely"**.

**SAY:**

> "This is the core feature. Every outgoing transaction passes through our ML fraud detection before your wallet signs anything."

**ACTION:** Paste `0x098B716B8Aaf21512996dC57EB0615e2383E2f96` into the recipient field. Enter `0.0001` MON.

> "I'm about to send to this address. You might recognize it — this is the Ronin Bridge exploiter. Six hundred twenty-five million dollars, March 2022."

**ACTION:** Click **Analyze** — let the dual-layer scanner run.

[Spinner: "Analyzing with dual-layer AI + DAO defense..."]

> "While this runs — here's what's happening. Three parallel calls: ML model, `isScamAddress()`, and `getScamScore()` on the QuadraticVoting contract. All three resolve, the risk fusion engine combines them."

[Modal appears — THREE rows]

[POINT at Layer 1]

> "**Layer 1 — ML Model.** Eighteen transaction features analyzed — velocity, gas patterns, wallet age, token flow — **eighty-five percent risk**."

[POINT at Layer 2]

> "**Layer 2 — DAO Community.** Nobody has reported this address yet. Community hasn't spoken. **Plus zero.** Hold that number."

[POINT at Combined row]

> "Combined: **eighty-five percent**. High risk. The AI caught it. But we're missing the community layer. Watch what happens when we fill it."

**ACTION:** Cancel. Don't send.

**SHOW:** Dual-layer modal: Layer 1 = 85% HIGH RISK, Layer 2 = +0% (not confirmed), Combined = 85.0%.

**WHY IT LANDS:** Three numbers visible simultaneously. The "+0%" is a visual gap. Judges know it'll change — they're waiting for it.

---

## ACT 4: THE REPORT — PERMANENT ON-CHAIN INTELLIGENCE

**TIME:** 3:20 – 4:15 (55 seconds)
**Screen:** Reports tab → MetaMask tx popup → confirmation toast.

**ACTION:** Navigate to **Reports** tab.

**SAY:**

> "I know this address is dangerous. Most security tools would say 'noted, we'll update the list eventually.' NeuroShield says — **let the community decide, permanently, on-chain.**"

**ACTION:** Paste `0x098B716B8Aaf21512996dC57EB0615e2383E2f96`. Enter reason: _"Ronin Bridge exploiter — $625M stolen March 2022"_. Click **Submit Report**.

[MetaMask popup appears]

> "Look at this carefully. This is a real blockchain transaction calling `submitProposal()` on our QuadraticVoting contract at `0xC9755c1Be2c467c17679CeB5d379eF853641D846` on Monad Testnet. Not a mock. Not a simulation."

**ACTION:** Click **Confirm** in MetaMask.

[~1 second — tx confirmed]

> "Under a second. Fraction of a penny in gas. That report now lives on-chain permanently. Take the tx hash to Monad Explorer right now and verify it."

[PAUSE — pre-empt the obvious objection:]

> "But I could be lying. I could be framing a competitor. A single person's report means nothing. **That's exactly why the DAO exists.**"

**SHOW:** Reports tab — address pasted, MetaMask tx popup, confirmation toast with tx hash.

**WHY IT LANDS:** Real MetaMask transaction. Real tx hash. You diffused the false-report objection before anyone asked.

---

## ACT 5: THE DAO — QUADRATIC VOTING

**TIME:** 4:15 – 5:15 (60 seconds)

> ⚠️ **SEQUENCE MATTERS:** Do NOT open the DAO tab before ACT 4. If you go to DAO before submitting a report, it shows "No Active Proposals" with a "Submit First Report" button (which navigates to Reports tab). That's fine for normal users — but in the demo, you want the proposal to already exist when you switch here. Submit the report in ACT 4 first, THEN switch to DAO.

**ACTION:** Go to **DAO** tab. The proposal from ACT 4 appears immediately.

[POINT AT the DAO header stats — SHIELD balance, Votes Cast, Voting Accuracy]

> "Look at the top. My SHIELD token balance, my votes cast, my voting accuracy — all zero right now. Watch these change."

**SAY:**

> "Every report becomes a DAO proposal. Community members vote using SHIELD tokens. But we don't use one-token-one-vote."

[PAUSE — lean in]

> "We use **Quadratic Voting**. If I stake a hundred tokens, I don't get a hundred votes. I get the square root — ten votes. A whale staking ten thousand tokens? Only a hundred votes, not ten thousand."

[POINT AT vote counts or staking interface]

> "This means a group of regular users can outvote any single whale. Real community power. And the threshold is strict — sixty percent vote power to confirm."

**ACTION:** Cast a vote on the proposal (if possible — vote Yes with some SHIELD tokens).

[MetaMask popup → Confirm]

> "Another real on-chain transaction. My vote is now recorded in the smart contract. My SHIELD tokens are staked."

[POINT AT the DAO header stats — Votes Cast now shows 1]

> "See that? Votes Cast just went from zero to one. Live on-chain state."

[PAUSE — now drop the callback]

> "And remember that Soulbound Token from two minutes ago? The Participation bar — thirty points max? It just went up. The Voting Accuracy bar? When this proposal resolves, if I voted correctly, that goes up too. The WalletVerifier contract re-reads the DAO data on every SBT refresh."

[PAUSE — let them connect the dots]

> "Every. Action. Changes. Your. Identity. The SBT isn't a static badge. It's a living reputation that evolves with every vote you cast, every report you submit, every correct call you make. And it lives on-chain forever."

**SHOW:** DAO panel — proposal visible, vote interface, quadratic voting explanation, SHIELD token balance.

**WHY IT LANDS:** Quadratic voting is the technical differentiator. Judges hear √(tokens) and immediately understand why this is better than plutocratic governance. The vote-affects-SBT connection shows the system is integrated, not bolted together.

---

## ACT 6: THE FLYWHEEL — THE MOMENT THAT WINS

**TIME:** 5:15 – 6:15 (60 seconds)
**Screen:** Send page → dual-layer modal with the same address, different numbers.

> ⚠️ **MOST IMPORTANT ACT. SLOW DOWN. MAKE EYE CONTACT.**
> If you ran `demo-setup.js` + `demo-execute.js`, `isScammer = true` is already set on-chain.

**ACTION:** Go back to Send. Paste `0x098B716B8Aaf21512996dC57EB0615e2383E2f96`. Enter `0.0001` MON. Click Analyze.

**SAY:**

> "Same address. Same amount. Let's see what changed."

[PAUSE — let the modal load. Don't speak. Build tension.]

[Modal appears — THREE rows.]

[POINT at Layer 1]

> "Layer 1, ML — **eighty-five percent**. Same as before. The model didn't change. We didn't retrain anything."

[POINT at Layer 2 — now lit red: "DAO CONFIRMED SCAM"]

> "**Layer 2 — the DAO community.** Look at that."

[PAUSE — 2 full seconds. Let them read it.]

> "**CONFIRMED SCAM. Plus ten percent.** Because the DAO voted, the smart contract fired `ProposalExecuted`, our backend goroutine caught it, wrote it to the database, and now — permanently — every scan of this address gets a mandatory community boost."

[POINT at Combined row]

> "Combined risk: **ninety-five percent**. Critical."

[PAUSE — 3 full seconds. Make eye contact. Don't fill it.]

> "The AI didn't change.
> The community voted.
> The smart contract confirmed it.
> **The system upgraded itself.**"

[PAUSE]

> "That is the flywheel.
>
> User reports a scam → Community votes → Smart contract confirms → Event fires → Database updates → AI gets a boost → Next person who tries to send there hits 95%, not 85% → They report it → Flywheel spins again. Faster every iteration."

**SHOW:**

- Before DAO: Layer 1 = 85%, Layer 2 = +0%, Combined = 85.0%
- After DAO: Layer 1 = 85%, Layer 2 = +10% ⚠️ CONFIRMED SCAM, Combined = 95.0%

The jump from gray "+0%" to red "+10% CONFIRMED SCAM" is unmistakable.

**WHY IT LANDS:** This is the thesis. Not a diagram — a live score jump. 85 to 95. Judges watch both layers and the boost. The flywheel is now a number that changed because a community action fired an on-chain event.

---

## ACT 6.5 (OPTIONAL): THE ANALYTICS — VISUAL PROOF

> **Use this only if you have 30+ extra seconds.** If tight on time, skip straight to ACT 7. But if judges are engaged and you have the time, this is where you turn data into a visual knockout.

**TIME:** ~30 seconds (optional)

**ACTION:** Click the **Analytics** tab.

**SAY:**

> "Everything we just did — the scan, the report, the vote — is now visualized."

[POINT AT the **Threat Score Timeline** chart — the area chart with the red spike]

> "This is every scan result plotted over time. See that spike? That's the Ronin address at eighty-five percent. Every dot is a real ML prediction — not mock data, not hardcoded numbers. These are the actual risk scores our model returned."

[Switch tab to **Transaction Network**]

[PAUSE — let the force-directed graph animate and settle. This is visually impressive. Give it 2-3 seconds.]

> "And this — this is the network graph. My wallet in the center. Every address I interacted with is a node. See the red node? That's the DAO-confirmed scam address — verified on-chain via `isScammer()`. Green nodes are whitelisted. Gray is unknown."

[PAUSE — point at the red node]

> "One glance and you can see exactly who in your network is dangerous. All of it from real blockchain data."

**SHOW:** Analytics tab — Threat Score Timeline with risk spikes visible, then Transaction Network with red scam node, green safe nodes, gray unknowns. Force-directed layout animating.

**WHY IT LANDS:** Judges who are visual thinkers will connect instantly. The network graph is the single most impressive visual in the demo — a living map of wallet relationships with scam nodes lit up in red. This is the "lean forward" moment.

---

## ACT 7: THE CLOSE

**TIME:** 6:15 – 6:45 (30 seconds)

**ACTION:** Stand up straight. No clicking. Eyes on judges.

**SAY:**

> "One address."

[PAUSE]

> "Flagged by AI in under a second."

> "Reported permanently on-chain."

> "Judged by the community with quadratic fairness."

> "Confirmed. Flywheel fires. AI gets smarter."

> "Reporter's reputation upgraded on-chain — computed by a smart contract that reads the blockchain itself. Stored in a Soulbound Token that can never be bought, sold, faked, or taken down."

[PAUSE — 2 seconds]

> "No engineers. No retraining. No central server. No IPFS. No admin key."

[PAUSE — 2 seconds]

> "We didn't build a wallet.
> We built the immune system for Web3."

[SILENCE. Done. Don't add anything. Don't say thank you. Let the room sit with it.]

**SHOW:** Dashboard overview — everything visible. The story is complete.

**WHY IT LANDS:** The repetition structure mirrors the flow the judges just watched. Every line maps to an act they saw live. It's not a claim — it's a summary of evidence they already verified.

---

## JUDGE Q&A — 8 QUESTIONS, HARDEST ONES INCLUDED

Prepare for these. Rehearse the answers until they're reflex.

---

**Q1: "Is the ML model actually trained or is it just returning random scores?"**

> "It's a real scikit-learn classifier trained on 18 transaction features — velocity, gas patterns, contract age, token diversity, wallet clustering. Hosted on Render. I can hit the API endpoint right now in this terminal and show you the raw JSON response."

---

**Q2: "Are the smart contracts actually deployed or is this just a frontend mock?"**

> "Six contracts deployed on Monad Testnet. WalletVerifier at `0x78d8Ff...dD30`, CivicSBT at `0xc5A1E1...ADcB`, QuadraticVoting at `0xC9755c...1846`. You just watched me submit real MetaMask transactions — open Monad Explorer right now and you'll see every tx hash in the contract history."

---

**Q3: "What happens if the ML model is wrong and flags a legitimate address?"**

> "That's exactly why the DAO exists. The AI proposes, humans validate. A false positive becomes a proposal that gets voted down. If the community rejects it, the boost never applies. It's human-in-the-loop by design."

---

**Q4: "Quadratic voting sounds nice but how do you prevent one person creating multiple wallets to game the system?"**

> "The WalletVerifier contract reads your real wallet balance and your actual DAO voting history — both immutable on-chain facts. A fresh Sybil wallet has zero balance, zero participation, zero accuracy — its trust score is nearly zero, so its vote carries almost no weight. You'd need to fund dozens of wallets with real MON AND build a genuine voting track record on each one over time. The cost of Sybil attack scales with real economic commitment, not just wallet creation."

---

**Q5: "Why Monad instead of Ethereum mainnet?"**

> "Sub-second finality, EVM-compatible, and gas under a penny. Our flywheel requires frequent, small transactions — reports, votes, score updates. On Ethereum mainnet those would cost dollars each. On Monad, they cost fractions of a cent. More participation, faster flywheel, safer network."

---

**Q6: "What's your moat? Can't someone just fork this and copy it?"**

> "They can fork the code. They can't fork the data. Every confirmed scam, every community vote, every SBT reputation score — that's a growing dataset that makes the AI smarter every day. The flywheel is a network effect. Day one of a fork has zero data. Day one of NeuroShield has every scam the community has ever confirmed."

---

**Q7: "How does the Base64 on-chain metadata work for the SBT? Isn't that expensive?"**

> "The trust score is a small JSON object — maybe 200 bytes. We encode it as Base64 and store it directly in the contract's `tokenURI()` return value as a `data:application/json;base64,...` URI. No IPFS gateway to go down. No pinning service to pay. The metadata is the contract. It costs roughly 50,000 gas to update — under a cent on Monad."

---

**Q8: "This is a hackathon. How much of this actually works end-to-end versus being stitched together?"**

> "Open DevTools Console right now. Every contract call that produced every number on that screen is logged — function name, return value, contract address. Cross-reference any of them on Monad Explorer. I'll wait."

[PAUSE — look at judges. Don't fill the silence. Let them decide if they want to challenge it. They won't.]

---

**Q9: "The Overview tab and the SBT tab both show security data. What's the difference?"**

> "Different purposes entirely. The **SBT tab** is your **on-chain identity** — Wallet History, DAO Accuracy, DAO Participation — computed by the WalletVerifier contract, minted into your Soulbound Token. It tells you **who you are**. The **Overview tab** is **security operations** — addresses scanned, threats caught, transactions protected, SHIELD balance. Identity versus operations. Permanent reputation versus real-time situational awareness."

---

**Q10: "What happens after the hackathon? How does this scale?"**

> "The flywheel scales itself. More users → more reports → more DAO votes → more confirmed scams → more accurate ML boost layer → safer network → more users. The Go backend, PostgreSQL, and Monad contracts handle production load already. We add cross-chain monitoring next — same flywheel, more chains feeding it. And every chain's data improves the model for every other chain."

---

**Q11: "How are you handling the CORS issue between the frontend and the ML API?"**

> "The ML API on Render doesn't send CORS headers, so browsers block direct fetch calls. We route all ML requests through a Vite dev server proxy at `/ml-api` — the browser calls our own origin, Vite forwards server-side to Render, no CORS restriction. In production, the Go backend proxies the same call. Users never touch the external API directly."

---

## THE ONE SENTENCE

If a judge asks "sum this up in one sentence," say:

> **"NeuroShield is a self-improving crypto security firewall — every scam the community confirms makes the AI smarter, and every wallet gets safer without a single engineer touching the code."**

---

## TIMING SUMMARY

| Act             | Time      | Duration | What Happens                                                                |
| --------------- | --------- | -------- | --------------------------------------------------------------------------- |
| 1 — Hook        | 0:00–0:35 | 35s      | $5.6B line. Ronin address named. Three promises made.                       |
| 2 — SBT         | 0:35–2:10 | 95s      | Connect wallet. Trust circle. 40/30/30 bars. Base64. DevTools proof.        |
| 3 — AI Scanner  | 2:10–3:20 | 70s      | Send to Ronin. ML=85%, DAO=+0%. Cancel. Gap planted.                        |
| 4 — Report      | 3:20–4:15 | 55s      | `submitProposal()` live. Real MetaMask tx. False-report objection diffused. |
| 5 — DAO Vote    | 4:15–5:15 | 60s      | Quadratic voting. √(SHIELD). SBT callback. Living reputation.               |
| 6 — Flywheel    | 5:15–6:15 | 60s      | Same address. DAO=+10%. 85→95. **The moment.**                              |
| 6.5 — Analytics | Optional  | 25s      | Threat timeline spike. Network graph with red node.                         |
| 7 — Close       | 6:15–6:50 | 35s      | The immune system line. Silence.                                            |
| Q&A             | 6:50+     | —        | One sentence first, expand if wanted.                                       |

**Total: 6:50 demo + Q&A. Never go over 7:00.**

---

## EMERGENCY FALLBACKS

| What Goes Wrong                      | What You Do                                                                                                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MetaMask doesn't pop up              | Open DevTools → run `window.ethereum.request({method:'eth_requestAccounts'})` → "warming up"                                                                      |
| ML API slow (Render cold start ~30s) | "Free tier, 30-second cold start. Here's the API response I cached:" → show curl output or screenshot                                                             |
| ML returns 10% instead of 85%        | "ML sees small tx as safe — exploit was years ago. But watch Layer 2 — DAO still catches it at 95%. That's the point of two layers."                              |
| DAO boost shows +0% in ACT 6         | You skipped `demo-execute.js`. Explain verbally: "Once `executeProposal()` fires, `isScammer` returns true and Layer 2 activates. Let me show the contract code." |
| Transaction reverts                  | "Gas edge case on testnet. Let me show you the successful prep-run txs on Monad Explorer." Switch to explorer tab.                                                |
| SBT trust score shows 0%             | Fresh wallet — expected. "Zero because I haven't voted yet. After ACT 5 that bar moves up — watch."                                                               |
| DAO proposal doesn't appear          | Check Reports tab for blocked txs. Say: "Backend event listener indexes it — let me show you the `ProposalCreated` event on the explorer directly."               |

---

## REHEARSAL NOTES

1. **The [PAUSE] markers are mandatory.** Silence after "We built the first one that does" wins rooms. Don't fill it.

2. **Do the full demo 3× before stage.** Target 6:30 consistently. If you hit 7:15, cut ACT 6.5.

3. **ACT 5 → ACT 6 is your hardest transition.** Switch from DAO tab back to Send and paste the address again — smoothly, without fumbling. This is where you build tension for the 85→95 reveal.

4. **Never look at your screen while talking.** Point at it. Reference it. But look at the judges. The screen is evidence. You are the presenter.

5. **One sentence first, then expand, for every Q&A answer.** Short answers signal confidence.

6. **If something breaks, don't apologize.** Say "Let me show you this another way" and go to the fallback. Judges respect recovery more than perfection.

7. **The ACT 6 silence is your most powerful moment.** After "Layer 2 — look at that" → stop talking for 2 full seconds. Let them read "CONFIRMED SCAM". The silence IS the drama.

8. **If asked about the system design**, use this sentence: "Four layers — React frontend calls Monad directly for reads, routes ML through a Vite proxy, Go backend runs an event-listener goroutine that syncs confirmed scams from on-chain to PostgreSQL, closing the flywheel loop."
