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
Object.defineProperty(exports, "__esModule", { value: true });
const web3_js_1 = require("@solana/web3.js");
const WalletProvider_1 = require("../WalletProvider"); // Assuming you have your interface file
const utils_1 = require("./utils");
const bip39 = __importStar(require("bip39"));
const ed25519_hd_key_1 = require("ed25519-hd-key");
class SolanaWalletProvider {
    _connection; // Store the Solana connection
    constructor(rpcEndpoint = 'https://mainnet.helius-rpc.com/?api-key=91341763-781d-4e73-99cb-d8a4591e8150') {
        this._connection = new web3_js_1.Connection(rpcEndpoint);
    }
    getRpcProvider({ chainId }) {
        return this._connection;
    }
    async getTransaction(args) {
        try {
            console.log('[solana:getTransaction] ', args);
            const { hash } = args;
            const transaction = await this._connection.getTransaction(hash, {
                commitment: 'confirmed',
            });
            if (transaction) {
                console.log('[solana:getTransaction] transaction ', transaction);
                return {
                    success: true,
                    txStatus: transaction?.meta?.err ? WalletProvider_1.ExecutionStatus.FAILED : WalletProvider_1.ExecutionStatus.SUCCESS,
                };
            }
        }
        catch (e) {
            console.error('[solana:getTransaction] error ', e);
            return {
                success: false,
                error: e.message,
            };
        }
        return {
            success: false,
        };
    }
    async waitForTransaction(parameters) {
        try {
            console.log('[solana:waitForTransaction] ', parameters);
            const { timeout = 60000, confirmations = 1, hash } = parameters;
            const connection = this._connection;
            let iteration = 0;
            let isSuccessful = false;
            const blochHash = await connection.getRecentBlockhash('confirmed');
            const lastBlock = await connection.getLatestBlockhash('confirmed');
            let transactionResponse = null;
            while (iteration < 10) {
                iteration++;
                console.log('[solana:waitForTransaction] sending transaction: ', iteration);
                transactionResponse = await (0, utils_1.transactionConfirmationWaiter)({
                    txHash: parameters.hash,
                    connection,
                    blockhashWithExpiryBlockHeight: {
                        blockhash: blochHash.blockhash,
                        lastValidBlockHeight: lastBlock.lastValidBlockHeight,
                    },
                });
                console.log('[solana:waitForTransaction] ', transactionResponse);
                if (transactionResponse && transactionResponse?.meta?.err == null) {
                    console.log('[solana:waitForTransaction] transaction confirmed!');
                    isSuccessful = true;
                    break;
                }
                else {
                    console.error(`[solana:waitForTransaction] error transaction failed #${iteration}`);
                }
            }
            if ((isSuccessful == false && transactionResponse == null) || transactionResponse?.meta?.err != null) {
                console.error(`[solana:waitForTransaction] error transaction failed completely, restarting #${iteration}`);
                return {
                    success: false,
                    error: 'Transaction failed',
                };
            }
            if (isSuccessful == true) {
                return {
                    success: true,
                };
            }
        }
        catch (e) {
            console.error('[solana:waitForTransaction] error ', e);
            return {
                success: false,
                error: e.message,
            };
        }
        return {
            success: false,
        };
    }
    async simulate(parameters) {
        console.log('[solana:simulate]');
        try {
            const connection = this._connection;
            const swapTransactionBuf = Buffer.from(parameters.data, 'base64');
            var transaction = web3_js_1.VersionedTransaction.deserialize(swapTransactionBuf);
            const simulationResult = await connection.simulateTransaction(transaction, {
                replaceRecentBlockhash: true,
            });
            if (!simulationResult || simulationResult?.value?.err) {
                console.log('[solana:simulate] error', simulationResult?.value?.err);
                return {
                    success: false,
                };
            }
        }
        catch (e) {
            console.error('[solana:simulate] error', e);
            return {
                success: false,
                error: e.message,
            };
        }
        return {
            success: true,
        };
    }
    async sendTransaction(parameters) {
        try {
            const connection = this._connection;
            let iteration = 0;
            let isSuccessful = false;
            let transactionResponse = null;
            while (iteration < 10) {
                iteration++;
                console.log('[solana:sendTransaction] sending transaction: ', iteration);
                transactionResponse = await (0, utils_1.transactionSender)({
                    connection,
                    serializedTransaction: parameters.data,
                });
                console.log('[solana:sendTransaction] transactionResponse ', transactionResponse);
                if (transactionResponse && transactionResponse?.meta?.err == null) {
                    console.log('[solana:sendTransaction] transaction confirmed!');
                    isSuccessful = true;
                    break;
                }
                else {
                    console.error(`[solana:sendTransaction] error transaction failed #${iteration}`);
                }
            }
            if ((isSuccessful == false && transactionResponse == null) || transactionResponse?.meta?.err != null) {
                console.error(`[solana:sendTransaction] error transaction failed completely, restarting #${iteration}`);
                return {
                    success: false,
                    error: 'Transaction failed',
                };
            }
        }
        catch (e) {
            console.error('[solana:simulate] error', e);
            return {
                success: false,
                error: e.message,
            };
        }
        return {
            success: false,
        };
    }
    async createWalletFromPrivateKey(privateKey) {
        try {
            const keypair = web3_js_1.Keypair.fromSecretKey(Uint8Array.from(Buffer.from(privateKey, 'hex')));
            return {
                success: true,
                wallet: {
                    address: keypair.publicKey.toString(),
                    privateKey: privateKey, // Store the private key securely
                    providerWallet: keypair, // The actual Solana Keypair object
                },
            };
        }
        catch (e) {
            return {
                success: false,
                error: e.message,
            };
        }
    }
    async createWallet() {
        try {
            const keypair = web3_js_1.Keypair.generate();
            return {
                success: true,
                wallet: {
                    address: keypair.publicKey.toString(),
                    privateKey: Buffer.from(keypair.secretKey).toString('hex'),
                    providerWallet: keypair,
                },
            };
        }
        catch (e) {
            return {
                success: false,
                error: e.message,
            };
        }
    }
    async createWalletFromMnemonic(mnemonic, path = "m/44'/501'/0'/0'") {
        try {
            const seed = await bip39.mnemonicToSeed(mnemonic);
            const derivedSeed = (0, ed25519_hd_key_1.derivePath)(path, seed.toString('hex')).key;
            const keypair = web3_js_1.Keypair.fromSeed(derivedSeed);
            return {
                success: true,
                wallet: {
                    address: keypair.publicKey.toString(),
                    mnemonic: mnemonic,
                    mnemonicPath: path,
                    providerWallet: keypair,
                },
            };
        }
        catch (e) {
            return {
                success: false,
                error: e.message,
            };
        }
    }
    async createWalletFromDatabase(wallet) {
        if (!wallet) {
            return {
                success: false,
                error: 'No wallet',
            };
        }
        if (wallet.privateKey) {
            return this.createWalletFromPrivateKey(wallet.privateKey);
        }
        else if (wallet.mnemonic) {
            return this.createWalletFromMnemonic(wallet.mnemonic, wallet.mnemonicPath);
        }
        return {
            success: false,
            error: 'No private key or mnemonic',
        };
    }
}
exports.default = SolanaWalletProvider;
