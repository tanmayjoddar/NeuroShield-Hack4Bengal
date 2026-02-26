1. Pre-Transaction ML Firewall
Files:

ai.go
wallet_analytics.go
firewall.go
config.go
routes.go
dualVerification.ts
contract.ts
Send.tsx
predict.py
predict_v2.py
predict_v3.py
predict_new.py
API Endpoints:

Method	Route
POST	/api/firewall/tx
GET	/api/firewall/stats
POST	/api/secure/transaction/high-value
GET	/api/transactions (auth)
POST	https://ml-fraud-transaction-detection.onrender.com/predict (external ML)
Smart Contract Functions:

Function	Contract
isScamAddress(address)	QuadraticVoting (read by ContractService)
(ML firewall is off-chain; no dedicated contract)	—
2. Quadratic Voting Scam DAO
Files:

QuadraticVoting.sol
dao.go
dao.go
routes.go
contract.ts
DAOPanel.tsx
DAOVoting.tsx
API Endpoints:

Method	Route
GET	/api/dao/proposals
GET	/api/dao/scamscore/:address
GET	/api/dao/address/:address
POST	/api/dao/vote (auth)
POST	/api/dao/proposals (auth)
Smart Contract Functions (QuadraticVoting.sol):

Function	Type
submitProposal(address, string, string)	write
castVote(uint256, bool, uint256)	write
executeProposal(uint256)	write
getProposal(uint256)	view
getVote(uint256, address)	view
getVoterStats(address)	view
proposalCount()	view
scamThreshold()	view
votingPeriod()	view
setVotingPeriod(uint256)	admin
setScamThreshold(uint256)	admin
3. ML + DAO Flywheel
Files:

ai.go — getDAOScamBoost(), IsAddressBlacklisted()
dao.go — auto-execute in CastVote(), writes ConfirmedScam
dao.go — ConfirmedScam model
wallet_analytics.go — GetAddressScamHistory()
db_init.go — ConfirmedScam auto-migrate
QuadraticVoting.sol — _updateVoterAccuracy()
dualVerification.ts — reads on-chain scam score to boost ML risk
API Endpoints (flywheel cycle):

Method	Route	Role in flywheel
POST	/api/firewall/tx	ML reads ConfirmedScam via getDAOScamBoost()
POST	/api/dao/vote (auth)	On quorum → writes ConfirmedScam
GET	/api/dao/scamscore/:address	Returns DAO confidence score
GET	/api/dao/address/:address	Checks DAO-confirmed blacklist
POST	external ML /predict	Returns base risk; boosted by DAO data
Smart Contract Functions:

Function	Flywheel role
executeProposal(uint256)	Marks scam on-chain, updates isActive
isScamAddress(address)	Read by frontend to boost ML risk
getProposal(uint256)	Community confidence read
_updateVoterAccuracy(uint256, bool)	Rewards accurate voters → better curation
4. Gas Timing Advisor
Files:

wallet_analytics.go — GetWalletAnalytics(), gas metrics in feature map
analytics.go — GetWalletRiskScore(), GetBulkWalletAnalytics()
routes.go
Send.tsx — provider.getFeeData(), provider.estimateGas(), 20% gas buffer
utils.ts — calculateGasFee(gasLimit, gasPrice)
mev-protection.ts — MEVProtection class, gas price normalization
WalletAnalytics.tsx
API Endpoints:

Method	Route
GET	/api/analytics/wallet/:address
GET	/api/analytics/risk/:address
POST	/api/analytics/bulk
POST	/api/analytics/export
Smart Contract Functions:

Function	Source
(No dedicated contract — gas estimation uses provider.estimateGas() and provider.getFeeData() RPC calls client-side)	ethers.js
