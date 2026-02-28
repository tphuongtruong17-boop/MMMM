import { TransactionFactory, Mnemonic, MLDSASecurityLevel, AddressTypes, BinaryWriter, Address } from "@btc-vision/transaction";
import { networks, toHex, address as btcAddress } from "@btc-vision/bitcoin";
import { JSONRpcProvider } from "opnet";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { name, symbol, supply, floorPrice, treasury } = req.body;
    const MNEMONIC = process.env.MNEMONIC;
    const NETWORK = networks.opnetTestnet;
    const provider = new JSONRpcProvider({ url: "https://testnet.opnet.org", network: NETWORK });
    const mnemonic = new Mnemonic(MNEMONIC, "", NETWORK, MLDSASecurityLevel.LEVEL2);
    const wallet = mnemonic.deriveOPWallet(AddressTypes.P2TR, 0);
    const address = wallet.p2tr;
    const utxos = await provider.utxoManager.getUTXOs({ address });
    const writer = new BinaryWriter();
    writer.writeStringWithLength(name);
    writer.writeStringWithLength(symbol);
    writer.writeU256(BigInt(String(supply).replace(/,/g, "")) * BigInt(10 ** 8));
    writer.writeU256(BigInt(floorPrice || 1000));
    writer.writeAddress(Address.fromString(toHex(btcAddress.toOutputScript(address, NETWORK).subarray(2, 34))));
    const calldata = writer.getBuffer();
    const wasmPath = path.join(__dirname, "..", "contracts", "build", "MemeToken.wasm");
    const wasmBytes = new Uint8Array(fs.readFileSync(wasmPath));
    const challenge = await provider.getChallenge();
    const factory = new TransactionFactory();
    const deployment = await factory.signDeployment({
      from: address, utxos,
      signer: wallet.keypair, mldsaSigner: wallet.mldsaKeypair,
      network: NETWORK, feeRate: 10, priorityFee: 0n, gasSatFee: BigInt(20000),
      bytecode: wasmBytes, calldata: new Uint8Array(calldata), challenge,
      linkMLDSAPublicKeyToAddress: true, revealMLDSAPublicKey: true,
    });
    const funding = await provider.sendRawTransaction(deployment.transaction[0], false);
    const reveal = await provider.sendRawTransaction(deployment.transaction[1], false);
    await provider.close();
    res.status(200).json({ success: true, contractAddress: deployment.contractAddress });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
