import {
  Address,
  Blockchain,
  BytesWriter,
  Calldata,
  OP_NET,
  encodeSelector,
  Selector,
  NetEvent,
  StoredU256,
  AddressMemoryMap,
} from '@btc-vision/btc-runtime/runtime';
import { u256 } from 'as-bignum/assembly';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_SLOTS: u16 = 100;

// T+3 ngày Bitcoin = 3 * 144 blocks = 432 blocks mỗi chu kỳ
const CYCLE_BLOCKS: u64 = 432;

// Giá sàn mặc định khi claim slot trống
const DEFAULT_FLOOR_PRICE: u64 = 1000; // satoshi

// ─── Events ───────────────────────────────────────────────────────────────────

class SlotClaimedEvent extends NetEvent {
  constructor(slotId: u16, owner: Address, price: u256) {
    const w = new BytesWriter(2 + 32 + 32);
    w.writeU16(slotId);
    w.writeAddress(owner);
    w.writeU256(price);
    super('SlotClaimed', w);
  }
}

class SlotTakenOverEvent extends NetEvent {
  constructor(slotId: u16, newOwner: Address, oldOwner: Address, price: u256, currentCycle: u256) {
    const w = new BytesWriter(2 + 32 + 32 + 32 + 32);
    w.writeU16(slotId);
    w.writeAddress(newOwner);
    w.writeAddress(oldOwner);
    w.writeU256(price);
    w.writeU256(currentCycle);
    super('SlotTakenOver', w);
  }
}

class CycleRewardClaimedEvent extends NetEvent {
  constructor(owner: Address, slotId: u16, cycle: u256, amount: u256) {
    const w = new BytesWriter(32 + 2 + 32 + 32);
    w.writeAddress(owner);
    w.writeU16(slotId);
    w.writeU256(cycle);
    w.writeU256(amount);
    super('CycleRewardClaimed', w);
  }
}

class RevenueReceivedEvent extends NetEvent {
  constructor(cycle: u256, amount: u256, perSlot: u256) {
    const w = new BytesWriter(32 + 32 + 32);
    w.writeU256(cycle);
    w.writeU256(amount);
    w.writeU256(perSlot);
    super('RevenueReceived', w);
  }
}

class TakeoverRefundEvent extends NetEvent {
  constructor(to: Address, amount: u256) {
    const w = new BytesWriter(32 + 32);
    w.writeAddress(to);
    w.writeU256(amount);
    super('TakeoverRefund', w);
  }
}

// ─── RevenueSharingV2 ─────────────────────────────────────────────────────────
//
// Chu kỳ thời gian:
//
//   deploy_block = B0
//   Chu kỳ 0: [B0      → B0 + 432)
//   Chu kỳ 1: [B0+432  → B0 + 864)
//   Chu kỳ 2: [B0+864  → B0 + 1296)
//   ...
//   Chu kỳ N = floor((currentBlock - B0) / 432)
//
// Ai đang giữ slot tại thời điểm cycle kết thúc (cycle boundary)
// → được nhận toàn bộ phí tích lũy trong cycle đó.
//
// Takeover:
//   - Trả giá > giá hiện tại → lấy slot ngay lập tức
//   - Người bị cướp nhận lại tiền takeover ngay
//   - Phí tích lũy cycle hiện tại KHÔNG bị lấy ngay
//     → ai giữ slot lúc cycle kết thúc mới nhận
//
// Claim phí:
//   - Chỉ claim được các cycle ĐÃ KẾT THÚC
//   - Phải là người đang giữ slot tại thời điểm cycle đó kết thúc
//   - Dùng "snapshot" per-slot per-cycle để xác định

@final
export class RevenueSharingV2 extends OP_NET {

  // ── Core storage ────────────────────────────────────────────────────────────
  private static readonly MEME_TOKEN_PTR: u16     = 100;
  private static readonly DEPLOY_BLOCK_PTR: u16   = 101;
  private static readonly FLOOR_PRICE_PTR: u16    = 102;
  private static readonly TOTAL_REVENUE_PTR: u16  = 103;

  // Revenue tích lũy per slot của cycle hiện tại (reset mỗi cycle)
  private static readonly CYCLE_REVENUE_ACC_PTR: u16  = 104; // tổng cộng vào cycle hiện tại
  private static readonly LAST_SETTLED_CYCLE_PTR: u16 = 105; // cycle cuối đã được settle

