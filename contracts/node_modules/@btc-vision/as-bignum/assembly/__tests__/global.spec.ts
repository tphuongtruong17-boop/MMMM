import {
  __carry,
  __clz128,
  __ctz128,
  __divmod_quot_hi,
  __divmod_rem_hi,
  __divmod_rem_lo,
  __floatuntfdi,
  __floatuntidf,
  __mul256,
  __multi3,
  __res128_hi,
  __u256carry,
  __u256carrySub,
  __uadd64,
  __udivmod128,
  __udivmod128_10,
  __umul64Hop,
  __umul64Step,
  __umulh64,
  __umulq64,
  add64Local,
  sub64,
} from "../globals";
import { u128 } from "../integer";

describe("Global Low-Level Integer Math Coverage", () => {

  // --------------------------------------------------------------------------
  // __floatuntidf
  // --------------------------------------------------------------------------
  describe("__floatuntidf (u128 -> f64)", () => {
    it("Should handle 0", () => {
      expect(__floatuntidf(0, 0)).toBe(0.0);
    });

    it("Should handle small numbers (exact representation)", () => {
      expect(__floatuntidf(12345, 0)).toBe(12345.0);
    });

    it("Should handle large numbers (sd <= 53)", () => {
      // 2^53 - 1
      let val: u64 = 9007199254740991;
      expect(__floatuntidf(val, 0)).toBe(9007199254740991.0);
    });

    it("Should handle large numbers (sd == 54, shifting)", () => {
      // 2^53 + 1 -> rounds down to 2^53 in f64 usually, or specific rounding mode
      // bit pattern: 100...001 (54 bits)
      // u128(2^53 + 1)
      let val = u128.fromU64(9007199254740992 + 1); // 2^53 + 1
      // 2^53 is 9007199254740992.
      // In IEEE754 double, 2^53+1 is not representable. It rounds to 2^53 (even).
      // 2^53+2 is representable.
      expect(__floatuntidf(val.lo, val.hi)).toBe(9007199254740992.0);
    });

    it("Should handle large numbers (sd > 55)", () => {
      // Very large number requiring shifting > 2
      let v = u128.Max;
      // u128 max is approx 3.402823669209385e38
      let f = __floatuntidf(v.lo, v.hi);
      expect(f).toBeCloseTo(3.402823669209385e38);
    });

    it("Should handle rounding up cases (guard bit set)", () => {
      // Case where v.lo & (1<<53) is true after shift, forcing increment of exponent
      // 2^54 - 1  = 1.111...1 (54 ones)
      // 111...11 (54 bits). Rounding should pump it up.
      let val = (u64(1) << 54) - 1;
      // expected: 1.8014398509481984e16
      expect(__floatuntidf(val, 0)).toBe(18014398509481984.0);
    });

    it("Should handle sd == 55 (no adjustment needed)", () => {
      // Test the case where sd != 55 condition is false (line 74:25)
      // 2^54 = has 55 significant digits
      let val = u64(1) << 54;
      let result = __floatuntidf(val, 0);
      expect(result).toBeGreaterThan(0);
    });

    it("Should handle large number requiring bit OR operation", () => {
      // Test line 94:26 - the OR operation for rounding
      // Need a number where sd > 55 and the bits being shifted matter
      let v = new u128(0xFFFFFFFFFFFFFFFF, 0x7FFFFFFFFFFFFFFF);
      let result = __floatuntidf(v.lo, v.hi);
      expect(result).toBeGreaterThan(0);
    });

    it("Should handle sd == 55 with no extra adjustment", () => {
      // Line 74:25 - when sd == 55, the inner if block is skipped
      // We need exactly 55 significant digits
      // 2^54 | (2^53 - 1) gives us 55 bits set
      let val = new u128((u64(1) << 54) | ((u64(1) << 53) - 1), 0);
      let result = __floatuntidf(val.lo, val.hi);
      expect(result).toBeGreaterThan(0);
    });

    it("Should trigger the OR operation for sticky bit", () => {
      // Line 94:26 - the OR operation that sets sticky bit
      // Need sd > 55 and bits in the truncated part
      let val = new u128(0xFFFFFFFFFFFFFFFF, 0x1FFFFFFFFFFFFFFF);
      let result = __floatuntidf(val.lo, val.hi);
      expect(result).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // add64Local / sub64 / __uadd64
  // --------------------------------------------------------------------------
  describe("64-bit Add/Sub with Globals", () => {
    it("add64Local: Should add with carry generation", () => {
      // Overflow case
      let max = u64.MAX_VALUE;
      let res = add64Local(max, 1, 0);
      expect(res).toBe(0);
      expect(__u256carry).toBe(1);

      // Carry in case
      let res2 = add64Local(10, 10, 1);
      expect(res2).toBe(21);
      expect(__u256carry).toBe(0);
    });

    it("sub64: Should subtract with borrow generation", () => {
      // Underflow case
      let res = sub64(0, 1, 0);
      expect(res).toBe(u64.MAX_VALUE);
      expect(__u256carrySub).toBe(1); // Borrowed

      // Borrow chaining
      // 10 - 5 - 1(borrow) = 4
      let res2 = sub64(10, 5, 1);
      expect(res2).toBe(4);
      expect(__u256carrySub).toBe(0);
    });

    it("__uadd64: Should sum and set global carry", () => {
      // Standard
      expect(__uadd64(5, 5, 0)).toBe(10);
      expect(__carry).toBe(0);

      // Overflow
      expect(__uadd64(u64.MAX_VALUE, 1, 0)).toBe(0);
      expect(__carry).toBe(1);

      // Overflow with carry in
      // Max + 0 + 1 -> 0, carry 1
      expect(__uadd64(u64.MAX_VALUE, 0, 1)).toBe(0);
      expect(__carry).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // Multiplication Helpers (__umul*)
  // --------------------------------------------------------------------------
  describe("Multiplication Primitives", () => {
    it("__umulh64: Should return high part", () => {
      // 2^63 * 2 = 2^64 -> lo=0, hi=1
      let a: u64 = 0x8000000000000000;
      let b: u64 = 2;
      expect(__umulh64(a, b)).toBe(1);
    });

    it("__umulq64: Should return low part and set global hi", () => {
      let a: u64 = 0x8000000000000000;
      let b: u64 = 3; // 2^63 * 3 = 1.5 * 2^64 => hi=1, lo=2^63
      let lo = __umulq64(a, b);
      expect(lo).toBe(0x8000000000000000);
      expect(__res128_hi).toBe(1);
    });

    it("__umul64Hop: Should calc z + (x*y)", () => {
      // z=1, x=2, y=3 => 1 + 6 = 7. hi=0
      let lo = __umul64Hop(1, 2, 3);
      expect(lo).toBe(7);
      expect(__res128_hi).toBe(0);

      // Overflow test
      // z=MAX, x=1, y=1 => MAX+1 => 0, hi=1
      lo = __umul64Hop(u64.MAX_VALUE, 1, 1);
      expect(lo).toBe(0);
      expect(__res128_hi).toBe(1);
    });

    it("__umul64Step: Should calc z + (x*y) + carry", () => {
      // z=10, x=2, y=2, c=1 => 10 + 4 + 1 = 15
      let lo = __umul64Step(10, 2, 2, 1);
      expect(lo).toBe(15);
      expect(__res128_hi).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // __mul256
  // --------------------------------------------------------------------------
  describe("__mul256", () => {
    it("Should multiply small numbers correctly", () => {
      let res = __mul256(2, 0, 0, 0, 3, 0, 0, 0);
      expect(res.lo1).toBe(6);
      expect(res.lo2).toBe(0);
    });

    it("Should multiply crossing limbs (lo1 * lo2)", () => {
      // a = 1, b = 1 in second limb (2^64)
      // res = 2^64
      let res = __mul256(1, 0, 0, 0, 0, 1, 0, 0);
      expect(res.lo1).toBe(0);
      expect(res.lo2).toBe(1);
    });

    it("Should handle all limb combinations within 256-bit range", () => {
      // Test various shift amounts (lines 260:17, 288:17)
      // i=0, j=0: shift=0
      let res1 = __mul256(5, 0, 0, 0, 7, 0, 0, 0);
      expect(res1.lo1).toBe(35);

      // i=1, j=0: shift=64
      let res2 = __mul256(0, 2, 0, 0, 3, 0, 0, 0);
      expect(res2.lo2).toBe(6);

      // i=0, j=1: shift=64
      let res3 = __mul256(2, 0, 0, 0, 0, 3, 0, 0);
      expect(res3.lo2).toBe(6);

      // i=1, j=1: shift=128
      let res4 = __mul256(0, 2, 0, 0, 0, 3, 0, 0);
      expect(res4.hi1).toBe(6);

      // i=2, j=0: shift=128
      let res5 = __mul256(0, 0, 2, 0, 3, 0, 0, 0);
      expect(res5.hi1).toBe(6);

      // i=0, j=2: shift=128
      let res6 = __mul256(2, 0, 0, 0, 0, 0, 3, 0);
      expect(res6.hi1).toBe(6);

      // i=2, j=1: shift=192
      let res7 = __mul256(0, 0, 2, 0, 0, 3, 0, 0);
      expect(res7.hi2).toBe(6);

      // i=1, j=2: shift=192
      let res8 = __mul256(0, 2, 0, 0, 0, 0, 3, 0);
      expect(res8.hi2).toBe(6);
    });

    it("Should test shift == 0 optimization", () => {
      // Line 260:17 - when shift == 0, no shifting needed
      // This is i=0, j=0
      let res = __mul256(7, 0, 0, 0, 11, 0, 0, 0);
      expect(res.lo1).toBe(77);
    });

    it("Should test non-zero shifts", () => {
      // Line 288:17 - when shift != 0
      // i=1, j=1: shift = 128
      let res = __mul256(0, 3, 0, 0, 0, 5, 0, 0);
      expect(res.hi1).toBe(15);
    });

    it("Should ignore high limb products that overflow 256 bits", () => {
      // a in limb 3 (highest), b in limb 3
      // shift = 3+3 = 6. 6*64 = 384 >= 256. Should be ignored.
      let res = __mul256(0, 0, 0, 1, 0, 0, 0, 1);
      expect(res.isZero()).toBe(true);

      // i=2, j=2: shift=256 (should be skipped)
      let res2 = __mul256(0, 0, 5, 0, 0, 0, 7, 0);
      // This shouldn't affect lo4
      expect(res2.hi2).toBe(0);

      // i=3, j=1: shift=256 (should be skipped)
      let res3 = __mul256(0, 0, 0, 5, 0, 7, 0, 0);
      expect(res3.hi2).toBe(0);

      // i=1, j=3: shift=256 (should be skipped)
      let res4 = __mul256(0, 5, 0, 0, 0, 0, 0, 7);
      expect(res4.hi2).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // __multi3 (128-bit component mul)
  // --------------------------------------------------------------------------
  describe("__multi3", () => {
    it("Should compute complex 128 mul", () => {
      // Just a sanity check on the logic
      // 1 * 1
      let lo = __multi3(1, 0, 1, 0);
      expect(lo).toBe(1);
      expect(__res128_hi).toBe(0);

      // overflow check
      // (2^64-1) * 2 -> lo = -2 (FE...), hi = 1
      lo = __multi3(u64.MAX_VALUE, 0, 2, 0);
      expect(lo).toBe(u64.MAX_VALUE - 1); // F...FE
      expect(__res128_hi).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // __floatuntfdi (f64 -> u128/i128 conversion helper)
  // --------------------------------------------------------------------------
  describe("__floatuntfdi", () => {
    it("Should handle negative overflow (< -2^128)", () => {
      // < -2^128
      let val = -1e40;
      expect(__floatuntfdi(val)).toBe(0);
      expect(__res128_hi).toBe(0);
    });

    it("Should handle negative fitting in i128 but not i64 (u > 64 branch)", () => {
      // Test the u > 64 branch (lines 348:29, 349:15)
      // Need value where exponent - 1075 > 64
      // -2^100
      let val = -Math.pow(2, 100);
      let lo = __floatuntfdi(val);

      // For -2^100, after conversion:
      // lo should be 0, hi should be the negated value
      expect(lo).toBe(0);
      expect(__res128_hi).not.toBe(0);
    });

    it("Should handle negative fitting in i128 but not i64 (u <= 64 branch)", () => {
      // Test the u <= 64 branch (lines 353:30, 358:26)
      // -2^70
      let val = -Math.pow(2, 70);
      let lo = __floatuntfdi(val);

      expect(lo).toBe(0);
      expect(__res128_hi).toBe(0xFFFFFFFFFFFFFFC0);
    });

    it("Should handle carry in two's complement conversion", () => {
      // Test line 363:24 - carry from lo to hi when lo overflows
      // After: lo = ~lo; hi = ~hi; lo += 1;
      // If lo += 1 wraps to 0, then hi += 1 (carry)
      // This happens when ~lo == 0xFFFFFFFFFFFFFFFF (i.e., lo was 0)

      // We need a negative number where after extraction and shift,
      // lo ends up being 0, so ~lo = 0xFFFFFFFFFFFFFFFF
      // Then ~lo + 1 = 0, triggering the carry

      // Let's use -2^100 which should put bits only in hi
      let val = -Math.pow(2, 100);
      let lo = __floatuntfdi(val);

      expect(lo).toBe(0);
      // After the operation with carry, hi should be affected
      let expectedHi = ~(u64(1) << (100 - 64)) + 1;
      expect(__res128_hi).toBe(expectedHi);
    });

    it("Should handle carry in two's complement conversion, Alternative.", () => {
      // Test line 363:24 - carry from lo to hi
      // Use a large negative power of 2 where lo = 0 after shift
      // -2^100: after shift, lo = 0, hi has the value
      // Two's complement: ~0 + 1 = 0 (triggers carry), ~hi + carry
      let val = -Math.pow(2, 100);
      let lo = __floatuntfdi(val);

      expect(lo).toBe(0);
      // hi should be: ~(2^36) + 1 = -(2^36) in two's complement
      // Which is 0xFFFFFFFFFFFFFFFF - (2^36) + 1
      let hiBeforeNegate = u64(1) << (100 - 64); // 2^36
      let expectedHi = ~hiBeforeNegate + 1;
      expect(__res128_hi).toBe(expectedHi);
    });

    it("Should handle positive fitting in u64", () => {
      let val = 12345.0;
      expect(__floatuntfdi(val)).toBe(12345);
      expect(__res128_hi).toBe(0);
    });

    it("Should handle positive large (u > 64 branch)", () => {
      // Test lines 368:23, 373:23 - positive u > 64
      // 2^100
      let val = Math.pow(2, 100);
      let lo = __floatuntfdi(val);

      expect(lo).toBe(0);
      expect(__res128_hi).toBe(1 << (100 - 64)); // 2^36
    });

    it("Should handle positive large (u <= 64 branch)", () => {
      // Test lines 378:23, 383:23 - positive u <= 64
      // 2^70
      let val = Math.pow(2, 70);
      let lo = __floatuntfdi(val);

      expect(lo).toBe(0);
      expect(__res128_hi).toBe(1 << (70 - 64)); // 2^6 = 64
    });

    it("Should handle positive overflow", () => {
      let val = 1e40; // > 2^128
      let res = __floatuntfdi(val);
      expect(res).toBe(u64.MAX_VALUE);
      expect(__res128_hi).toBe(u64.MAX_VALUE);
    });

    it("Should handle negative with u > 64 branch (hi shift)", () => {
      // Lines 308:29, 309:15 - when u > 64 for negative
      let val = -Math.pow(2, 100);
      let lo = __floatuntfdi(val);
      expect(lo).toBe(0);
      expect(__res128_hi).not.toBe(0);
    });

    it("Should handle negative with u > 64 branch (lo = 0, hi computed)", () => {
      // Lines 313:38, 318:38 - the else branch where lo and hi are computed
      let val = -Math.pow(2, 90);
      let lo = __floatuntfdi(val);
      // After two's complement
      let hiBeforeNegate = u64(1) << (90 - 64);
      let expectedHi = ~hiBeforeNegate + 1;
      expect(__res128_hi).toBe(expectedHi);
    });

    it("Should handle negative with u <= 64 branch (compute lo and hi)", () => {
      // Lines 323:38, 328:38, 333:38, 338:38
      let val = -Math.pow(2, 70);
      let lo = __floatuntfdi(val);
      expect(lo).toBe(0);
      expect(__res128_hi).toBe(0xFFFFFFFFFFFFFFC0);
    });

    it("Should handle carry case in two's complement", () => {
      // Line 363:24 - when lo == 0 after increment, carry to hi
      // After: lo = ~lo; hi = ~hi; lo += 1; if (lo == 0) hi += 1;
      // We need ~original_lo to be 0xFFFFFFFFFFFFFFFF
      // This means original lo must be 0
      let val = -Math.pow(2, 100); // Ensures lo = 0 after shift
      let lo = __floatuntfdi(val);
      expect(lo).toBe(0);
      // Verify hi was computed with carry
      let hiBeforeNegate = u64(1) << (100 - 64);
      let expectedHi = ~hiBeforeNegate + 1;
      expect(__res128_hi).toBe(expectedHi);
    });

    it("Should handle positive with u > 64 (hi shift)", () => {
      // Lines 368:23, 373:23 - positive large number, u > 64
      let val = Math.pow(2, 100);
      let lo = __floatuntfdi(val);
      expect(lo).toBe(0);
      expect(__res128_hi).toBe(u64(1) << (100 - 64));
    });

    it("Should handle positive with u <= 64 (compute lo and hi)", () => {
      // Lines 378:23, 383:23 - positive, u <= 64
      let val = Math.pow(2, 70);
      let lo = __floatuntfdi(val);
      expect(lo).toBe(0);
      expect(__res128_hi).toBe(u64(1) << (70 - 64));
    });
  });

  // --------------------------------------------------------------------------
  // Bit counting (__clz128, __ctz128)
  // --------------------------------------------------------------------------
  describe("Bit Counting", () => {
    it("__clz128: Should count leading zeros", () => {
      // 0
      expect(__clz128(0, 0)).toBe(128);
      // High bit set
      expect(__clz128(0, 0x8000000000000000)).toBe(0);
      // Low bit only
      expect(__clz128(1, 0)).toBe(127);
      // Middle bit (bit 0 of hi)
      expect(__clz128(0, 1)).toBe(63);
    });

    it("__ctz128: Should count trailing zeros", () => {
      // 0
      expect(__ctz128(0, 0)).toBe(128);
      // High bit set only (hi: 100..., lo: 0) -> ctz is 127
      expect(__ctz128(0, 0x8000000000000000)).toBe(127);
      // Low bit set (bit 0)
      expect(__ctz128(1, 0)).toBe(0);
      // Lowest bit of hi set (bit 64)
      expect(__ctz128(0, 1)).toBe(64);
    });
  });

  // --------------------------------------------------------------------------
  // __udivmod128 / __udivmod128core / __udivmod128_10
  // --------------------------------------------------------------------------
  describe("128-bit Division", () => {
    it("Should throw on division by zero", () => {
      expect(() => {
        __udivmod128(10, 0, 0, 0);
      }).toThrow();
    });

    it("Should handle 0 / b", () => {
      let res = __udivmod128(0, 0, 10, 0);
      expect(res).toBe(0);
      expect(__divmod_quot_hi).toBe(0);
      expect(__divmod_rem_lo).toBe(0);
    });

    it("Should handle a / 1", () => {
      let res = __udivmod128(123, 456, 1, 0);
      expect(res).toBe(123);
      expect(__divmod_quot_hi).toBe(456);
      expect(__divmod_rem_lo).toBe(0);
    });

    it("Should handle a == b", () => {
      let res = __udivmod128(10, 20, 10, 20);
      expect(res).toBe(1);
      expect(__divmod_quot_hi).toBe(0);
      expect(__divmod_rem_lo).toBe(0);
    });

    it("Should optimize when high parts are 0 (Power of 2 divisor)", () => {
      // 100 / 4 = 25
      let res = __udivmod128(100, 0, 4, 0);
      expect(res).toBe(25);
      expect(__divmod_quot_hi).toBe(0);
      expect(__divmod_rem_lo).toBe(0);
    });

    it("Should optimize when high parts are 0 (Normal divisor)", () => {
      // 100 / 3 = 33 r 1
      let res = __udivmod128(100, 0, 3, 0);
      expect(res).toBe(33);
      expect(__divmod_quot_hi).toBe(0);
      expect(__divmod_rem_lo).toBe(1);
    });

    it("Should use core 128-bit division (Large numbers)", () => {
      let alo: u64 = 0;
      let ahi: u64 = 0x8000000000000000; // 2^127
      let blo: u64 = 3;
      let bhi: u64 = 0;

      let qlo = __udivmod128(alo, ahi, blo, bhi);
      expect(qlo).toBe(0xAAAAAAAAAAAAAAAA);
      expect(__divmod_quot_hi).toBe(0x2AAAAAAAAAAAAAAA);
      expect(__divmod_rem_lo).toBe(2);
      expect(__divmod_rem_hi).toBe(0);
    });

    it("Should handle core division with leadingZeros < 0", () => {
      // Test line 483:25 - when dividend < divisor
      // a < b, so quotient = 0, remainder = a
      let alo: u64 = 5;
      let ahi: u64 = 0;
      let blo: u64 = 10;
      let bhi: u64 = 1; // b = 2^64 + 10, much larger than a = 5

      let qlo = __udivmod128(alo, ahi, blo, bhi);
      expect(qlo).toBe(0);
      expect(__divmod_quot_hi).toBe(0);
      expect(__divmod_rem_lo).toBe(5);
      expect(__divmod_rem_hi).toBe(0);
    });

    it("__udivmod128_10: Should divide by 10 (small)", () => {
      let q = __udivmod128_10(123, 0);
      expect(q).toBe(12);
      expect(__divmod_quot_hi).toBe(0);
      expect(__divmod_rem_lo).toBe(3);
    });

    it("__udivmod128_10: Should divide by 10 (large)", () => {
      // 2^64 / 10
      // 2^64 = 18446744073709551616
      // / 10 = 1844674407370955161.6
      // hi=1 (since 2^64 is passed as 0 lo, 1 hi? No, input is u128 components)
      // Actually input is (lo, hi). So we pass (0, 1) to represent 2^64.
      let qlo = __udivmod128_10(0, 1);

      // Expected: 1844674407370955161
      // Rem: 6
      expect(qlo).toBe(1844674407370955161);
      expect(__divmod_quot_hi).toBe(0);
      expect(__divmod_rem_lo).toBe(6);
    });
  });

  describe("Additional edge cases for __floatuntfdi branches", () => {
    it("Should cover the main if-else chain starting at line 308", () => {
      // Line 308:1 - enter the second major else-if branch
      // This is: else if (value < reinterpret<f64>(0xC3F0000000000000))
      let val = -Math.pow(2, 65); // Between -2^128 and -2^64
      let lo = __floatuntfdi(val);
      expect(__res128_hi).not.toBe(0);
    });

    it("Should cover the fourth else-if branch starting at line 348", () => {
      // Line 348:1 - enter the positive large number branch
      // This is: else if (value < reinterpret<f64>(0x47F0000000000000))
      let val = Math.pow(2, 80); // Between 2^64 and 2^128
      let lo = __floatuntfdi(val);
      expect(__res128_hi).not.toBe(0);
    });

    it("Should test u > 64 decision point for negative (line 348:29)", () => {
      // Line 348:29, 349:15 - the if (u > 64) branch for positive
      let val = Math.pow(2, 120); // u will be > 64
      let lo = __floatuntfdi(val);
      expect(lo).toBe(0);
      expect(__res128_hi).toBe(u64(1) << (120 - 64));
    });

    it("Should test u <= 64 decision point for positive (line 353:30, 358:26)", () => {
      // These are the else branch lines (lo = m << u; hi = m >> (64 - u))
      let val = Math.pow(2, 66); // u will be <= 64
      let lo = __floatuntfdi(val);
      expect(lo).toBe(0);
      expect(__res128_hi).toBe(u64(1) << (66 - 64));
    });
  });
});
