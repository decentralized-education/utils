"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TonProvider = exports.EthereumProvider = void 0;
var Ethereum_1 = require("./providers/Ethereum");
Object.defineProperty(exports, "EthereumProvider", { enumerable: true, get: function () { return __importDefault(Ethereum_1).default; } });
var Ton_1 = require("./providers/Ton");
Object.defineProperty(exports, "TonProvider", { enumerable: true, get: function () { return __importDefault(Ton_1).default; } });