  // ── Per-slot storage ─────────────────────────────────────────────────────────
  // key = slotId (u256)
  private static readonly SLOT_OWNER_PTR: u16       = 200; // owner hiện tại
  private static readonly SLOT_PRICE_PTR: u16       = 201; // giá owner hiện tại đã trả
  private static readonly SLOT_SINCE_CYCLE_PTR: u16 = 202; // cycle mà owner này bắt đầu giữ
  private static readonly SLOT_LAST_CLAIM_PTR: u16  = 203; // cycle cuối owner đã claim

  // ── Per-cycle per-slot snapshot ───────────────────────────────────────────
  // key = cycle * 1000 + slotId  (giả sử slot < 1000, cycle không quá lớn)
  // Lưu địa chỉ owner tại thời điểm cycle kết thúc
  private static readonly CYCLE_SLOT_OWNER_PTR: u16 = 300;
  // Revenue per slot của cycle đó
  private static readonly CYCLE_REVENUE_PTR: u16    = 301;

  // ── Per-user claimable balance ────────────────────────────────────────────
  private static readonly USER_BALANCE_PTR: u16 = 400;

  // ── Stored fields ─────────────────────────────────────────────────────────

  private _memeToken: StoredU256     = new StoredU256(RevenueSharingV2.MEME_TOKEN_PTR, u256.Zero);
  private _deployBlock: StoredU256   = new StoredU256(RevenueSharingV2.DEPLOY_BLOCK_PTR, u256.Zero);
  private _floorPrice: StoredU256    = new StoredU256(RevenueSharingV2.FLOOR_PRICE_PTR, u256.fromU64(DEFAULT_FLOOR_PRICE));
  private _totalRevenue: StoredU256  = new StoredU256(RevenueSharingV2.TOTAL_REVENUE_PTR, u256.Zero);
  private _cycleRevenueAcc: StoredU256    = new StoredU256(RevenueSharingV2.CYCLE_REVENUE_ACC_PTR, u256.Zero);
  private _lastSettledCycle: StoredU256   = new StoredU256(RevenueSharingV2.LAST_SETTLED_CYCLE_PTR, u256.Zero);

  private slotOwner:      AddressMemoryMap<u256> = new AddressMemoryMap<u256>(RevenueSharingV2.SLOT_OWNER_PTR);
  private slotPrice:      AddressMemoryMap<u256> = new AddressMemoryMap<u256>(RevenueSharingV2.SLOT_PRICE_PTR);
  private slotSinceCycle: AddressMemoryMap<u256> = new AddressMemoryMap<u256>(RevenueSharingV2.SLOT_SINCE_CYCLE_PTR);
  private slotLastClaim:  AddressMemoryMap<u256> = new AddressMemoryMap<u256>(RevenueSharingV2.SLOT_LAST_CLAIM_PTR);

  private cycleSlotOwner:   AddressMemoryMap<u256> = new AddressMemoryMap<u256>(RevenueSharingV2.CYCLE_SLOT_OWNER_PTR);
  private cycleRevenue:     AddressMemoryMap<u256> = new AddressMemoryMap<u256>(RevenueSharingV2.CYCLE_REVENUE_PTR);

  private userBalance: AddressMemoryMap<u256> = new AddressMemoryMap<u256>(RevenueSharingV2.USER_BALANCE_PTR);

  public constructor() {
    super();
  }

  // ─── Deploy ────────────────────────────────────────────────────────────────

  public override onDeployment(calldata: Calldata): void {
    const memeTokenAddr: Address = calldata.readAddress();
    const floorPrice: u256 = calldata.readU256();

    this._memeToken.value = u256.fromBytes(memeTokenAddr.toBytes(), true);
    this._deployBlock.value = Blockchain.blockNumber;

    if (u256.gt(floorPrice, u256.Zero)) {
      this._floorPrice.value = floorPrice;
    }
  }

  // ─── Execute ───────────────────────────────────────────────────────────────

