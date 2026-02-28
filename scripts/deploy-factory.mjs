import { JSONRpcProvider } from "opnet";
import { EcKeyPair, TransactionFactory, BinaryWriter } from "@btc-vision/transaction";
import { networks, initEccLib, toXOnly, toHex, address as btcAddress } from "@btc-vision/bitcoin";
import * as ecc from "@bitcoinerlab/secp256k1";
import fs from "fs";

initEccLib(ecc);

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const NETWORK_STR = (process.env.NETWORK || "testnet").toLowerCase();
const TREASURY = process.env.TREASURY || "";

if (!PRIVATE_KEY) { console.error("PRIVATE_KEY is required"); process.exit(1); }

const NETWORK = NETWORK_STR === "mainnet" ? networks.bitcoin : networks.opnetTestnet;
const RPC_URL = NETWORK_STR === "mainnet" ? "https://api.opnet.org" : "https://testnet.opnet.org";

console.log("MEMESLOTS Factory Deploy");
console.log("Network : " + NETWORK_STR.toUpperCase());
console.log("RPC     : " + RPC_URL);

const provider = new JSONRpcProvider({ url: RPC_URL, network: NETWORK });
const signer = EcKeyPair.fromWIF(PRIVATE_KEY, NETWORK);
const address = EcKeyPair.getTaprootAddress(signer, NETWORK);
const treasury = TREASURY || address;

console.log("Deployer: " + address);
console.log("Treasury: " + treasury);

const utxos = await provider.utxoManager.getUTXOs({ address });
console.log("UTXOs   : " + utxos.length);
if (utxos.length === 0) {
  console.error("No UTXOs found. Get testnet BTC at https://testnet.opnet.org/faucet");
  process.exit(1);
}

const wasmPath = "../contracts/build/MemeFactoryV2.wasm";
if (!fs.existsSync(wasmPath)) { console.error("WASM not found: " + wasmPath); process.exit(1); }
const wasmBytes = new Uint8Array(fs.readFileSync(wasmPath));
console.log("WASM    : " + wasmBytes.length + " bytes");

const p2trScript = btcAddress.toOutputScript(address, NETWORK);
const tweakedKeyHex = toHex(p2trScript.subarray(2, 34));

const calldata = Buffer.alloc(32);
Buffer.from(treasury, "utf8").copy(calldata, 0, 0, Math.min(32, treasury.length));

console.log("Getting challenge...");
const challenge = await provider.getChallenge();

console.log("Deploying MemeFactoryV2...");
const factory = new TransactionFactory();

const deployParams = {
  from: address,
  utxos,
  signer,
  mldsaSigner: null,
  network: NETWORK,
  feeRate: 10,
  priorityFee: 0n,
  gasSatFee: BigInt(20000),
  bytecode: wasmBytes,
  calldata: new Uint8Array(calldata),
  challenge,
  linkMLDSAPublicKeyToAddress: false,
  revealMLDSAPublicKey: false,
};

let deployment;
try {
  deployment = await factory.signDeployment(deployParams);
} catch (e) {
  console.error("Sign failed: " + e.message);
  process.exit(1);
}

const factoryAddress = deployment.contractAddress;
console.log("Contract: " + factoryAddress);

const funding = await provider.sendRawTransaction(deployment.transaction[0], false);
console.log("Funding TX: " + (funding.success ? "OK" : "FAILED - " + funding.error));
if (!funding.success) process.exit(1);

const reveal = await provider.sendRawTransaction(deployment.transaction[1], false);
console.log("Reveal TX : " + (reveal.success ? "OK" : "FAILED - " + reveal.error));
if (!reveal.success) process.exit(1);

console.log("Deployed! Contract: " + factoryAddress);

const res = { network: NETWORK_STR, deployedAt: new Date().toISOString(), deployer: address, treasury, MemeFactoryV2: factoryAddress };
fs.writeFileSync("deployed.json", JSON.stringify(res, null, 2));

const htmlPath = "../web/index.html";
if (fs.existsSync(htmlPath)) {
  let html = fs.readFileSync(htmlPath, "utf8");
  const patched = html.replace(/FACTORY:\s*['"][^'"]*['"]/, "FACTORY: '" + factoryAddress + "'");
  if (patched !== html) { fs.writeFileSync(htmlPath, patched); console.log("Patched index.html"); }
}

