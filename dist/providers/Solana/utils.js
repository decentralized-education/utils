"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSolanaBalance = exports.generateMnemonic = exports.transactionConfirmationWaiter = exports.transactionSender = exports.wait = void 0;
const web3_js_1 = require("@solana/web3.js");
const promise_retry_1 = __importDefault(require("promise-retry"));
const bip39 = __importStar(require("bip39"));
const wait = (time) => new Promise((resolve) => setTimeout(resolve, time));
exports.wait = wait;
const SEND_OPTIONS = {
    skipPreflight: true,
};
async function transactionSender({ connection, serializedTransaction }) {
    console.log('transactionSenderAndConfirmationWaiter sending');
    const buffer = Buffer.from(serializedTransaction);
    const txid = await connection.sendRawTransaction(buffer, SEND_OPTIONS);
    const controller = new AbortController();
    const abortSignal = controller.signal;
    const abortableResender = async () => {
        while (true) {
            console.log('waiting');
            await (0, exports.wait)(2_000);
            if (abortSignal.aborted)
                return;
            try {
                console.log('waiting... sendRawTransaction');
                await connection.sendRawTransaction(buffer, SEND_OPTIONS);
            }
            catch (e) {
                console.warn(`Failed to resend transaction: ${e}`);
            }
        }
    };
    try {
        abortableResender();
    }
    catch (e) {
        if (e instanceof web3_js_1.TransactionExpiredBlockheightExceededError) {
            // we consume this error and getTransaction would return null
            return null;
        }
        else {
            // invalid state from web3.js
            throw e;
        }
    }
    finally {
        controller.abort();
    }
    // in case rpc is not synced yet, we add some retries
    const response = (0, promise_retry_1.default)(async (retry) => {
        console.log('promise retry...');
        const response = await connection.getTransaction(txid, {
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
                    await (0, exports.wait)(2_000);
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
            return null;
        }
        else {
            // invalid state from web3.js
            throw e;
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
    return bip39.generateMnemonic(128);
};
exports.generateMnemonic = generateMnemonic;
async function getSolanaBalance(walletPublicKey) {
    try {
        const connection = new web3_js_1.Connection('https://api.mainnet-beta.solana.com');
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