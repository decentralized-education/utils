import {
    BlockhashWithExpiryBlockHeight,
    Connection,
    PublicKey,
    TransactionExpiredBlockheightExceededError,
    VersionedTransactionResponse,
} from '@solana/web3.js'
import promiseRetry from 'promise-retry'
import * as bip39 from 'bip39'

const wait = (time: number) => new Promise((resolve) => setTimeout(resolve, time))
type TransactionSenderArgs = {
    connection: Connection
    serializedTransaction: string
}
type TransactionConfirmationWaiterArgs = {
    connection: Connection
    txHash: string
    blockhashWithExpiryBlockHeight: BlockhashWithExpiryBlockHeight
}

const SEND_OPTIONS = {
    skipPreflight: true,
}

export async function transactionSender({ connection, serializedTransaction }: TransactionSenderArgs): Promise<VersionedTransactionResponse | null> {
    console.log('transactionSenderAndConfirmationWaiter sending')

    const buffer = Buffer.from(serializedTransaction)
    const txid = await connection.sendRawTransaction(buffer, SEND_OPTIONS)

    const controller = new AbortController()
    const abortSignal = controller.signal

    const abortableResender = async () => {
        while (true) {
            console.log('waiting')
            await wait(2_000)
            if (abortSignal.aborted) return
            try {
                console.log('waiting... sendRawTransaction')
                await connection.sendRawTransaction(buffer, SEND_OPTIONS)
            } catch (e) {
                console.warn(`Failed to resend transaction: ${e}`)
            }
        }
    }

    try {
        abortableResender()
    } catch (e) {
        if (e instanceof TransactionExpiredBlockheightExceededError) {
            // we consume this error and getTransaction would return null
            return null
        } else {
            // invalid state from web3.js
            throw e
        }
    } finally {
        controller.abort()
    }

    // in case rpc is not synced yet, we add some retries
    const response = promiseRetry(
        async (retry: any) => {
            console.log('promise retry...')
            const response = await connection.getTransaction(txid, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
            })
            if (!response) {
                retry(response)
            }
            return response
        },
        {
            retries: 5,
            minTimeout: 1e3,
        }
    )

    return response
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
            return null
        } else {
            // invalid state from web3.js
            throw e
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
            retries: 5,
            minTimeout: 1e3,
        }
    )

    return response
}

export const generateMnemonic = (): string => {
    return bip39.generateMnemonic(128)
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