  public override execute(method: Selector, calldata: Calldata): BytesWriter {
    // Trước mỗi action, settle các cycle đã kết thúc
    this._settlePendingCycles();

    switch (method) {
      case encodeSelector('claimSlot(uint16,uint256)'):
        return this.claimSlot(calldata);
      case encodeSelector('takeoverSlot(uint16,uint256)'):
        return this.takeoverSlot(calldata);
      case encodeSelector('claimRevenue()'):
        return this.claimRevenue();
      case encodeSelector('receiveRevenue(uint256)'):
        return this.receiveRevenue(calldata);
      case encodeSelector('getSlotInfo(uint16)'):
        return this.getSlotInfo(calldata);
      case encodeSelector('getCurrentCycle()'):
        return this.getCurrentCycleInfo();
      case encodeSelector('getPendingRevenue(address)'):
        return this.getPendingRevenue(calldata);
      case encodeSelector('getUserBalance(address)'):
        return this.getUserBalance(calldata);
      case encodeSelector('getSlotsByOwner(address)'):
        return this.getSlotsByOwner(calldata);
      case encodeSelector('getCycleInfo(uint256)'):
        return this.getCycleInfo(calldata);
      default:
        return super.execute(method, calldata);
    }
  }

  // ─── Helper: tính cycle hiện tại ──────────────────────────────────────────
  // cycle = floor((currentBlock - deployBlock) / CYCLE_BLOCKS)

  private _currentCycle(): u256 {
    const elapsed = u256.sub(Blockchain.blockNumber, this._deployBlock.value);
    return u256.div(elapsed, u256.fromU64(CYCLE_BLOCKS));
  }

  // Block bắt đầu của một cycle
  private _cycleStartBlock(cycle: u256): u256 {
    return u256.add(
      this._deployBlock.value,
      u256.mul(cycle, u256.fromU64(CYCLE_BLOCKS))
    );
  }

  // ─── Helper: settle các cycle đã kết thúc ─────────────────────────────────
  // Snapshot owner + revenue cho mỗi cycle đã qua nhưng chưa được settle

  private _settlePendingCycles(): void {
    const current = this._currentCycle();
    const lastSettled = this._lastSettledCycle.value;

    // Settle từng cycle chưa được settle (tối đa 10 cycle một lần để tránh gas overflow)
    let toSettle = lastSettled;
    let count: u8 = 0;

    while (u256.lt(toSettle, current) && count < 10) {
      this._settleCycle(toSettle);
      toSettle = u256.add(toSettle, u256.One);
      count++;
    }

    this._lastSettledCycle.value = toSettle;
  }

  // Snapshot tất cả slot owners + revenue tại thời điểm cycle kết thúc

  private _settleCycle(cycle: u256): void {
    // Revenue per slot cho cycle này
    const perSlot = u256.div(
      this._cycleRevenueAcc.value,
      u256.fromU64(MAX_SLOTS as u64)
    );

    // Lưu revenue per slot của cycle
    const cycleKey = cycle; // dùng cycle index làm key cho cycleRevenue map
    this.cycleRevenue.set(cycleKey, perSlot);

    // Snapshot owner của mỗi slot tại thời điểm cycle kết thúc
    for (let i: u16 = 0; i < MAX_SLOTS; i++) {
      const slotKey = u256.fromU64(i as u64);
      const ownerBytes = this.slotOwner.get(slotKey);

      if (ownerBytes !== null) {
        // key cho snapshot = cycle * 1000 + slotId
        const snapshotKey = u256.add(
          u256.mul(cycle, u256.fromU64(1000)),
          u256.fromU64(i as u64)
        );
        this.cycleSlotOwner.set(snapshotKey, ownerBytes!);
      }
    }

    // Reset accumulator cho cycle mới
    this._cycleRevenueAcc.value = u256.Zero;
  }

  // ─── Claim slot trống ──────────────────────────────────────────────────────

  private claimSlot(calldata: Calldata): BytesWriter {
    const slotId: u16 = calldata.readU16();
    const payAmount: u256 = calldata.readU256();

    assert(slotId < MAX_SLOTS, 'Invalid slot ID');

    const slotKey = u256.fromU64(slotId as u64);
    assert(this.slotOwner.get(slotKey) === null, 'Slot already owned — use takeoverSlot()');
    assert(u256.ge(payAmount, this._floorPrice.value), 'Below floor price');

    const currentCycle = this._currentCycle();
    const ownerBytes = u256.fromBytes(Blockchain.tx.sender.toBytes(), true);

    this.slotOwner.set(slotKey, ownerBytes);
    this.slotPrice.set(slotKey, payAmount);
    this.slotSinceCycle.set(slotKey, currentCycle);
    this.slotLastClaim.set(slotKey, currentCycle); // chưa có cycle hoàn chỉnh nào

    this.emitEvent(new SlotClaimedEvent(slotId, Blockchain.tx.sender, payAmount));

    const writer = new BytesWriter(1);
    writer.writeBoolean(true);
    return writer;
  }

