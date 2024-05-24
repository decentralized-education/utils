/// <reference types="node" />
import { BlockhashWithExpiryBlockHeight, Connection, Keypair, VersionedTransactionResponse } from '@solana/web3.js';
type TransactionSenderArgs = {
    connection: Connection;
    tx: Buffer;
};
type TransactionConfirmationWaiterArgs = {
    connection: Connection;
    txHash: string;
    blockhashWithExpiryBlockHeight: BlockhashWithExpiryBlockHeight;
};
export declare function transactionSender({ connection, tx }: TransactionSenderArgs): Promise<VersionedTransactionResponse | null>;
export declare function transactionConfirmationWaiter({ connection, txHash, blockhashWithExpiryBlockHeight, }: TransactionConfirmationWaiterArgs): Promise<VersionedTransactionResponse | null>;
export declare const generateMnemonic: () => string;
export declare const generateBaseKeypair: () => Keypair;
export declare const isValidSolanaAddress: (address: string) => boolean;
export declare function getSolanaBalance(walletPublicKey: string): Promise<number | null>;
export {};
