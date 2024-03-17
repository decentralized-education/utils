import { ethers } from 'ethers'
import { IGetTransactionResult, IWallet, IWalletProvider, IWalletProviderCallParameters, SendTransactionResponse, WalletResponse } from './WalletProvider'
import { mnemonicNew, mnemonicToPrivateKey } from '@ton/crypto'
import { Address, TonClient, WalletContractV4 } from '@ton/ton'
import { HttpClient, Api } from 'tonapi-sdk-js';
import 'cross-fetch/polyfill';

export default class TonWalletProvider implements IWalletProvider {
    async getTransaction(parameters:{hash: string}):Promise<IGetTransactionResult>{
        return {
            success: false
        }
    }
    async waitForTransaction(parameters:{
        hash: string
    }){
        console.log("[ton:waitForTransaction] ",parameters)
        return {
            success: false
        }
    }
    async createWalletFromDatabase(wallet: IWallet): Promise<WalletResponse<IWallet>> {
        if(!wallet){
            return {
                success: false,
                error: "No wallet"
            }
        }
        // No private key creation for TON
        if(wallet.mnemonic){
            return this.createWalletFromMnemonic(wallet.mnemonic, wallet.mnemonicPath)
        }
        return {
            success: false,
            error: "No mnemonic"
        }
    }
    async simulate(parameters:IWalletProviderCallParameters){
        return {
            success: false,
            error: "Not implemented"
        }
        // Promise<WalletResponse<any>>
    } 
    async sendTransaction(parameters:IWalletProviderCallParameters): Promise<SendTransactionResponse<any>>{
        console.log("[ton:sendTransaction] parameters ",parameters)
        return {
            success: false,
            error: "Not implemented"
        }
        // Promise<WalletResponse<any>>
    } 
    getRpcProvider({chainId}:{
        chainId?: number
    }){
        const client = new TonClient({
            endpoint: 'https://toncenter.com/api/v2/jsonRPC',
        });
        return client;   
        // const rpcUrl = this.getRpcUrl({chainId})
        // return new ethers.providers.JsonRpcProvider(rpcUrl)
    }
    async test() {
        const targetAddress = process.env.TON_TEST_ADDRESS
        const rawAddress = Address.parse(targetAddress!);

        console.log("test rawAddress=",rawAddress)
        const httpClient = new HttpClient({
            baseUrl: 'https://tonapi.io/',
            baseApiParams: {
                headers: {
                    Authorization: `Bearer ${process.env.TONAPI_KEY}`,
                    'Content-type': 'application/json'
                }
            }
        });
        const client = new Api(httpClient);

        
        const events = await client.accounts.getAccountEvents(targetAddress!, { limit: 10 });
        const pendingTrades:{
            side: string,
            symbol: string,
            address: string,
            amount: string
        }[] = [];
        // console.log("events ",JSON.stringify(events.events))
        for(const event of events.events){
            // console.log("event ",event.actions)
            for(const action of event.actions){
                if(action.JettonTransfer){
                    console.log("action ",event.timestamp)
                    pendingTrades.push({
                        side: action.JettonTransfer.senders_wallet == rawAddress.toString() ? "SELL" : "BUY",
                        symbol: action.JettonTransfer.jetton.symbol,
                        address: action.JettonTransfer.jetton.address,
                        amount: action.JettonTransfer.amount
                    })
                }
            }
        }
        return;
        // const tonweb = new TonWeb();

        // const client = new TonClient({
        //     endpoint: 'https://toncenter.com/api/v2/jsonRPC',
        //     apiKey: process.env.TONCENTER_API,
        // });

        // const myAddress = Address.parse(targetAddress);
        // const transactions = await client.getTransactions(myAddress, {
        //     limit: 10,
        // });
        // console.log("txs ",JSON.stringify(txs))


        // for (const tx of transactions) {
        //     console.log("========")
        //     console.log("tx ",tx)
        //     const inMsg = tx.inMessage;
    
        //     if (inMsg?.info.type == 'internal') {
        //         // we only process internal messages here because they are used the most
        //         // for external messages some of the fields are empty, but the main structure is similar
        //         const sender = inMsg?.info.src;
        //         const value = inMsg?.info.value.coins;
    
        //         const originalBody = inMsg?.body.beginParse();
        //         let body = originalBody.clone();
        //         if (body.remainingBits < 32) {
        //             // if body doesn't have opcode: it's a simple message without comment
        //             console.log(`Simple transfer from ${sender} with value ${fromNano(value)} TON`);
        //         } else {
        //             const op = body.loadUint(32);
        //             if (op == 0) {
        //                 // if opcode is 0: it's a simple message with comment
        //                 const comment = body.loadStringTail();
        //                 console.log(
        //                     `Simple transfer from ${sender} with value ${fromNano(value)} TON and comment: "${comment}"`
        //                 );
        //             } else if (op == 0x7362d09c) {
        //                 // if opcode is 0x7362d09c: it's a Jetton transfer notification
    
        //                 body.skip(64); // skip query_id
        //                 const jettonAmount = body.loadCoins();
        //                 const jettonSender = body.loadAddressAny();
        //                 const originalForwardPayload = body.loadBit() ? body.loadRef().beginParse() : body;
        //                 let forwardPayload = originalForwardPayload.clone();
    
        //                 // IMPORTANT: we have to verify the source of this message because it can be faked
        //                 const runStack = (await client.runMethod(sender, 'get_wallet_data')).stack;
        //                 runStack.skip(2);
        //                 const jettonMaster = runStack.readAddress();
        //                 const jettonWallet = (
        //                     await client.runMethod(jettonMaster, 'get_wallet_address', [
        //                         { type: 'slice', cell: beginCell().storeAddress(myAddress).endCell() },
        //                     ])
        //                 ).stack.readAddress();
        //                 if (!jettonWallet.equals(sender)) {
        //                     // if sender is not our real JettonWallet: this message was faked
        //                     console.log(`FAKE Jetton transfer`);
        //                     continue;
        //                 }
    
        //                 if (forwardPayload.remainingBits < 32) {
        //                     // if forward payload doesn't have opcode: it's a simple Jetton transfer
        //                     console.log(`Jetton transfer from ${jettonSender} with value ${fromNano(jettonAmount)} Jetton`);
        //                 } else {
        //                     const forwardOp = forwardPayload.loadUint(32);
        //                     if (forwardOp == 0) {
        //                         // if forward payload opcode is 0: it's a simple Jetton transfer with comment
        //                         const comment = forwardPayload.loadStringTail();
        //                         console.log(
        //                             `Jetton transfer from ${jettonSender} with value ${fromNano(
        //                                 jettonAmount
        //                             )} Jetton and comment: "${comment}"`
        //                         );
        //                     } else {
        //                         // if forward payload opcode is something else: it's some message with arbitrary structure
        //                         // you may parse it manually if you know other opcodes or just print it as hex
        //                         console.log(
        //                             `Jetton transfer with unknown payload structure from ${jettonSender} with value ${fromNano(
        //                                 jettonAmount
        //                             )} Jetton and payload: ${originalForwardPayload}`
        //                         );
        //                     }
    
        //                     console.log(`Jetton Master: ${jettonMaster}`);
        //                 }
        //             } else if (op == 0x05138d91) {
        //                 // if opcode is 0x05138d91: it's a NFT transfer notification
    
        //                 body.skip(64); // skip query_id
        //                 const prevOwner = body.loadAddress();
        //                 const originalForwardPayload = body.loadBit() ? body.loadRef().beginParse() : body;
        //                 let forwardPayload = originalForwardPayload.clone();
    
        //                 // IMPORTANT: we have to verify the source of this message because it can be faked
        //                 const runStack = (await client.runMethod(sender, 'get_nft_data')).stack;
        //                 runStack.skip(1);
        //                 const index = runStack.readBigNumber();
        //                 const collection = runStack.readAddress();
        //                 const itemAddress = (
        //                     await client.runMethod(collection, 'get_nft_address_by_index', [{ type: 'int', value: index }])
        //                 ).stack.readAddress();
    
        //                 if (!itemAddress.equals(sender)) {
        //                     console.log(`FAKE NFT Transfer`);
        //                     continue;
        //                 }
    
        //                 if (forwardPayload.remainingBits < 32) {
        //                     // if forward payload doesn't have opcode: it's a simple NFT transfer
        //                     console.log(`NFT transfer from ${prevOwner}`);
        //                 } else {
        //                     const forwardOp = forwardPayload.loadUint(32);
        //                     if (forwardOp == 0) {
        //                         // if forward payload opcode is 0: it's a simple NFT transfer with comment
        //                         const comment = forwardPayload.loadStringTail();
        //                         console.log(`NFT transfer from ${prevOwner} with comment: "${comment}"`);
        //                     } else {
        //                         // if forward payload opcode is something else: it's some message with arbitrary structure
        //                         // you may parse it manually if you know other opcodes or just print it as hex
        //                         console.log(
        //                             `NFT transfer with unknown payload structure from ${prevOwner} and payload: ${originalForwardPayload}`
        //                         );
        //                     }
        //                 }
    
        //                 console.log(`NFT Item: ${itemAddress}`);
        //                 console.log(`NFT Collection: ${collection}`);
        //             } else {
        //                 // if opcode is something else: it's some message with arbitrary structure
        //                 // you may parse it manually if you know other opcodes or just print it as hex
        //                 console.log(
        //                     `Message with unknown structure from ${sender} with value ${fromNano(
        //                         value
        //                     )} TON and body: ${originalBody}`
        //                 );
        //             }
        //         }
        //     }else if(inMsg?.info.type == 'external-in'){
        //         console.log("external ")
        //         const sender = inMsg?.info.src;
    
        //         const originalBody = inMsg?.body.beginParse();
        //         let body = originalBody.clone();
        //         if (body.remainingBits < 32) {
        //             // if body doesn't have opcode: it's a simple message without comment
        //             console.log(`Simple transfer from ${sender} with value TON`);
        //         } else {
        //             const op = body.loadUint(32);
        //             console.log("else ",op)

        //             body.skip(64); // skip query_id
        //             const jettonAmount = body.loadCoins();
        //             const jettonSender = body.loadAddressAny();
        //             const originalForwardPayload = body.loadBit() ? body.loadRef().beginParse() : body;
        //             let forwardPayload = originalForwardPayload.clone();

        //             console.log("jettonAmount ",jettonAmount)
        //             console.log("jettonSender ",jettonSender)
        //         }
        //     }else{
        //         console.log("other")
        //     }
        //     console.log(`Transaction Hash: ${tx.hash().toString('hex')}`);
        //     console.log(`Transaction LT: ${tx.lt}`);
        //     console.log();
        // }

        // const txs = await tonweb.getTransactions(targetAddress, 10);

        // for(const tx of txs){
            // console.log("tx in_msg=",tx.in_msg)
        // }

        // const client = new TonClient({
        //     endpoint: 'https://toncenter.com/api/v2/jsonRPC',
        // })
        // const transactions = await client.getTransactions(
        //     Address.parse(targetAddress),
        //     {
        //         limit: 10,
        //     }
        // )
        // console.log("transactions ",transactions)
        // for(const tx of transactions){
        //     console.log("tx address=",tx.description)
        // }
    }
    async createWalletFromPrivateKey(
        privateKey: string
    ): Promise<WalletResponse<IWallet>> {
        return {
            success: false,
            error: 'TON does not support private key import',
        }
    }

