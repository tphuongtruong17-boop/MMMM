import { Uint8ArrayOrBuffer } from './Buffer.js';
interface Network {
    wif: number;
    bip32: {
        public: number;
        private: number;
    };
    messagePrefix?: string;
    bech32?: string;
    pubKeyHash?: number;
    scriptHash?: number;
}
export interface Signer {
    publicKey: Uint8ArrayOrBuffer;
    lowR: boolean;
    sign(hash: Uint8ArrayOrBuffer, lowR?: boolean): Uint8ArrayOrBuffer;
    verify(hash: Uint8ArrayOrBuffer, signature: Uint8ArrayOrBuffer): boolean;
    signSchnorr(hash: Uint8ArrayOrBuffer): Uint8ArrayOrBuffer;
    verifySchnorr(hash: Uint8ArrayOrBuffer, signature: Uint8ArrayOrBuffer): boolean;
}
export interface BIP32Interface extends Signer {
    chainCode: Uint8ArrayOrBuffer;
    network: Network;
    depth: number;
    index: number;
    parentFingerprint: number;
    privateKey?: Uint8ArrayOrBuffer;
    identifier: Uint8ArrayOrBuffer;
    fingerprint: Uint8ArrayOrBuffer;
    isNeutered(): boolean;
    neutered(): BIP32Interface;
    toBase58(): string;
    toWIF(): string;
    derive(index: number): BIP32Interface;
    deriveHardened(index: number): BIP32Interface;
    derivePath(path: string): BIP32Interface;
    tweak(t: Uint8ArrayOrBuffer): Signer;
}
export interface BIP32API {
    fromSeed(seed: Uint8ArrayOrBuffer, network?: Network): BIP32Interface;
    fromBase58(inString: string, network?: Network): BIP32Interface;
    fromPublicKey(publicKey: Uint8ArrayOrBuffer, chainCode: Uint8ArrayOrBuffer, network?: Network): BIP32Interface;
    fromPrivateKey(privateKey: Uint8ArrayOrBuffer, chainCode: Uint8ArrayOrBuffer, network?: Network): BIP32Interface;
}
interface XOnlyPointAddTweakResult {
    parity: 1 | 0;
    xOnlyPubkey: Uint8ArrayOrBuffer;
}
export interface TinySecp256k1Interface {
    isPoint(p: Uint8ArrayOrBuffer): boolean;
    isPrivate(d: Uint8ArrayOrBuffer): boolean;
    pointFromScalar(d: Uint8ArrayOrBuffer, compressed?: boolean): Uint8ArrayOrBuffer | null;
    pointAddScalar(p: Uint8ArrayOrBuffer, tweak: Uint8ArrayOrBuffer, compressed?: boolean): Uint8ArrayOrBuffer | null;
    privateAdd(d: Uint8ArrayOrBuffer, tweak: Uint8ArrayOrBuffer): Uint8ArrayOrBuffer | null;
    sign(h: Uint8ArrayOrBuffer, d: Uint8ArrayOrBuffer, e?: Uint8ArrayOrBuffer): Uint8ArrayOrBuffer;
    signSchnorr?(h: Uint8ArrayOrBuffer, d: Uint8ArrayOrBuffer, e?: Uint8ArrayOrBuffer): Uint8ArrayOrBuffer;
    verify(h: Uint8ArrayOrBuffer, Q: Uint8ArrayOrBuffer, signature: Uint8ArrayOrBuffer, strict?: boolean): boolean;
    verifySchnorr?(h: Uint8ArrayOrBuffer, Q: Uint8ArrayOrBuffer, signature: Uint8ArrayOrBuffer): boolean;
    xOnlyPointAddTweak?(p: Uint8ArrayOrBuffer, tweak: Uint8ArrayOrBuffer): XOnlyPointAddTweakResult | null;
    privateNegate?(d: Uint8ArrayOrBuffer): Uint8ArrayOrBuffer;
}
export declare function BIP32Factory(ecc: TinySecp256k1Interface): BIP32API;
export {};
