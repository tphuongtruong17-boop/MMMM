/**
 * deploy-factory.mjs
 * Chạy bởi GitHub Actions — deploy MemeFactoryV2 lên OP_NET
 * Nhận input qua env vars:
 *   PRIVATE_KEY   — WIF private key (GitHub Secret)
 *   NETWORK       — 'testnet' | 'mainnet' (default: testnet)
 *   TREASURY      — địa chỉ nhận phí (optional, default = deployer)
 */

import { JSONRpcProvider, Wallet } from 'opnet';
import { Network } from '@btc-vision/bitcoin';
import { InteractionTransaction } from '@btc-vision/transaction';
import fs from 'fs';

// ── Config từ env ─────────────────────────────────────────────────────────────
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const NETWORK_STR = (process.env.NETWORK || 'testnet').toLowerCase();
const TREASURY    = process.env.TREASURY || '';

if (!PRIVATE_KEY) {
  console.error('❌ PRIVATE_KEY env var is required');
  console.error('   Add it as a GitHub Secret: Settings → Secrets → PRIVATE_KEY');
  process.exit(1);
}

const NETWORK = NETWORK_STR === 'mainnet' ? Network.MAINNET : Network.TESTNET;
const RPC_URL = NETWORK_STR === 'mainnet'
  ? 'https://mainnet.opnet.org'
  : 'https://testnet.opnet.org';

// ── Setup ─────────────────────────────────────────────────────────────────────
console.log(`\n🚀 MEMESLOTS Factory Deploy`);
console.log(`Network : ${NETWORK_STR.toUpperCase()}`);
console.log(`RPC     : ${RPC_URL}`);

const provider = new JSONRpcProvider(RPC_URL, NETWORK);
const wallet   = Wallet.fromWIF(PRIVATE_KEY, NETWORK);
const address  = wallet.p2tr;
const treasury = TREASURY || address;

console.log(`Deployer: ${address}`);
console.log(`Treasury: ${treasury}\n`);

// ── Check balance ─────────────────────────────────────────────────────────────
try {
  const utxos   = await provider.getUTXOs(address);
  const balance = utxos.reduce((s, u) => s + BigInt(u.value), 0n);
  console.log(`Balance : ${balance.toLocaleString()} SAT`);
  if (balance < 50_000n) {
    console.error(`❌ Balance quá thấp (${balance} SAT). Cần ít nhất 50,000 SAT.`);
    if (NETWORK_STR === 'testnet') {
      console.log(`   Faucet: https://testnet.opnet.org/faucet`);
    }
    process.exit(1);
  }
} catch (e) {
  console.warn(`⚠️  Không lấy được balance: ${e.message}`);
}

// ── Load WASM ─────────────────────────────────────────────────────────────────
const wasmPath = '../contracts/build/MemeFactoryV2.wasm';
if (!fs.existsSync(wasmPath)) {
  console.error(`❌ Không tìm thấy: ${wasmPath}`);
  console.error('   Workflow phải chạy build:all trước deploy');
  process.exit(1);
}
const wasmBytes = fs.readFileSync(wasmPath);
console.log(`WASM    : ${wasmBytes.length.toLocaleString()} bytes\n`);

// ── Encode treasury address làm calldata constructor ─────────────────────────
// OP_NET calldata: address được encode thành 32 bytes
function encodeP2trAddress(addr) {
  // Dùng @btc-vision/transaction để encode đúng chuẩn OP_NET
  try {
    const { Address } = await import('@btc-vision/transaction');
    const a = new Address(addr);
    return Buffer.from(a.toBytes());
  } catch {
    // Fallback: encode UTF-8 padded
    const b = Buffer.alloc(32);
    Buffer.from(addr, 'utf8').copy(b, 0, 0, Math.min(32, addr.length));
    return b;
  }
}

const calldata = await encodeP2trAddress(treasury);

// ── Deploy ────────────────────────────────────────────────────────────────────
console.log('Deploying MemeFactoryV2...');

const TX_PARAMS = {
  signer:                   wallet.keypair,
  refundTo:                 wallet.p2tr,
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
  const txid     = deployTx.txid;

  console.log(`✅ MemeFactoryV2 deployed!`);
  console.log(`   Contract : ${factoryAddress}`);
  console.log(`   TXID     : ${txid}`);
  if (NETWORK_STR === 'testnet') {
    console.log(`   Explorer : https://testnet.opnet.org/contract/${factoryAddress}`);
  }

} catch (e) {
  console.error(`❌ Deploy failed: ${e.message}`);
  if (e.message?.includes('fee')) {
    console.error('   Thử tăng maximumAllowedSatToSpend trong TX_PARAMS');
  }
  process.exit(1);
}

// ── Lưu kết quả ra file (GitHub Actions artifact) ─────────────────────────────
const result = {
  network:     NETWORK_STR,
  deployedAt:  new Date().toISOString(),
  deployer:    address,
  treasury,
  MemeFactoryV2: factoryAddress,
};

fs.writeFileSync('deployed.json', JSON.stringify(result, null, 2));
console.log(`\n📄 Saved: deployed.json`);

// ── Patch index.html với factory address mới ─────────────────────────────────
const htmlPath = '../web/index.html';
if (fs.existsSync(htmlPath)) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  const patched = html.replace(
    /FACTORY:\s*['"][^'"]*['"]/,
    `FACTORY: '${factoryAddress}'`
  );
  if (patched !== html) {
    fs.writeFileSync(htmlPath, patched);
    console.log(`✅ Patched FACTORY address in web/index.html`);
  }
}

// Output cho GitHub Actions step
console.log(`\n::set-output name=factory_address::${factoryAddress}`);
// GitHub Actions modern syntax
fs.appendFileSync(process.env.GITHUB_OUTPUT || '/dev/null',
  `factory_address=${factoryAddress}\n`
);

console.log(`\n✨ Done!`);