  // ─── Takeover slot ─────────────────────────────────────────────────────────
  // Giữ nguyên chu kỳ thời gian từ deploy
  // Phí tích lũy cycle hiện tại: ai còn giữ slot khi cycle kết thúc mới nhận

  private takeoverSlot(calldata: Calldata): BytesWriter {
    const slotId: u16 = calldata.readU16();
    const payAmount: u256 = calldata.readU256();
    const newOwner: Address = Blockchain.tx.sender;

    assert(slotId < MAX_SLOTS, 'Invalid slot ID');

    const slotKey = u256.fromU64(slotId as u64);
    const existingOwnerBytes = this.slotOwner.get(slotKey);
    assert(existingOwnerBytes !== null, 'Slot is empty — use claimSlot()');

    const currentPrice = this.slotPrice.get(slotKey) || this._floorPrice.value;
    assert(u256.gt(payAmount, currentPrice!), 'Must pay more than current price');

    const oldOwner = Address.fromBytes(existingOwnerBytes!.toBytes());
    assert(!oldOwner.equals(newOwner), 'Already own this slot');

    // ── Hoàn tiền cho owner cũ ngay lập tức ──────────────────────────────────
    // Owner cũ nhận lại đúng số tiền người mới trả
    const oldOwnerKey = u256.fromBytes(oldOwner.toBytes(), true);
    const oldBalance = this.userBalance.get(oldOwnerKey) || u256.Zero;
    this.userBalance.set(oldOwnerKey, u256.add(oldBalance!, payAmount));

    this.emitEvent(new TakeoverRefundEvent(oldOwner, payAmount));

    // ── Phí cycle hiện tại: KHÔNG di chuyển gì ───────────────────────────────
    // Ai giữ slot lúc cycle kết thúc mới nhận
    // Nếu owner cũ đã giữ từ đầu cycle → khi cycle kết thúc và settle,
    // snapshot sẽ ghi nhận owner MỚI (vì owner đã thay đổi)
    // → owner mới nhận phí của phần còn lại của cycle này

    // ── Cập nhật slot ─────────────────────────────────────────────────────────
    const currentCycle = this._currentCycle();
    const newOwnerBytes = u256.fromBytes(newOwner.toBytes(), true);

    this.slotOwner.set(slotKey, newOwnerBytes);
    this.slotPrice.set(slotKey, payAmount);
    this.slotSinceCycle.set(slotKey, currentCycle);
    this.slotLastClaim.set(slotKey, currentCycle);

    this.emitEvent(new SlotTakenOverEvent(slotId, newOwner, oldOwner, payAmount, currentCycle));

    // Trả về cycle hiện tại + block kết thúc cycle này
    const cycleEndBlock = u256.add(
      this._cycleStartBlock(currentCycle),
      u256.fromU64(CYCLE_BLOCKS)
    );

    const writer = new BytesWriter(32 + 32);
    writer.writeU256(currentCycle);
    writer.writeU256(cycleEndBlock);
    return writer;
  }

  // ─── Receive Revenue từ MemeToken ─────────────────────────────────────────

  private receiveRevenue(calldata: Calldata): BytesWriter {
    const amount: u256 = calldata.readU256();

    const memeAddr = Address.fromBytes(this._memeToken.value.toBytes());
    assert(Blockchain.tx.sender.equals(memeAddr), 'Only MemeToken can send revenue');
    assert(u256.gt(amount, u256.Zero), 'Zero revenue');

    this._totalRevenue.value = u256.add(this._totalRevenue.value, amount);
    this._cycleRevenueAcc.value = u256.add(this._cycleRevenueAcc.value, amount);

    const perSlot = u256.div(amount, u256.fromU64(MAX_SLOTS as u64));
    const currentCycle = this._currentCycle();

    this.emitEvent(new RevenueReceivedEvent(currentCycle, amount, perSlot));

    const writer = new BytesWriter(1);
    writer.writeBoolean(true);
    return writer;
  }

