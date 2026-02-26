/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Civic Auth
  readonly VITE_CIVIC_CLIENT_ID: string;
  readonly VITE_CIVIC_APP_ID: string;
  readonly VITE_CIVIC_SBT_ADDRESS: string;
  readonly VITE_WALLET_VERIFIER_ADDRESS: string;

  // Contract addresses
  readonly VITE_CONTRACT_ADDRESS_MAINNET: string;
  readonly VITE_CONTRACT_ADDRESS_GOERLI: string;
  readonly VITE_CONTRACT_ADDRESS_SEPOLIA: string;
  readonly VITE_CONTRACT_ADDRESS_MONAD: string;
  readonly VITE_SHIELD_TOKEN_ADDRESS: string;

  // API / Backend
  readonly VITE_API_URL: string;

  // WalletConnect
  readonly VITE_WALLET_CONNECT_PROJECT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
