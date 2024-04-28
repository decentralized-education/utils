import {
    Connection,
    Keypair,
    PublicKey,
    sendAndConfirmTransaction,
    SimulatedTransactionResponse,
    SystemProgram,
    Transaction,
    TransactionInstruction,
    BlockhashWithExpiryBlockHeight,
    TransactionExpiredBlockheightExceededError,
    VersionedTransactionResponse,
    VersionedTransaction,
} from '@solana/web3.js'
import {
    AnyProviderWallet,
    ExecutionStatus,
    IGetTransactionResult,
    IWaitForTransactionParameters,
    IWallet,
    IWalletProvider,
    IWalletProviderCallParameters,
    WalletResponse,
} from '../WalletProvider' // Assuming you have your interface file
import promiseRetry from 'promise-retry'
import { transactionConfirmationWaiter, transactionSender } from './utils'
import * as bip39 from 'bip39'
import { derivePath } from 'ed25519-hd-key'
import { decodeUTF8 } from 'tweetnacl-util'
import nacl from 'tweetnacl'

export default class SolanaWalletProvider implements IWalletProvider {
    _connection: Connection // Store the Solana connection

    constructor(rpcEndpoint: string = 'https://greatest-purple-diamond.solana-mainnet.quiknode.pro/6bfdf61addc014ea72e6391db27ec3dc2368e30a/') {
        this._connection = new Connection(rpcEndpoint)
    }

    getRpcProvider({ chainId }: { chainId?: number }) {
        return this._connection
    }

    async signMessage(args: {
        message: string
        wallet: AnyProviderWallet
    }): Promise<{ success: boolean; error?: string; signature: string }> {
        const {message} = args;
        const wallet:Keypair = args.wallet as Keypair;
        
        const encodedMessage = new TextEncoder().encode(message);
        // Because we save it as a string, we need to convert it back to a Uint8Array
        // @ts-ignore
        const signature = await nacl.sign.detached(encodedMessage,   new Uint8Array( Object.values(wallet._keypair.secretKey)));

        // const result = nacl.sign.detached.verify(
        //     messageBytes,
        //     signature,
        //     publicKey
        // );
        // console.log("result ",result)

        return {
            success: true,
            // @ts-ignore
            signature: signature.toString('hex'),
        }
    }

    async getTransaction(args: { hash: string }): Promise<IGetTransactionResult> {
        try {
            console.log('[solana:getTransaction] ', args)
            const { hash } = args

            const transaction = await this._connection.getTransaction(hash, {
                commitment: 'confirmed',
            })

            if (transaction) {
                console.log('[solana:getTransaction] transaction ', transaction)
                return {
                    success: true,
                    txStatus: transaction?.meta?.err ? ExecutionStatus.FAILED : ExecutionStatus.SUCCESS,
                }
            }
        } catch (e) {
            console.error('[solana:getTransaction] error ', e)
            return {
                success: false,
                error: (e as Error).message,
            }
        }
        return {
            success: false,
        }
    }

    async waitForTransaction(parameters: IWaitForTransactionParameters) {
        try {
            console.log('[solana:waitForTransaction] ', parameters)
            const { timeout = 60000, confirmations = 1, hash } = parameters

            const connection = this._connection
            let iteration = 0
            let isSuccessful = false
            const blochHash = await connection.getRecentBlockhash('confirmed')
            const lastBlock = await connection.getLatestBlockhash('confirmed')
            let transactionResponse: VersionedTransactionResponse | null = null

            while (iteration < 10) {
                iteration++
                console.log('[solana:waitForTransaction] sending transaction: ', iteration)
                transactionResponse = await transactionConfirmationWaiter({
                    txHash: parameters.hash,
                    connection,
                    blockhashWithExpiryBlockHeight: {
                        blockhash: blochHash.blockhash,
                        lastValidBlockHeight: lastBlock.lastValidBlockHeight,
                    },
                })

                console.log('[solana:waitForTransaction] ', transactionResponse)
                if (transactionResponse && transactionResponse?.meta?.err == null) {
                    console.log('[solana:waitForTransaction] transaction confirmed!')
                    isSuccessful = true
                    break
                } else {
                    console.error(`[solana:waitForTransaction] error transaction failed #${iteration}`)
                }
            }

            if ((isSuccessful == false && transactionResponse == null) || transactionResponse?.meta?.err != null) {
                console.error(`[solana:waitForTransaction] error transaction failed completely, restarting #${iteration}`)
                return {
                    success: false,
                    error: 'Transaction failed',
                }
            }

            if (isSuccessful == true) {
                return {
                    success: true,
                }
            }
        } catch (e) {
            console.error('[solana:waitForTransaction] error ', e)
            return {
                success: false,
                error: (e as Error).message,
            }
        }
        return {
            success: false,
        }
    }

