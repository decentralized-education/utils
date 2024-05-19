"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSolanaBalance = exports.isValidSolanaAddress = exports.generateBaseKeypair = exports.generateMnemonic = exports.transactionConfirmationWaiter = exports.transactionSender = void 0;
const web3_js_1 = require("@solana/web3.js");
const promise_retry_1 = __importDefault(require("promise-retry"));
const bip39_1 = __importDefault(require("bip39"));
const wait = (time) => new Promise((resolve) => setTimeout(resolve, time));
const SEND_OPTIONS = {
    skipPreflight: true,
    maxRetries: 2,
};
const MAX_RETRIES = 5;
const RETRY_DELAY = 1500;
async function transactionSender({ connection, txBuffer }) {
    console.log('[solana:sendTransaction] transactionSender');
    let tryAgain = true;
    let maxTriesCounter = 0;
    let objSignatureStatusResult = null;
    let txid;
    while (tryAgain) {
        try {
            maxTriesCounter++;
            txid = await connection.sendRawTransaction(txBuffer, SEND_OPTIONS);
            await new Promise((r) => setTimeout(r, RETRY_DELAY));
            const result = await connection.getSignatureStatus(txid, {
                searchTransactionHistory: true,
            });
            objSignatureStatusResult = JSON.parse(JSON.stringify(result));
            if (objSignatureStatusResult.value !== null)
                tryAgain = false;
            if (maxTriesCounter > MAX_RETRIES)
                tryAgain = false;
        }
        catch (e) {
            console.log('solana error ', e);
            if (e instanceof web3_js_1.TransactionExpiredBlockheightExceededError) {
                console.log('TransactionExpiredBlockheightExceededError');
            }
            else {
                console.log('solana error ', e);
            }
        }
    }
    if (txid && objSignatureStatusResult && objSignatureStatusResult.value) {
        try {
            const response = await connection.getTransaction(txid, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
            });
            return response;
        }
        catch (e) {
            console.log('solana error when getting transaction', e);
            throw e;
        }
    }
    return null;
}
exports.transactionSender = transactionSender;
async function transactionConfirmationWaiter({ connection, txHash, blockhashWithExpiryBlockHeight, }) {
    console.log('transactionSenderAndConfirmationWaiter sending');
    const controller = new AbortController();
    const abortSignal = controller.signal;
    try {
        const lastValidBlockHeight = blockhashWithExpiryBlockHeight.lastValidBlockHeight - 150;
        // this would throw TransactionExpiredBlockheightExceededError
        await Promise.race([
            connection.confirmTransaction({
                ...blockhashWithExpiryBlockHeight,
                lastValidBlockHeight,
                signature: txHash,
                abortSignal,
            }, 'confirmed'),
            new Promise(async (resolve) => {
                // in case ws socket died
                while (!abortSignal.aborted) {
                    console.log('waiting for confirmation...');
                    await wait(2_000);
                    console.log('checking signature status...');
                    const tx = await connection.getSignatureStatus(txHash, {
                        searchTransactionHistory: false,
                    });
                    if (tx?.value?.confirmationStatus === 'confirmed') {
                        resolve(tx);
                    }
                }
            }),
        ]);
    }
    catch (e) {
        if (e instanceof web3_js_1.TransactionExpiredBlockheightExceededError) {
            // we consume this error and getTransaction would return null
            // return null
        }
        else {
            // invalid state from web3.js
            // throw e
        }
        try {
            const response = await connection.getTransaction(txHash, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
            });
            if (response) {
                return response;
            }
        }
        catch (error) {
            console.log('solana retry error ', error);
        }
    }
    finally {
        controller.abort();
    }
    // in case rpc is not synced yet, we add some retries
    const response = (0, promise_retry_1.default)(async (retry) => {
        console.log('promise retry...');
        const response = await connection.getTransaction(txHash, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
        });
        if (!response) {
            retry(response);
        }
        return response;
    }, {
        retries: 5,
        minTimeout: 1e3,
    });
    return response;
}
exports.transactionConfirmationWaiter = transactionConfirmationWaiter;
const generateMnemonic = () => {
    return bip39_1.default.generateMnemonic(128);
};
exports.generateMnemonic = generateMnemonic;
const generateBaseKeypair = () => {
    return web3_js_1.Keypair.generate();
};
exports.generateBaseKeypair = generateBaseKeypair;
const isValidSolanaAddress = (address) => {
    try {
        const publicKey = new web3_js_1.PublicKey(address);
        return publicKey.toBase58() === address;
    }
    catch (error) {
        return false;
    }
};
exports.isValidSolanaAddress = isValidSolanaAddress;
//TEMP UNTIL WE HAVE A SOLANA PROVIDER
async function getSolanaBalance(walletPublicKey) {
    try {
        const connection = new web3_js_1.Connection('https://mainnet.helius-rpc.com/?api-key=91341763-781d-4e73-99cb-d8a4591e8150');
        const publicKey = new web3_js_1.PublicKey(walletPublicKey);
        const value = await connection.getBalance(publicKey);
        const solBalance = value / 10 ** 9;
        return solBalance;
    }
    catch (error) {
        console.error('Error fetching SOL balance:', error);
        return null;
    }
}
exports.getSolanaBalance = getSolanaBalance;
