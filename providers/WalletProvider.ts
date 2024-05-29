import { Connection, Keypair, VersionedTransactionResponse } from "@solana/web3.js";
import { KeyPair } from "@ton/crypto";
import { TonClient, TonClient4, WalletContractV4 } from "@ton/ton";
import { ethers } from "ethers";


export interface IWallet {
    address: string;
    mnemonic?: string;
    mnemonicPath?: string;
    privateKey?: string;
    providerWallet?: ethers.Wallet | WalletContractV4 | Keypair
}

export type BaseResponse = {
    success: boolean;
    error?: string;
};

export type WalletResponse<T> = BaseResponse & {
    success: boolean;
    wallet?: T;
    response?: VersionedTransactionResponse;
};
export type SendTransactionResponse<T> = {
    success: boolean;
    error?: string;
    hash?: string;
    result?: T;
};

export enum ExecutionStatus {
  PENDING = "pending",
  SUCCESS = "success",
  FAILED = "failed",
  CANCELLED = "cancelled",
  PROCESSING = "processing",
}

// Multi provider wallet
export type AnyProviderWallet = ethers.Wallet | WalletContractV4 | Keypair;

export interface IWalletProviderCallParameters{
    to?: string;
    data?: string;
    value?: string;
    gasLimit?: string | number;
    gasPrice?: string | number;
    wallet?: AnyProviderWallet;
}

export interface IWaitForTransactionParameters{
    hash: string;
    confirmations?: number;
    timeout?: number;
}

export interface IGetTransactionResult{
    success: boolean;
    tx?: any;
    error?: string;
    txStatus?: ExecutionStatus;
    txConfirmations?: number;
}

export interface IWalletProvider {
    sendTransaction(parameters:IWalletProviderCallParameters): Promise<SendTransactionResponse<any>>; // TODO: Type?
    simulate(parameters: IWalletProviderCallParameters) : Promise<SendTransactionResponse<any>>;
    getRpcProvider({chainId}:{chainId:number}): ethers.providers.JsonRpcProvider | TonClient | Connection;
    createWalletFromPrivateKey(privateKey: string): Promise<WalletResponse<IWallet>>;
    createWalletFromMnemonic(mnemonic: string, path?: string): Promise<WalletResponse<IWallet>>;
    createWallet(): Promise<WalletResponse<IWallet>>;
    createWalletFromDatabase(wallet: IWallet): Promise<WalletResponse<IWallet>>;
    waitForTransaction(parameters:IWaitForTransactionParameters):Promise<{success: boolean, error?: string}>;
    getTransaction(parameters:{hash: string}): Promise<IGetTransactionResult>
    signMessage(args:{message:string, wallet: AnyProviderWallet }):Promise<{success:boolean, error?: string, signature: string}>;
}

