import { BlockhashWithExpiryBlockHeight, Connection, VersionedTransactionResponse } from '@solana/web3.js';
type TransactionSenderArgs = {
    connection: Connection;
    serializedTransaction: string;
};
type TransactionConfirmationWaiterArgs = {
    connection: Connection;
    txHash: string;
    blockhashWithExpiryBlockHeight: BlockhashWithExpiryBlockHeight;
};
export declare function transactionSender({ connection, serializedTransaction }: TransactionSenderArgs): Promise<VersionedTransactionResponse | null>;
export declare function transactionConfirmationWaiter({ connection, txHash, blockhashWithExpiryBlockHeight, }: TransactionConfirmationWaiterArgs): Promise<VersionedTransactionResponse | null>;
export declare const generateMnemonic: () => string;
export declare function getSolanaBalance(walletPublicKey: string): Promise<number | null>;
export {};
