/**
 * deploy-factory.mjs
 * Chạy bởi GitHub Actions — deploy MemeFactoryV2 lên OP_NET
 * Nhận input qua env vars:
 *   PRIVATE_KEY   — WIF private key (GitHub Secret)
 *   NETWORK       — 'testnet' | 'mainnet' (default: testnet)
 *   TREASURY      — địa chỉ nhận phí (optional, default = deployer)
 */

import { JSONRpcProvider } from 'opnet';
import { EcKeyPair } from '@btc-vision/transaction';
import { networks, initEccLib } from '@btc-vision/bitcoin';
import * as ecc from '@bitcoinerlab/secp256k1';
import fs from 'fs';

initEccLib(ecc);

// ── Config từ env ─────────────────────────────────────────────────────────────
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const NETWORK_STR = (process.env.NETWORK || 'testnet').toLowerCase();
const TREASURY    = process.env.TREASURY || '';

if (!PRIVATE_KEY) {
  console.error('❌ PRIVATE_KEY env var is required');
  process.exit(1);
}

const NETWORK = NETWORK_STR === 'mainnet' ? networks.bitcoin : networks.testnet;
const RPC_URL = NETWORK_STR === 'mainnet'
  ? 'https://mainnet.opnet.org'
  : 'https://testnet.opnet.org';

console.log(`\n🚀 MEMESLOTS Factory Deploy`);
console.log(`Network : ${NETWORK_STR.toUpperCase()}`);
console.log(`RPC     : ${RPC_URL}`);

const provider = new JSONRpcProvider(RPC_URL, NETWORK);

let keypair;
try {
  keypair = EcKeyPair.fromWIF(PRIVATE_KEY, NETWORK);
} catch (e) {
  console.error(`❌ Không thể đọc PRIVATE_KEY: ${e.message}`);
  process.exit(1);
}

const address  = EcKeyPair.getTaprootAddress(keypair, NETWORK);
const treasury = TREASURY || address;

console.log(`Deployer: ${address}`);
console.log(`Treasury: ${treasury}\n`);

try {
  const utxos   = await provider.getUTXOs(address);
  const balance = utxos.reduce((s, u) => s + BigInt(u.value), 0n);
  console.log(`Balance : ${balance.toLocaleString()} SAT`);
  if (balance < 50_000n) {
    console.error(`❌ Balance quá thấp (${balance} SAT). Cần ít nhất 50,000 SAT.`);
    if (NETWORK_STR === 'testnet') console.log(`   Faucet: https://testnet.opnet.org/faucet`);
    process.exit(1);
  }
} catch (e) {
  console.warn(`⚠️  Không lấy được balance: ${e.message}`);
}

const wasmPath = '../contracts/build/MemeFactoryV2.wasm';
if (!fs.existsSync(wasmPath)) {
  console.error(`❌ Không tìm thấy: ${wasmPath}`);
  process.exit(1);
}
const wasmBytes = fs.readFileSync(wasmPath);
console.log(`WASM    : ${wasmBytes.length.toLocaleString()} bytes\n`);

function encodeP2trAddress(addr) {
  const b = Buffer.alloc(32);
  Buffer.from(addr, 'utf8').copy(b, 0, 0, Math.min(32, addr.length));
  return b;
}
const calldata = encodeP2trAddress(treasury);

console.log('Deploying MemeFactoryV2...');

const TX_PARAMS = {
  signer:                   keypair,
  refundTo:                 address,
  maximumAllowedSatToSpend: 150_000n,
  feeRate:                  10,
  network:                  NETWORK,
};

let factoryAddress;
try {
  const deployTx = await provider.deployContract({
    bytecode: wasmBytes,
    calldata:  calldata,
    ...TX_PARAMS,
  });
  factoryAddress = deployTx.contractAddress;
  console.log(`✅ MemeFactoryV2 deployed!`);
  console.log(`   Contract : ${factoryAddress}`);
  console.log(`   TXID     : ${deployTx.txid}`);
  if (NETWORK_STR === 'testnet') console.log(`   Explorer : https://testnet.opnet.org/contract/${factoryAddress}`);
} catch (e) {
  console.error(`❌ Deploy failed: ${e.message}`);
  process.exit(1);
}

const result = { network: NETWORK_STR, deployedAt: new Date().toISOString(), deployer: address, treasury, MemeFactoryV2: factoryAddress };
fs.writeFileSync('deployed.json', JSON.stringify(result, null, 2));
console.log(`\n📄 Saved: deployed.json`);

const htmlPath = '../web/index.html';
if (fs.existsSync(htmlPath)) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  const patched = html.replace(/FACTORY:\s*['"][^'"]*['"]/, `FACTORY: '${factoryAddress}'`);
  if (patched !== html) { fs.writeFileSync(htmlPath, patched); console.log(`✅ Patched FACTORY address in web/index.html`); }
}

fs.appendFileSync(process.env.GITHUB_OUTPUT || '/dev/null', `factory_address=${factoryAddress}\n`);
console.log(`\n✨ Done!`);
