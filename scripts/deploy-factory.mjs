nano /workspaces/MMMM/scripts/deploy-factory.mjs
```

Paste toàn bộ code này vào (copy từ dòng đầu đến dòng cuối):
```
import { JSONRpcProvider, DeploymentTransaction, UTXOsManager } from "opnet";
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
try { wallet = Wallet.fromWif(PRIVATE_KEY, QUANTUM_KEY, NETWORK); }
catch (e) { console.error("Cannot read keys: " + e.message); process.exit(1); }

const address = wallet.p2tr;
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
