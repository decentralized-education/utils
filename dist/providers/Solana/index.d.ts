import { Connection, Keypair } from '@solana/web3.js';
import { AnyProviderWallet, IGetTransactionResult, IWaitForTransactionParameters, IWallet, IWalletProvider, IWalletProviderCallParameters, WalletResponse } from '../WalletProvider';
export default class SolanaWalletProvider implements IWalletProvider {
    _connection: Connection;
    constructor(rpcEndpoint?: string);
    getRpcProvider({ chainId }: {
        chainId?: number;
    }): Connection;
    signMessage(args: {
        message: string;
        wallet: AnyProviderWallet;
    }): Promise<{
        success: boolean;
        error?: string;
        signature: string;
    }>;
    generateTransaction(recipientAddress: string, senderAddress: string, amount: number): Promise<any>;
    getTransaction(args: {
        hash: string;
    }): Promise<IGetTransactionResult>;
    waitForTransaction(parameters: IWaitForTransactionParameters): Promise<{
        success: boolean;
        error: string;
    } | {
        success: boolean;
        error?: undefined;
    }>;
    sign(parameters: IWalletProviderCallParameters, base?: Keypair): Promise<any>;
    simulate(parameters: IWalletProviderCallParameters): Promise<any>;
    sendTransaction(parameters: IWalletProviderCallParameters): Promise<WalletResponse<string>>;
    createWalletFromPrivateKey(privateKey: string): Promise<WalletResponse<IWallet>>;
    createWallet(): Promise<WalletResponse<IWallet>>;
    createWalletFromMnemonic(mnemonic: string, path?: string): Promise<WalletResponse<IWallet>>;
    createWalletFromDatabase(wallet: IWallet): Promise<WalletResponse<IWallet>>;
}
