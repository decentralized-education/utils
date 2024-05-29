import {
    BlockhashWithExpiryBlockHeight,
    Connection,
    Keypair,
    PublicKey,
    TransactionExpiredBlockheightExceededError,
    VersionedTransaction,
    VersionedTransactionResponse,
} from '@solana/web3.js'
import promiseRetry from 'promise-retry'
import * as bip39 from 'bip39'
import { skip } from 'node:test'
import { max } from 'moment'

const wait = (time: number) => new Promise((resolve) => setTimeout(resolve, time))
type TransactionSenderArgs = {
    connection: Connection
    tx: Buffer
}
type TransactionConfirmationWaiterArgs = {
    connection: Connection
    txHash: string
    blockhashWithExpiryBlockHeight: BlockhashWithExpiryBlockHeight
}

const SEND_OPTIONS = {
    skipPreflight: true,
    maxRetries: 2,
}

const MAX_RETRIES = 5
const RETRY_DELAY = 1500

export async function transactionSender({ connection, tx }: TransactionSenderArgs): Promise<VersionedTransactionResponse | null> {
    console.log('[solana:sendTransaction] transactionSender')

    let tryAgain = true
    let maxTriesCounter = 0
    let objSignatureStatusResult: any = null
    let txid: string | undefined

    while (tryAgain) {
        try {
            maxTriesCounter++
            txid = await connection.sendRawTransaction(tx, SEND_OPTIONS)
              console.log(`https://solscan.io/tx/${txid}`)

            await new Promise((r) => setTimeout(r, RETRY_DELAY))

            const result = await connection.getSignatureStatus(txid, {
                searchTransactionHistory: true,
            })

            objSignatureStatusResult = JSON.parse(JSON.stringify(result))
            if (objSignatureStatusResult.value !== null) tryAgain = false
            if (maxTriesCounter > MAX_RETRIES) tryAgain = false
        } catch (e) {
            console.log('solana error ', e)
            if (e instanceof TransactionExpiredBlockheightExceededError) {
                console.log('TransactionExpiredBlockheightExceededError')
            } else {
                console.log('solana error ', e)
            }
        }
    }

    if (txid && objSignatureStatusResult && objSignatureStatusResult.value) {
        try {
            const response = await connection.getTransaction(txid, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
            })

            return response as VersionedTransactionResponse
        } catch (e) {
            console.log('solana error when getting transaction', e)
            throw e
        }
    }

    return null
}

export async function transactionConfirmationWaiter({
    connection,
    txHash,
    blockhashWithExpiryBlockHeight,
}: TransactionConfirmationWaiterArgs): Promise<VersionedTransactionResponse | null> {
    console.log('transactionSenderAndConfirmationWaiter sending')

    const controller = new AbortController()
    const abortSignal = controller.signal

    try {
        const lastValidBlockHeight = blockhashWithExpiryBlockHeight.lastValidBlockHeight - 150

        // this would throw TransactionExpiredBlockheightExceededError
        await Promise.race([
            connection.confirmTransaction(
                {
                    ...blockhashWithExpiryBlockHeight,
                    lastValidBlockHeight,
                    signature: txHash,
                    abortSignal,
                },
                'confirmed'
            ),
            new Promise(async (resolve) => {
                // in case ws socket died
                while (!abortSignal.aborted) {
                    console.log('waiting for confirmation...')
                    await wait(2_000)
                    console.log('checking signature status...')
                    const tx = await connection.getSignatureStatus(txHash, {
                        searchTransactionHistory: false,
                    })
                    if (tx?.value?.confirmationStatus === 'confirmed') {
                        resolve(tx)
                    }
                }
            }),
        ])
    } catch (e) {
        if (e instanceof TransactionExpiredBlockheightExceededError) {
            // we consume this error and getTransaction would return null
            // return null
        } else {
            // invalid state from web3.js
            // throw e
        }

        try {
            const response = await connection.getTransaction(txHash, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
            })
            if (response) {
                return response
            }
        } catch (error) {
            console.log('solana retry error ', error)
        }
    } finally {
        controller.abort()
    }

    // in case rpc is not synced yet, we add some retries
    const response = promiseRetry(
        async (retry: any) => {
            console.log('promise retry...')
            const response = await connection.getTransaction(txHash, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
            })
            if (!response) {
                retry(response)
            }
            return response
        },
        {
            retries: 6,
            minTimeout: 1e3,
        }
    )

    return response
}

export const generateMnemonic = (): string => {
    return bip39.generateMnemonic(128)
}

export const generateBaseKeypair = () => {
    return Keypair.generate()
}

export const isValidSolanaAddress = (address: string): boolean => {
    try {
        const publicKey = new PublicKey(address)
        return publicKey.toBase58() === address
    } catch (error) {
        return false
    }
}

//TEMP UNTIL WE HAVE A SOLANA PROVIDER
export async function getSolanaBalance(walletPublicKey: string): Promise<number | null> {
    try {
        const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=91341763-781d-4e73-99cb-d8a4591e8150')
        const publicKey = new PublicKey(walletPublicKey)
        const value = await connection.getBalance(publicKey)
        const solBalance = value / 10 ** 9

        return solBalance
    } catch (error) {
        console.error('Error fetching SOL balance:', error)
        return null
    }
}