  // ─── Claim Revenue ─────────────────────────────────────────────────────────
  // Nhận phí từ các cycle đã kết thúc mà user đang giữ slot

  private claimRevenue(): BytesWriter {
    const claimer: Address = Blockchain.tx.sender;
    const claimerKey = u256.fromBytes(claimer.toBytes(), true);
    const currentCycle = this._currentCycle();

    let totalClaim: u256 = u256.Zero;

    // Duyệt qua từng slot để tìm slot claimer đang giữ
    for (let i: u16 = 0; i < MAX_SLOTS; i++) {
      const slotKey = u256.fromU64(i as u64);
      const ownerBytes = this.slotOwner.get(slotKey);
      if (ownerBytes === null) continue;

      const owner = Address.fromBytes(ownerBytes!.toBytes());
      if (!owner.equals(claimer)) continue;

      // Claim từ cycle cuối đã claim đến cycle hiện tại - 1
      const lastClaim = this.slotLastClaim.get(slotKey) || u256.Zero;
      let fromCycle = u256.add(lastClaim!, u256.One);

      while (u256.lt(fromCycle, currentCycle)) {
        // Kiểm tra snapshot: claimer có phải owner của slot này tại cycle đó không?
        const snapshotKey = u256.add(
          u256.mul(fromCycle, u256.fromU64(1000)),
          u256.fromU64(i as u64)
        );
        const snapshotOwnerBytes = this.cycleSlotOwner.get(snapshotKey);

        if (snapshotOwnerBytes !== null) {
          const snapshotOwner = Address.fromBytes(snapshotOwnerBytes!.toBytes());
          if (snapshotOwner.equals(claimer)) {
            // Lấy revenue per slot của cycle đó
            const revenuePerSlot = this.cycleRevenue.get(fromCycle) || u256.Zero;
            if (u256.gt(revenuePerSlot!, u256.Zero)) {
              totalClaim = u256.add(totalClaim, revenuePerSlot!);
              this.emitEvent(new CycleRewardClaimedEvent(claimer, i, fromCycle, revenuePerSlot!));
            }
          }
        }

        fromCycle = u256.add(fromCycle, u256.One);
      }

      // Cập nhật last claim
      if (u256.gt(currentCycle, u256.Zero)) {
        this.slotLastClaim.set(slotKey, u256.sub(currentCycle, u256.One));
      }
    }

    // Cộng thêm balance từ các takeover refund
    const existingBalance = this.userBalance.get(claimerKey) || u256.Zero;
    totalClaim = u256.add(totalClaim, existingBalance!);

    assert(u256.gt(totalClaim, u256.Zero), 'Nothing to claim');

    // Reset balance
    this.userBalance.set(claimerKey, u256.Zero);

    // TODO: Transfer BTC/token về địa chỉ claimer thông qua OP_NET transfer API

    const writer = new BytesWriter(32);
    writer.writeU256(totalClaim);
    return writer;
  }

  // ─── View: Slot info ────────────────────────────────────────────────────────

  private getSlotInfo(calldata: Calldata): BytesWriter {
    const slotId: u16 = calldata.readU16();
    const slotKey = u256.fromU64(slotId as u64);

    const ownerBytes = this.slotOwner.get(slotKey);
    const price = this.slotPrice.get(slotKey) || this._floorPrice.value;
    const sinceCycle = this.slotSinceCycle.get(slotKey) || u256.Zero;
    const lastClaim = this.slotLastClaim.get(slotKey) || u256.Zero;
    const isEmpty = ownerBytes === null;
    const currentCycle = this._currentCycle();

    // Blocks còn lại đến hết cycle
    const cycleEndBlock = u256.add(
      this._cycleStartBlock(currentCycle),
      u256.fromU64(CYCLE_BLOCKS)
    );
    const blocksLeft = u256.gt(cycleEndBlock, Blockchain.blockNumber)
      ? u256.sub(cycleEndBlock, Blockchain.blockNumber)
      : u256.Zero;

    const writer = new BytesWriter(1 + 32 + 32 + 32 + 32 + 32 + 32 + 32);
    writer.writeBoolean(isEmpty);
    writer.writeU256(price!);
    writer.writeU256(sinceCycle!);
    writer.writeU256(lastClaim!);
    writer.writeU256(currentCycle);
    writer.writeU256(cycleEndBlock);
    writer.writeU256(blocksLeft);

    if (!isEmpty) {
      writer.writeAddress(Address.fromBytes(ownerBytes!.toBytes()));
    } else {
      writer.writeAddress(Address.dead());
    }

    return writer;
  }

