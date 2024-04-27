import { AnyProviderWallet, IGetTransactionResult, IWallet, IWalletProvider, IWalletProviderCallParameters, SendTransactionResponse, WalletResponse } from './WalletProvider';
import { TonClient } from '@ton/ton';
import 'cross-fetch/polyfill';
export default class TonWalletProvider implements IWalletProvider {
    signMessage(args: {
        message: string;
        wallet: AnyProviderWallet;
    }): Promise<{
        success: boolean;
        error?: string | undefined;
        signature: string;
    }>;
    getTransaction(parameters: {
        hash: string;
    }): Promise<IGetTransactionResult>;
    waitForTransaction(parameters: {
        hash: string;
    }): Promise<{
        success: boolean;
    }>;
    createWalletFromDatabase(wallet: IWallet): Promise<WalletResponse<IWallet>>;
    simulate(parameters: IWalletProviderCallParameters): Promise<{
        success: boolean;
        error: string;
    }>;
    sendTransaction(parameters: IWalletProviderCallParameters): Promise<SendTransactionResponse<any>>;
    getRpcProvider({ chainId }: {
        chainId?: number;
    }): TonClient;
    test(): Promise<void>;
    createWalletFromPrivateKey(privateKey: string): Promise<WalletResponse<IWallet>>;
    createWalletFromMnemonic(mnemonic: string, path?: string): Promise<WalletResponse<IWallet>>;
    createWallet(): Promise<WalletResponse<IWallet>>;
}
