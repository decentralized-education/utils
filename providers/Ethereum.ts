import { ethers } from "ethers";
import {
  ExecutionStatus,
  IGetTransactionResult,
  IWaitForTransactionParameters,
  IWallet,
  IWalletProvider,
  IWalletProviderCallParameters,
  WalletResponse,
} from "./WalletProvider";

export default class EthereumWalletProvider implements IWalletProvider {
  _chainId: number | null = null;
  constructor(chainId?: number) {
    if (chainId) {
      this._chainId = chainId;
    }
  }
  async getTransaction(args: { hash: string }): Promise<IGetTransactionResult> {
    try {
      console.log("[ethereum:getTransaction] ", args);
      const { hash } = args;
      const provider = this.getRpcProvider({});
      const transaction = await provider.getTransactionReceipt(hash);

      if (transaction) {
        console.log("[ethereum:getTransaction] transaction ", transaction);
        if (transaction.status == 1) {
          return {
            success: true,
            txConfirmations: transaction.confirmations,
            tx: transaction,
            txStatus:
              transaction.confirmations > 1
                ? ExecutionStatus.SUCCESS
                : ExecutionStatus.PENDING,
          };
        } else {
          return {
            success: true,
            tx: transaction,
            txConfirmations: transaction.confirmations,
            txStatus: ExecutionStatus.FAILED,
          };
        }
      }
    } catch (e) {
      console.error("[ethereum:getTransaction] error ", e);
      return {
        success: false,
        error: (e as Error).message,
      };
    }
    return {
      success: false,
    };
  }
  async waitForTransaction(parameters: IWaitForTransactionParameters) {
    try {
      console.log("[ethereum:waitForTransaction] ", parameters);
      const { timeout = 60000, confirmations = 3, hash } = parameters;

      const provider = this.getRpcProvider({});
      const awaitResult = await provider.waitForTransaction(
        parameters.hash,
        timeout,
        confirmations
      );
      if (awaitResult.status == 1) {
        console.log("[ethereum:waitForTransaction] successful");
        // All good
        return {
          success: true,
        };
      } else if (awaitResult.status == 0) {
        console.error("[ethereum:waitForTransaction] tx failed");
        return {
          success: false,
          error: "Transaction failed",
        };
      } else {
        console.error(
          "[ethereum:waitForTransaction] tx failed with unknown status"
        );
        return {
          success: false,
          error: "Transaction failed wit status " + awaitResult.status,
        };
      }
    } catch (e) {
      console.error("[ethereum:waitForTransaction] error ", e);
      return {
        success: false,
        error: (e as Error).message,
      };
    }
  }
  async createWalletFromDatabase(
    wallet: IWallet
  ): Promise<WalletResponse<IWallet>> {
    if (!wallet) {
      return {
        success: false,
        error: "No wallet",
      };
    }
    if (wallet.privateKey) {
      return this.createWalletFromPrivateKey(wallet.privateKey);
    } else if (wallet.mnemonic) {
      return this.createWalletFromMnemonic(
        wallet.mnemonic,
        wallet.mnemonicPath
      );
    }
    return {
      success: false,
      error: "No private key or mnemonic",
    };
  }
  async simulate(parameters: IWalletProviderCallParameters) {
    console.log("[ethereum:simulate]");
    try {
      const transactionData = {
        to: parameters.to,
        data: parameters.data,
        gasLimit: parameters.gasLimit,
        gasPrice: parameters.gasPrice,
      };

      const result = await (parameters.wallet as ethers.Wallet).call(
        transactionData
      );
      return {
        success: true,
        result,
      };
    } catch (e) {
      console.error("[ethereum:simulate] error ", e);
      return {
        success: true,
        error: (e as Error).message,
      };
    }
  }
  async sendTransaction(parameters: IWalletProviderCallParameters) {
    console.log("[ethereum:sendTransaction] parameters ", parameters);
    try {
      if (!parameters.wallet) {
        return {
          success: false,
          error: "No wallet",
        };
      }

      const transactionData = {
        to: parameters.to,
        data: parameters.data,
        gasLimit: parameters.gasLimit,
        gasPrice: parameters.gasPrice,
      };

      const result = await (parameters.wallet as ethers.Wallet).sendTransaction(
        transactionData
      );
      return {
        success: true,
        hash: result.hash,
        result,
      };
    } catch (e) {
      console.error("[ethereum:sendTransaction] error ", e);
      return {
        success: false,
        error: (e as Error).message,
      };
    }
  }
  getRpcProvider({ chainId }: { chainId?: number }) {
    const rpcUrl = this.getRpcUrl({ chainId: chainId! || this._chainId! });
    return new ethers.providers.JsonRpcProvider(rpcUrl);
  }
  getRpcUrl({ chainId }: { chainId?: number }) {
    if (chainId == 56) {
      return "https://bsc-dataseed1.binance.org";
    }
    if (chainId == 84531) {
      return "https://mainnet.era.zksync.io";
    }
    if (chainId == 137) {
      // return "https://polygon.llamarpc.com"
      return "https://polygon-rpc.com";
    }
    if (chainId == 42161) {
      // return "https://arbitrum.llamarpc.com";
      return "https://arbitrum-one-rpc.publicnode.com"
    }
    if (chainId == 1) {
      return "https://eth.llamarpc.com";
    }
    if (chainId == 10) {
      return "https://optimism.llamarpc.com";
    }
    if (chainId == 43114) {
      return "https://rpc.ankr.com/avalanche";
    }
    return undefined;
  }
  async createWalletFromPrivateKey(
    privateKey: string
  ): Promise<WalletResponse<IWallet>> {
    try {
      const provider = this.getRpcProvider({});
      console.log("[etherem:createWallet] privateKey ", privateKey.length);
      const ethersWallet = new ethers.Wallet(privateKey, provider);
      console.log(
        "[etherem:createWallet] address with private key",
        ethersWallet?.address
      );

      return {
        success: true,
        wallet: {
          address: ethersWallet.address,
          privateKey: privateKey,
          mnemonic: ethersWallet?.mnemonic?.phrase,
          mnemonicPath: ethersWallet?.mnemonic?.path,
          providerWallet: ethersWallet,
        },
      };
    } catch (e) {
      return {
        success: false,
        error: (e as Error).message,
      };
    }
  }

