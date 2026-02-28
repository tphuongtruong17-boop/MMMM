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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bip32PathSchema = exports.NetworkSchema = exports.Buffer33Bytes = exports.Buffer256Bit = exports.Uint31Schema = exports.Uint32Schema = void 0;
const v = __importStar(require("valibot"));
exports.Uint32Schema = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffffffff));
exports.Uint31Schema = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0x7fffffff));
const Uint8Schema = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xff));
exports.Buffer256Bit = v.pipe(v.instance(Uint8Array), v.length(32));
exports.Buffer33Bytes = v.pipe(v.instance(Uint8Array), v.length(33));
const Bip32Schema = v.object({
    public: exports.Uint32Schema,
    private: exports.Uint32Schema,
});
exports.NetworkSchema = v.object({
    wif: Uint8Schema,
    bip32: Bip32Schema,
    messagePrefix: v.string(),
    bech32: v.string(),
    bech32Opnet: v.optional(v.string()),
    pubKeyHash: Uint8Schema,
    scriptHash: Uint8Schema,
});
exports.Bip32PathSchema = v.pipe(v.string(), v.regex(/^(m\/)?(\d+'?\/)*\d+'?$/));
