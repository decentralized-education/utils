import { ethers } from "ethers";
import { IGetTransactionResult, IWaitForTransactionParameters, IWallet, IWalletProvider, IWalletProviderCallParameters, WalletResponse } from "./WalletProvider";
export default class EthereumWalletProvider implements IWalletProvider {
    _chainId: number | null;
    constructor(chainId?: number);
    getTransaction(args: {
        hash: string;
    }): Promise<IGetTransactionResult>;
    waitForTransaction(parameters: IWaitForTransactionParameters): Promise<{
        success: boolean;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
    }>;
    createWalletFromDatabase(wallet: IWallet): Promise<WalletResponse<IWallet>>;
    simulate(parameters: IWalletProviderCallParameters): Promise<{
        success: boolean;
        result: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        result?: undefined;
    }>;
    sendTransaction(parameters: IWalletProviderCallParameters): Promise<{
        success: boolean;
        error: string;
        hash?: undefined;
        result?: undefined;
    } | {
        success: boolean;
        hash: string;
        result: ethers.providers.TransactionResponse;
        error?: undefined;
    }>;
    getRpcProvider({ chainId }: {
        chainId?: number;
    }): ethers.providers.JsonRpcProvider;
    getRpcUrl({ chainId }: {
        chainId?: number;
    }): "https://bsc-dataseed1.binance.org" | "https://mainnet.era.zksync.io" | "https://polygon-rpc.com" | "https://arbitrum-one-rpc.publicnode.com" | "https://eth.llamarpc.com" | "https://optimism.llamarpc.com" | "https://rpc.ankr.com/avalanche" | undefined;
    createWalletFromPrivateKey(privateKey: string): Promise<WalletResponse<IWallet>>;
    createWalletFromMnemonic(mnemonic: string, path?: string): Promise<WalletResponse<IWallet>>;
    createWallet(): Promise<WalletResponse<IWallet>>;
}
