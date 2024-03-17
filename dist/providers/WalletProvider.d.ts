import { TonClient, WalletContractV4 } from "@ton/ton";
import { ethers } from "ethers";
export interface IWallet {
    address: string;
    mnemonic?: string;
    mnemonicPath?: string;
    privateKey?: string;
    providerWallet?: ethers.Wallet | WalletContractV4;
}
export type BaseResponse = {
    success: boolean;
    error?: string;
};
export type WalletResponse<T> = BaseResponse & {
    success: boolean;
    wallet?: T;
};
export type SendTransactionResponse<T> = {
    success: boolean;
    error?: string;
    hash?: string;
    result?: T;
};
export declare enum ExecutionStatus {
    PENDING = "pending",
    SUCCESS = "success",
    FAILED = "failed",
    CANCELLED = "cancelled",
    PROCESSING = "processing"
}
export type AnyProviderWallet = ethers.Wallet | WalletContractV4;
export interface IWalletProviderCallParameters {
    to?: string;
    data?: string;
    value?: string;
    gasLimit?: string | number;
    gasPrice?: string | number;
    wallet?: AnyProviderWallet;
}
export interface IWaitForTransactionParameters {
    hash: string;
    confirmations?: number;
    timeout?: number;
}
export interface IGetTransactionResult {
    success: boolean;
    tx?: any;
    error?: string;
    txStatus?: ExecutionStatus;
    txConfirmations?: number;
}
export interface IWalletProvider {
    sendTransaction(parameters: IWalletProviderCallParameters): Promise<SendTransactionResponse<any>>;
    simulate(parameters: IWalletProviderCallParameters): Promise<SendTransactionResponse<any>>;
    getRpcProvider({ chainId }: {
        chainId: number;
    }): ethers.providers.JsonRpcProvider | TonClient;
    createWalletFromPrivateKey(privateKey: string): Promise<WalletResponse<IWallet>>;
    createWalletFromMnemonic(mnemonic: string, path?: string): Promise<WalletResponse<IWallet>>;
    createWallet(): Promise<WalletResponse<IWallet>>;
    createWalletFromDatabase(wallet: IWallet): Promise<WalletResponse<IWallet>>;
    waitForTransaction(parameters: IWaitForTransactionParameters): Promise<{
        success: boolean;
        error?: string;
    }>;
    getTransaction(parameters: {
        hash: string;
    }): Promise<IGetTransactionResult>;
}