    async createWalletFromMnemonic(
        mnemonic: string,
        path?: string
    ): Promise<WalletResponse<IWallet>> {
        try {
            console.log('[createWallet:ton] mnemonic ')
            let keyPair = await mnemonicToPrivateKey(mnemonic.split(' '))
            const workchain = 0
            let wallet = WalletContractV4.create({
                workchain,
                publicKey: keyPair.publicKey,
            })
            console.log('[createWallet:ton] wallet.address ', wallet.address)
            return {
                success: true,
                wallet: {
                    address: wallet.address.toString(),
                    // privateKey: keyPair.publicKey,
                    mnemonic: mnemonic,
                    // mnemonicPath: ethersWallet.mnemonic.path,
                    providerWallet: wallet,
                },
            }
        } catch (e) {
            console.log("[createWallet:ton] error ", (e as Error).message);
            return {
              success: false,
              error: (e as Error).message,
            };
        }
    }

    async createWallet(): Promise<WalletResponse<IWallet>> {
        try {
            console.log(
                '[createWallet:ton] no private key or mnemonic, creating a new wallet'
            )
            let mnemonics = await mnemonicNew()
            let keyPair = await mnemonicToPrivateKey(mnemonics)
            const workchain = 0
            let wallet = WalletContractV4.create({
                workchain,
                publicKey: keyPair.publicKey,
            })
            console.log('wallet.address ', wallet.address)
            return {
                success: true,
                wallet: {
                    address: wallet.address.toString(),
                    // privateKey: keyPair.publicKey,
                    mnemonic: mnemonics.join(' '),
                    // mnemonicPath: ethersWallet.mnemonic.path,
                    providerWallet: wallet,
                },
            }
        } catch (e) {
            console.log("[createWallet:ton] error ", (e as Error).message);
            return {
              success: false,
              error: (e as Error).message,
            };
        }
    }
}
