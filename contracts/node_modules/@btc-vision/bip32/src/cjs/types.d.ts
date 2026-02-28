import * as v from 'valibot';
export declare const Uint32Schema: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.IntegerAction<number, undefined>, v.MinValueAction<number, 0, undefined>, v.MaxValueAction<number, 4294967295, undefined>]>;
export declare const Uint31Schema: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.IntegerAction<number, undefined>, v.MinValueAction<number, 0, undefined>, v.MaxValueAction<number, 2147483647, undefined>]>;
export declare const Buffer256Bit: v.SchemaWithPipe<readonly [v.InstanceSchema<Uint8ArrayConstructor, undefined>, v.LengthAction<Uint8Array<ArrayBuffer>, 32, undefined>]>;
export declare const Buffer33Bytes: v.SchemaWithPipe<readonly [v.InstanceSchema<Uint8ArrayConstructor, undefined>, v.LengthAction<Uint8Array<ArrayBuffer>, 33, undefined>]>;
declare const Bip32Schema: v.ObjectSchema<{
    readonly public: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.IntegerAction<number, undefined>, v.MinValueAction<number, 0, undefined>, v.MaxValueAction<number, 4294967295, undefined>]>;
    readonly private: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.IntegerAction<number, undefined>, v.MinValueAction<number, 0, undefined>, v.MaxValueAction<number, 4294967295, undefined>]>;
}, undefined>;
export declare const NetworkSchema: v.ObjectSchema<{
    readonly wif: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.IntegerAction<number, undefined>, v.MinValueAction<number, 0, undefined>, v.MaxValueAction<number, 255, undefined>]>;
    readonly bip32: v.ObjectSchema<{
        readonly public: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.IntegerAction<number, undefined>, v.MinValueAction<number, 0, undefined>, v.MaxValueAction<number, 4294967295, undefined>]>;
        readonly private: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.IntegerAction<number, undefined>, v.MinValueAction<number, 0, undefined>, v.MaxValueAction<number, 4294967295, undefined>]>;
    }, undefined>;
    readonly messagePrefix: v.StringSchema<undefined>;
    readonly bech32: v.StringSchema<undefined>;
    readonly bech32Opnet: v.OptionalSchema<v.StringSchema<undefined>, undefined>;
    readonly pubKeyHash: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.IntegerAction<number, undefined>, v.MinValueAction<number, 0, undefined>, v.MaxValueAction<number, 255, undefined>]>;
    readonly scriptHash: v.SchemaWithPipe<readonly [v.NumberSchema<undefined>, v.IntegerAction<number, undefined>, v.MinValueAction<number, 0, undefined>, v.MaxValueAction<number, 255, undefined>]>;
}, undefined>;
export declare const Bip32PathSchema: v.SchemaWithPipe<readonly [v.StringSchema<undefined>, v.RegexAction<string, undefined>]>;
export type Bip32 = v.InferOutput<typeof Bip32Schema>;
export type Network = v.InferOutput<typeof NetworkSchema>;
export {};
