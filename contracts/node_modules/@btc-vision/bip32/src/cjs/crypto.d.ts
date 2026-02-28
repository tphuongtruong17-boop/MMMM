import { Uint8ArrayOrBuffer } from './Buffer.js';
export declare function hash160(buffer: Uint8ArrayOrBuffer): Uint8ArrayOrBuffer;
export declare function hash256(buffer: Uint8ArrayOrBuffer): Uint8ArrayOrBuffer;
export declare function hmacSHA512(key: Uint8ArrayOrBuffer, data: Uint8ArrayOrBuffer): Uint8ArrayOrBuffer;