fs.appendFileSync(process.env.GITHUB_OUTPUT || "/dev/null", "factory_address=" + factoryAddress + "\n");
await provider.close();
console.log("Done!");import { JSONRpcProvider, DeploymentTransaction, UTXOsManager } from "opnet";
import { Wallet } from "@btc-vision/transaction";
import { networks, initEccLib } from "@btc-vision/bitcoin";
import * as ecc from "@bitcoinerlab/secp256k1";
import fs from "fs";

initEccLib(ecc);

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const QUANTUM_KEY = process.env.QUANTUM_KEY;
const NETWORK_STR = (process.env.NETWORK || "testnet").toLowerCase();
const TREASURY = process.env.TREASURY || "";

if (!PRIVATE_KEY) { console.error("PRIVATE_KEY is required"); process.exit(1); }
if (!QUANTUM_KEY) { console.error("QUANTUM_KEY is required"); process.exit(1); }

const NETWORK = NETWORK_STR === "mainnet" ? networks.bitcoin : networks.testnet;
const RPC_URL = NETWORK_STR === "mainnet" ? "https://mainnet.opnet.org" : "https://testnet.opnet.org";

console.log("MEMESLOTS Factory Deploy");
console.log("Network : " + NETWORK_STR.toUpperCase());
console.log("RPC     : " + RPC_URL);

const provider = new JSONRpcProvider(RPC_URL, NETWORK);

let wallet;
try { wallet = Wallet.fromPrivateKeys(PRIVATE_KEY, QUANTUM_KEY, NETWORK); }
catch (e) { console.error("Cannot read keys: " + e.message); process.exit(1); }

const address = wallet._address.p2op(NETWORK) || wallet.p2tr;
const treasury = TREASURY || address;
console.log("Deployer: " + address);

const wasmPath = "../contracts/build/MemeFactoryV2.wasm";
if (!fs.existsSync(wasmPath)) { console.error("WASM not found: " + wasmPath); process.exit(1); }
const wasmBytes = fs.readFileSync(wasmPath);
console.log("WASM    : " + wasmBytes.length + " bytes");

const utxoManager = new UTXOsManager(provider);
let utxos = await utxoManager.getUTXOs({ address });
if (utxos.length === 0) {
  const opnetAddress = address.replace("tb1p", "opt1p");
  console.log("Trying OP_NET address: " + opnetAddress);
  utxos = await utxoManager.getUTXOs({ address: opnetAddress });
}
console.log("UTXOs   : " + utxos.length);
if (utxos.length === 0) {
  console.error("No UTXOs found. Get testnet BTC at https://testnet.opnet.org/faucet");
  process.exit(1);
}

const calldata = Buffer.alloc(32);
Buffer.from(treasury, "utf8").copy(calldata, 0, 0, Math.min(32, treasury.length));

console.log("Deploying MemeFactoryV2...");

let factoryAddress;
try {
  const deployTx = new DeploymentTransaction({
    signer: wallet,
    refundTo: address,
    maximumAllowedSatToSpend: BigInt(150000),
    feeRate: 10,
    network: NETWORK,
    bytecode: wasmBytes,
    calldata: calldata,
    utxos: utxos,
  });
  const result = await deployTx.signAndBroadcast(provider);
  factoryAddress = result.contractAddress;
  console.log("Deployed! Contract: " + factoryAddress);
  console.log("TXID: " + result.txid);
} catch (e) {
  console.error("Deploy failed: " + e.message);
  process.exit(1);
}

const res = { network: NETWORK_STR, deployedAt: new Date().toISOString(), deployer: address, treasury, MemeFactoryV2: factoryAddress };
fs.writeFileSync("deployed.json", JSON.stringify(res, null, 2));

const htmlPath = "../web/index.html";
if (fs.existsSync(htmlPath)) {
  let html = fs.readFileSync(htmlPath, "utf8");
  const patched = html.replace(/FACTORY:\s*['"][^'"]*['"]/, "FACTORY: '" + factoryAddress + "'");
  if (patched !== html) { fs.writeFileSync(htmlPath, patched); console.log("Patched index.html"); }
}

fs.appendFileSync(process.env.GITHUB_OUTPUT || "/dev/null", "factory_address=" + factoryAddress + "\n");
console.log("Done!");
