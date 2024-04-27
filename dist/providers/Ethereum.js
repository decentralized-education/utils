"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const WalletProvider_1 = require("./WalletProvider");
class EthereumWalletProvider {
    _chainId = null;
    constructor(chainId) {
        if (chainId) {
            this._chainId = chainId;
        }
    }
    signMessage(args) {
        throw new Error("Method not implemented.");
    }
    async getTransaction(args) {
        try {
            console.log("[ethereum:getTransaction] ", args);
            const { hash } = args;
            const provider = this.getRpcProvider({});
            const transaction = await provider.getTransactionReceipt(hash);
            if (transaction) {
                console.log("[ethereum:getTransaction] transaction ", transaction);
                if (transaction.status == 1) {
                    return {
                        success: true,
                        txConfirmations: transaction.confirmations,
                        tx: transaction,
                        txStatus: transaction.confirmations > 1
                            ? WalletProvider_1.ExecutionStatus.SUCCESS
                            : WalletProvider_1.ExecutionStatus.PENDING,
                    };
                }
                else {
                    return {
                        success: true,
                        tx: transaction,
                        txConfirmations: transaction.confirmations,
                        txStatus: WalletProvider_1.ExecutionStatus.FAILED,
                    };
                }
            }
        }
        catch (e) {
            console.error("[ethereum:getTransaction] error ", e);
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
            console.log("[ethereum:waitForTransaction] ", parameters);
            const { timeout = 60000, confirmations = 3, hash } = parameters;
            const provider = this.getRpcProvider({});
            const awaitResult = await provider.waitForTransaction(parameters.hash, timeout, confirmations);
            if (awaitResult.status == 1) {
                console.log("[ethereum:waitForTransaction] successful");
                // All good
                return {
                    success: true,
                };
            }
            else if (awaitResult.status == 0) {
                console.error("[ethereum:waitForTransaction] tx failed");
                return {
                    success: false,
                    error: "Transaction failed",
                };
            }
            else {
                console.error("[ethereum:waitForTransaction] tx failed with unknown status");
                return {
                    success: false,
                    error: "Transaction failed wit status " + awaitResult.status,
                };
            }
        }
        catch (e) {
            console.error("[ethereum:waitForTransaction] error ", e);
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
                error: "No wallet",
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
            error: "No private key or mnemonic",
        };
    }
    async simulate(parameters) {
        console.log("[ethereum:simulate]");
        try {
            const transactionData = {
                to: parameters.to,
                data: parameters.data,
                gasLimit: parameters.gasLimit,
                gasPrice: parameters.gasPrice,
            };
            const result = await parameters.wallet.call(transactionData);
            return {
                success: true,
                result,
            };
        }
        catch (e) {
            console.error("[ethereum:simulate] error ", e);
            return {
                success: true,
                error: e.message,
            };
        }
    }
    async sendTransaction(parameters) {
        console.log("[ethereum:sendTransaction] parameters ", parameters);
        try {
            if (!parameters.wallet) {
                return {
                    success: false,
                    error: "No wallet",
                };
            }
            const transactionData = {
                to: parameters.to,
                data: parameters.data,
                gasLimit: parameters.gasLimit,
                gasPrice: parameters.gasPrice,
            };
            const result = await parameters.wallet.sendTransaction(transactionData);
            return {
                success: true,
                hash: result.hash,
                result,
            };
        }
        catch (e) {
            console.error("[ethereum:sendTransaction] error ", e);
            return {
                success: false,
                error: e.message,
            };
        }
    }
    getRpcProvider({ chainId }) {
        const rpcUrl = this.getRpcUrl({ chainId: chainId || this._chainId });
        return new ethers_1.ethers.providers.JsonRpcProvider(rpcUrl);
    }
    getRpcUrl({ chainId }) {
        if (chainId == 56) {
            return "https://bsc-dataseed1.binance.org";
        }
        if (chainId == 84531) {
            return "https://mainnet.era.zksync.io";
        }
        if (chainId == 137) {
            // return "https://polygon.llamarpc.com"
            return "https://polygon-rpc.com";
        }
        if (chainId == 42161) {
            // return "https://arbitrum.llamarpc.com";
            return "https://arbitrum-one-rpc.publicnode.com";
        }
        if (chainId == 1) {
            return "https://eth.llamarpc.com";
        }
        if (chainId == 10) {
            return "https://optimism.llamarpc.com";
        }
        if (chainId == 43114) {
            return "https://rpc.ankr.com/avalanche";
        }
        return undefined;
    }
    async createWalletFromPrivateKey(privateKey) {
        try {
            const provider = this.getRpcProvider({});
            console.log("[etherem:createWallet] privateKey ", privateKey.length);
            const ethersWallet = new ethers_1.ethers.Wallet(privateKey, provider);
            console.log("[etherem:createWallet] address with private key", ethersWallet?.address);
            return {
                success: true,
                wallet: {
                    address: ethersWallet.address,
                    privateKey: privateKey,
                    mnemonic: ethersWallet?.mnemonic?.phrase,
                    mnemonicPath: ethersWallet?.mnemonic?.path,
                    providerWallet: ethersWallet,
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
    async createWalletFromMnemonic(mnemonic, path = "m/44'/60'/0'/0/0") {
        try {
            console.log("[etherem:createWallet] mnemonic ");
            const ethersWallet = ethers_1.ethers.Wallet.fromMnemonic(mnemonic);
            console.log("[etherem:createWallet] address with mnemonic ", ethersWallet?.address);
            return {
                success: true,
                wallet: {
                    address: ethersWallet.address,
                    privateKey: ethersWallet.privateKey,
                    mnemonic: mnemonic,
                    mnemonicPath: ethersWallet.mnemonic.path,
                    providerWallet: ethersWallet,
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
            console.log("[etherem:createWallet] no private key or mnemonic, creating a new wallet");
            const ethersWallet = ethers_1.ethers.Wallet.createRandom();
            return {
                success: true,
                wallet: {
                    address: ethersWallet.address,
                    privateKey: ethersWallet.privateKey,
                    mnemonic: ethersWallet.mnemonic.phrase,
                    mnemonicPath: ethersWallet.mnemonic.path,
                    providerWallet: ethersWallet,
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
}
exports.default = EthereumWalletProvider;