  // ─── View: Cycle info ───────────────────────────────────────────────────────

  private getCurrentCycleInfo(): BytesWriter {
    const current = this._currentCycle();
    const startBlock = this._cycleStartBlock(current);
    const endBlock = u256.add(startBlock, u256.fromU64(CYCLE_BLOCKS));
    const blocksLeft = u256.gt(endBlock, Blockchain.blockNumber)
      ? u256.sub(endBlock, Blockchain.blockNumber)
      : u256.Zero;

    const writer = new BytesWriter(32 + 32 + 32 + 32 + 32);
    writer.writeU256(current);
    writer.writeU256(startBlock);
    writer.writeU256(endBlock);
    writer.writeU256(blocksLeft);
    writer.writeU256(this._cycleRevenueAcc.value); // phí đang tích lũy cycle này
    return writer;
  }

  private getCycleInfo(calldata: Calldata): BytesWriter {
    const cycle: u256 = calldata.readU256();
    const revenuePerSlot = this.cycleRevenue.get(cycle) || u256.Zero;
    const startBlock = this._cycleStartBlock(cycle);
    const endBlock = u256.add(startBlock, u256.fromU64(CYCLE_BLOCKS));

    const writer = new BytesWriter(32 + 32 + 32 + 32);
    writer.writeU256(cycle);
    writer.writeU256(startBlock);
    writer.writeU256(endBlock);
    writer.writeU256(revenuePerSlot!);
    return writer;
  }

  // ─── View: Pending revenue của một address ──────────────────────────────────

  private getPendingRevenue(calldata: Calldata): BytesWriter {
    const user: Address = calldata.readAddress();
    const currentCycle = this._currentCycle();
    let pending: u256 = u256.Zero;

    for (let i: u16 = 0; i < MAX_SLOTS; i++) {
      const slotKey = u256.fromU64(i as u64);
      const ownerBytes = this.slotOwner.get(slotKey);
      if (ownerBytes === null) continue;

      const owner = Address.fromBytes(ownerBytes!.toBytes());
      if (!owner.equals(user)) continue;

      const lastClaim = this.slotLastClaim.get(slotKey) || u256.Zero;
      let fromCycle = u256.add(lastClaim!, u256.One);

      while (u256.lt(fromCycle, currentCycle)) {
        const snapshotKey = u256.add(
          u256.mul(fromCycle, u256.fromU64(1000)),
          u256.fromU64(i as u64)
        );
        const snapshotOwnerBytes = this.cycleSlotOwner.get(snapshotKey);
        if (snapshotOwnerBytes !== null) {
          const snapshotOwner = Address.fromBytes(snapshotOwnerBytes!.toBytes());
          if (snapshotOwner.equals(user)) {
            const rev = this.cycleRevenue.get(fromCycle) || u256.Zero;
            pending = u256.add(pending, rev!);
          }
        }
        fromCycle = u256.add(fromCycle, u256.One);
      }
    }

    const writer = new BytesWriter(32);
    writer.writeU256(pending);
    return writer;
  }

  private getUserBalance(calldata: Calldata): BytesWriter {
    const user: Address = calldata.readAddress();
    const key = u256.fromBytes(user.toBytes(), true);
    const balance = this.userBalance.get(key) || u256.Zero;
    const writer = new BytesWriter(32);
    writer.writeU256(balance!);
    return writer;
  }

  private getSlotsByOwner(calldata: Calldata): BytesWriter {
    const user: Address = calldata.readAddress();
    const owned: u16[] = [];

    for (let i: u16 = 0; i < MAX_SLOTS; i++) {
      const slotKey = u256.fromU64(i as u64);
      const ownerBytes = this.slotOwner.get(slotKey);
      if (ownerBytes !== null) {
        const owner = Address.fromBytes(ownerBytes!.toBytes());
        if (owner.equals(user)) owned.push(i);
      }
    }

    const writer = new BytesWriter(2 + owned.length * 2);
    writer.writeU16(owned.length as u16);
    for (let i = 0; i < owned.length; i++) {
      writer.writeU16(owned[i]);
    }
    return writer;
  }
}