    async simulate(parameters: IWalletProviderCallParameters) {
        console.log('[solana:simulate]')
        try {
            const connection = this._connection

            const swapTransactionBuf = Buffer.from(parameters.data!, 'base64')
            var transaction = VersionedTransaction.deserialize(swapTransactionBuf)

            const simulationResult = await connection.simulateTransaction(transaction, {
                replaceRecentBlockhash: true,
            })
            if (!simulationResult || simulationResult?.value?.err) {
                console.log('[solana:simulate] error', simulationResult?.value?.err)
                return {
                    success: false,
                }
            }
        } catch (e) {
            console.error('[solana:simulate] error', e)
            return {
                success: false,
                error: (e as Error).message,
            }
        }
        return {
            success: true,
        }
    }

    async sendTransaction(parameters: IWalletProviderCallParameters): Promise<WalletResponse<string>> {
        try {
            const connection = this._connection

            const serializedTransaction = Buffer.from(parameters.data!, 'base64')

            const transaction = VersionedTransaction.deserialize(serializedTransaction)

            //@ts-ignore
            transaction.sign([parameters.wallet!])

            const signedTransaction = transaction.serialize()

            let iteration = 0
            let isSuccessful = false
            let transactionResponse: VersionedTransactionResponse | null = null

            while (iteration < 30) {
                iteration++
                console.log('[solana:sendTransaction] sending transaction: ', iteration)
                transactionResponse = await transactionSender({
                    connection,
                    txBuffer: Buffer.from(signedTransaction),
                })

                console.log('[solana:sendTransaction] transactionResponse ', transactionResponse)
                if (transactionResponse && transactionResponse?.meta?.err == null) {
                    console.log('[solana:sendTransaction] transaction confirmed!')
                    isSuccessful = true
                    break
                } else {
                    console.error(`[solana:sendTransaction] error transaction failed #${iteration}`)
                }
            }

            if ((isSuccessful == false && transactionResponse == null) || transactionResponse?.meta?.err != null) {
                console.error(`[solana:sendTransaction] error transaction failed completely, restarting #${iteration}`)
                return {
                    success: false,
                    error: 'Transaction failed',
                }
            }
        } catch (e) {
            console.error('[solana:simulate] error', e)
            return {
                success: false,
                error: (e as Error).message,
            }
        }
        return {
            success: false,
        }
    }

    async createWalletFromPrivateKey(privateKey: string): Promise<WalletResponse<IWallet>> {
        try {
            const keypair = Keypair.fromSecretKey(Uint8Array.from(Buffer.from(privateKey, 'hex')))

            return {
                success: true,
                wallet: {
                    address: keypair.publicKey.toString(),
                    privateKey: privateKey, // Store the private key securely
                    providerWallet: keypair, // The actual Solana Keypair object
                },
            }
        } catch (e) {
            return {
                success: false,
                error: (e as Error).message,
            }
        }
    }
    async createWallet(): Promise<WalletResponse<IWallet>> {
        try {
            const keypair = Keypair.generate()

            return {
                success: true,
                wallet: {
                    address: keypair.publicKey.toString(),
                    privateKey: Buffer.from(keypair.secretKey).toString('hex'),
                    providerWallet: keypair,
                },
            }
        } catch (e) {
            return {
                success: false,
                error: (e as Error).message,
            }
        }
    }

    async createWalletFromMnemonic(mnemonic: string, path: string = "m/44'/501'/0'/0'"): Promise<WalletResponse<IWallet>> {
        try {
            const seed = await bip39.mnemonicToSeed(mnemonic)
            const derivedSeed = derivePath(path, seed.toString('hex')).key
            const keypair = Keypair.fromSeed(derivedSeed)

            return {
                success: true,
                wallet: {
                    address: keypair.publicKey.toString(),
                    mnemonic: mnemonic,
                    mnemonicPath: path,
                    providerWallet: keypair,
                },
            }
        } catch (e) {
            return {
                success: false,
                error: (e as Error).message,
            }
        }
    }

    async createWalletFromDatabase(wallet: IWallet): Promise<WalletResponse<IWallet>> {
        if (!wallet) {
            return {
                success: false,
                error: 'No wallet',
            }
        }
        if (wallet.privateKey) {
            return this.createWalletFromPrivateKey(wallet.privateKey)
        } else if (wallet.mnemonic) {
            return this.createWalletFromMnemonic(wallet.mnemonic, wallet.mnemonicPath)
        }
        return {
            success: false,
            error: 'No private key or mnemonic',
        }
    }
}