  async createWalletFromMnemonic(
    mnemonic: string,
    path: string = "m/44'/60'/0'/0/0"
  ): Promise<WalletResponse<IWallet>> {
    try {
      console.log("[etherem:createWallet] mnemonic ");
      const ethersWallet = ethers.Wallet.fromMnemonic(mnemonic);
      console.log(
        "[etherem:createWallet] address with mnemonic ",
        ethersWallet?.address
      );

      return {
        success: true,
        wallet: {
          address: ethersWallet.address,
          privateKey: ethersWallet.privateKey,
          mnemonic: mnemonic,
          mnemonicPath: ethersWallet.mnemonic.path,
          providerWallet: ethersWallet,
        },
      };
    } catch (e) {
      return {
        success: false,
        error: (e as Error).message,
      };
    }
  }

  async createWallet(): Promise<WalletResponse<IWallet>> {
    try {
      console.log(
        "[etherem:createWallet] no private key or mnemonic, creating a new wallet"
      );
      const ethersWallet = ethers.Wallet.createRandom();

      return {
        success: true,
        wallet: {
          address: ethersWallet.address,
          privateKey: ethersWallet.privateKey,
          mnemonic: ethersWallet.mnemonic.phrase,
          mnemonicPath: ethersWallet.mnemonic.path,
          providerWallet: ethersWallet,
        },
      };
    } catch (e) {
      return {
        success: false,
        error: (e as Error).message,
      };
    }
  }
}
