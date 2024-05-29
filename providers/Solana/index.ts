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
    LAMPORTS_PER_SOL,
    ComputeBudgetProgram,
    AddressLookupTableAccount,
    TransactionMessage,
    sendAndConfirmRawTransaction,
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

    async signMessage(args: { message: string; wallet: AnyProviderWallet }): Promise<{ success: boolean; error?: string; signature: string }> {
        const { message } = args
        const wallet: Keypair = args.wallet as Keypair

        const encodedMessage = new TextEncoder().encode(message)
        // Because we save it as a string, we need to convert it back to a Uint8Array
        // @ts-ignore
        const signature = await nacl.sign.detached(encodedMessage, new Uint8Array(Object.values(wallet._keypair.secretKey)))

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

    async generateTransaction(recipientAddress: string, senderAddress: string, amount: number): Promise<any> {
        try {
            const recipientPublicKey = new PublicKey(recipientAddress)
            const senderPublicKey = new PublicKey(senderAddress)

            const { blockhash } = await this._connection.getLatestBlockhash()

            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: senderPublicKey,
                    toPubkey: recipientPublicKey,
                    lamports: amount * LAMPORTS_PER_SOL,
                })
            )

            console.log('BLOCKHASH IS ' + blockhash)

            transaction.recentBlockhash = blockhash
            transaction.feePayer = senderPublicKey

            const serializedTransaction = transaction.serialize({ requireAllSignatures: false }).toString('base64')

            console.log('[solana:generateTransaction] serializedTransaction ', serializedTransaction)

            return {
                success: true,
                data: serializedTransaction,
            }
        } catch (error) {
            console.error('[solana:generateTransaction] error: ', error)
            return {
                success: false,
                error: (error as Error).message,
            }
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

    async sign(parameters: IWalletProviderCallParameters, base?: Keypair): Promise<any> {
        console.log('[solana:sign]')

        try {
            const connection = this._connection
            const wallet = parameters.wallet as Keypair

            if (!parameters.data) {
                throw new Error('No data provided in parameters')
            }
            const transactionBuf = Buffer.from(parameters.data, 'base64')
            let transaction = VersionedTransaction.deserialize(transactionBuf)

            if (base) {
                const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
                    microLamports: 20000,
                })

                const addressLookupTableAccounts = await Promise.all(
                    transaction.message.addressTableLookups.map(async (lookup) => {
                        return new AddressLookupTableAccount({
                            key: lookup.accountKey,
                            state: AddressLookupTableAccount.deserialize(await connection.getAccountInfo(lookup.accountKey).then((res) => res!.data)),
                        })
                    })
                )

                let message = TransactionMessage.decompile(transaction.message, { addressLookupTableAccounts: addressLookupTableAccounts })
                message.instructions.push(addPriorityFee)

                transaction.message = message.compileToV0Message(addressLookupTableAccounts)
                transaction.sign([wallet, base])
            } else {
                transaction.sign([wallet])
            }

            const signedTransactionBuf = transaction.serialize()
            const base64String = Buffer.from(signedTransactionBuf).toString('base64')

            return {
                success: true,
                signedTransaction: base64String,
            }
        } catch (e) {
            console.error('[solana:sign] error', e)
            return {
                success: false,
                error: (e as Error).message,
            }
        }
    }

    async simulate(parameters: IWalletProviderCallParameters): Promise<any> {
        console.log('[solana:simulate]')

        try {
            const connection = this._connection

            if (!parameters.data) {
                throw new Error('No data provided in parameters')
            }

            const swapTransactionBuf = Buffer.from(parameters.data, 'base64')
            let transaction: VersionedTransaction

            try {
                transaction = VersionedTransaction.deserialize(swapTransactionBuf)
            } catch (deserializationError) {
                console.error('[solana:simulate] Transaction deserialization error', deserializationError)
                return {
                    success: false,
                    error: 'Transaction deserialization failed',
                }
            }

            const simulationResult = await connection.simulateTransaction(transaction, {
                replaceRecentBlockhash: true,
            })

            if (!simulationResult || simulationResult.value.err) {
                console.log('[solana:simulate] Simulation error', simulationResult, simulationResult?.value?.err)
                return {
                    success: false,
                    error: simulationResult.value.err ? JSON.stringify(simulationResult.value.err) : 'Unknown simulation error',
                }
            }

            return {
                success: true,
            }
        } catch (e) {
            console.error('[solana:simulate] error', e)
            return {
                success: false,
                error: (e as Error).message,
            }
        }
    }

    async sendTransaction(parameters: IWalletProviderCallParameters): Promise<WalletResponse<string>> {
        try {
            const connection = this._connection

            const tx = Buffer.from(parameters.data!, 'base64')

            let iteration = 0
            let isSuccessful = false
            let transactionResponse: VersionedTransactionResponse | null = null

            while (iteration < 5) {
                iteration++
                console.log('[solana:sendTransaction] sending transaction: ', iteration)
                transactionResponse = await transactionSender({
                    connection,
                    tx: tx,
                })

                console.log('[solana:sendTransaction] transactionResponse ', transactionResponse)
                if (transactionResponse && transactionResponse?.meta?.err == null) {
                    console.log('[solana:sendTransaction] transaction confirmed!')
                    isSuccessful = true

                    return {
                        success: true,
                        response: transactionResponse
                    }
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
                    privateKey: privateKey,
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
