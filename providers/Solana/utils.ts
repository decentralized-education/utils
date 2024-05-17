import {
    BlockhashWithExpiryBlockHeight,
    Connection,
    Keypair,
    PublicKey,
    TransactionExpiredBlockheightExceededError,
    VersionedTransactionResponse,
} from '@solana/web3.js'
import promiseRetry from 'promise-retry'
import * as bip39 from 'bip39'

const wait = (time: number) => new Promise((resolve) => setTimeout(resolve, time))
type TransactionSenderArgs = {
    connection: Connection
    txBuffer: Buffer
}
type TransactionConfirmationWaiterArgs = {
    connection: Connection
    txHash: string
    blockhashWithExpiryBlockHeight: BlockhashWithExpiryBlockHeight
}

const SEND_OPTIONS = {
    skipPreflight: true,
}

export async function transactionSender({ connection, txBuffer }: TransactionSenderArgs): Promise<VersionedTransactionResponse | null> {
    console.log('transactionSenderAndConfirmationWaiter sending')

    const txid = await connection.sendRawTransaction(txBuffer, SEND_OPTIONS)

    console.log('[transactionSender] txId ', txid)

    const controller = new AbortController()
    const abortSignal = controller.signal

    const abortableResender = async () => {
        let i = 0
        while (i < 10) {
            console.log('waiting')
            await wait(2_000)
            if (abortSignal.aborted) return
            try {
                console.log('waiting... sendRawTransaction ', txBuffer, SEND_OPTIONS)
                await connection.sendRawTransaction(txBuffer, SEND_OPTIONS)
                console.log('tx sent...')
                return
            } catch (e) {
                console.warn(`Failed to resend transaction: ${e}`)
            }
            i++
        }
        if (i >= 15) {
            throw new Error('Transaction resend limit exceeded')
        }
    }

    try {
        await abortableResender()
    } catch (e) {
        console.log('solana error ', e)
        if (e instanceof TransactionExpiredBlockheightExceededError) {
            // we consume this error and getTransaction would return null
        } else {
            // invalid state from web3.js
        }

        try {
            const response = await connection.getTransaction(txid, {
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
            retries: 5,
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
