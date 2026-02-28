import { u256 } from "../integer";

describe("u256 Coverage", () => {
  // --------------------------------------------------------------------------
  // Constants & Basic Construction
  // --------------------------------------------------------------------------
  describe("Constants", () => {
    it("Should have correct Zero", () => {
      let z = u256.Zero;
      expect(z.lo1).toBe(0);
      expect(z.lo2).toBe(0);
      expect(z.hi1).toBe(0);
      expect(z.hi2).toBe(0);
    });

    it("Should have correct One", () => {
      let o = u256.One;
      expect(o.lo1).toBe(1);
      expect(o.hi2).toBe(0);
    });

    it("Should have correct Max", () => {
      let m = u256.Max;
      expect(m.lo1).toBe(u64.MAX_VALUE);
      expect(m.lo2).toBe(u64.MAX_VALUE);
      expect(m.hi1).toBe(u64.MAX_VALUE);
      expect(m.hi2).toBe(u64.MAX_VALUE);
    });
  });

  // --------------------------------------------------------------------------
  // Arithmetic: Add / Sub
  // --------------------------------------------------------------------------
  describe("Addition", () => {
    it("Should add simple numbers", () => {
      let a = u256.fromU64(10);
      let b = u256.fromU64(20);
      let c = a + b;
      expect(c.lo1).toBe(30);
    });

    it("Should carry over 64-bit boundary (lo1 -> lo2)", () => {
      let a = new u256(u64.MAX_VALUE, 0, 0, 0);
      let b = u256.fromU64(1);
      let c = a + b;
      expect(c.lo1).toBe(0);
      expect(c.lo2).toBe(1);
    });

    it("Should carry over 128-bit boundary (lo2 -> hi1)", () => {
      let a = new u256(0, u64.MAX_VALUE, 0, 0);
      let b = new u256(0, 1, 0, 0);
      let c = a + b;
      expect(c.lo2).toBe(0);
      expect(c.hi1).toBe(1);
    });

    it("Should carry over 192-bit boundary (hi1 -> hi2)", () => {
      let a = new u256(0, 0, u64.MAX_VALUE, 0);
      let b = new u256(0, 0, 1, 0);
      let c = a + b;
      expect(c.hi1).toBe(0);
      expect(c.hi2).toBe(1);
    });

    it("Should overflow max (wrap around)", () => {
      let max = u256.Max;
      let one = u256.One;
      let c = max + one;
      expect(c.isZero()).toBe(true);
    });
  });

  describe("Subtraction", () => {
    it("Should subtract simple numbers", () => {
      let a = u256.fromU64(30);
      let b = u256.fromU64(10);
      let c = a - b;
      expect(c.lo1).toBe(20);
    });

    it("Should borrow across 64-bit boundary", () => {
      let a = new u256(0, 1, 0, 0); // 2^64
      let b = u256.fromU64(1);
      let c = a - b;
      expect(c.lo1).toBe(u64.MAX_VALUE);
      expect(c.lo2).toBe(0);
    });

    it("Should underflow (wrap around)", () => {
      let zero = u256.Zero;
      let one = u256.One;
      let c = zero - one;
      expect(c == u256.Max).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Multiplication
  // --------------------------------------------------------------------------
  describe("Multiplication", () => {
    it("Should multiply simple numbers", () => {
      let a = u256.fromU64(10);
      let b = u256.fromU64(10);
      let c = a * b;
      expect(c.lo1).toBe(100);
    });

    it("Should handle full 256-bit precision", () => {
      // 2^128 * 2^127 = 2^255
      let x = new u256(0, 1, 0, 0);
      let y = new u256(0, 1, 0, 0);
      let z = x * y;
      expect(z.lo1).toBe(0);
      expect(z.lo2).toBe(0);
      expect(z.hi1).toBe(1); // 2^128
      expect(z.hi2).toBe(0);
    });

    it("Should overflow correctly", () => {
      let max = u256.Max;
      let two = u256.fromU64(2);
      let res = max * two;
      expect(res.lo1).toBe(u64.MAX_VALUE - 1);
      expect(res.lo2).toBe(u64.MAX_VALUE);
      expect(res.hi1).toBe(u64.MAX_VALUE);
      expect(res.hi2).toBe(u64.MAX_VALUE);
    });
  });

  // --------------------------------------------------------------------------
  // Division
  // --------------------------------------------------------------------------
  describe("Division", () => {
    it("Should throw on division by zero", () => {
      expect(() => {
        let a = u256.fromU64(10);
        let b = u256.Zero;
        let c = a / b;
      }).toThrow();
    });

    it("Should handle a < b (return 0)", () => {
      let a = u256.fromU64(5);
      let b = u256.fromU64(10);
      expect((a / b).isZero()).toBe(true);
    });

    it("Should handle a == b (return 1)", () => {
      let a = u256.fromU64(123);
      let b = u256.fromU64(123);
      expect((a / b) == u256.One).toBe(true);
    });

    it("Should divide large numbers", () => {
      // 2^255 / 2^128 = 2^127
      let a = new u256(0, 0, 0, 0x8000000000000000);
      let b = new u256(0, 0, 1, 0); // 2^128
      let c = a / b;
      expect(c.lo2).toBe(0x8000000000000000);
      expect(c.hi1).toBe(0);
    });

    it("Should handle Max / Max", () => {
      let c = u256.Max / u256.Max;
      expect(c == u256.One).toBe(true);
    });

    it("Should handle Max / 1", () => {
      let c = u256.Max / u256.One;
      expect(c == u256.Max).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Bitwise Logic
  // --------------------------------------------------------------------------
  describe("Bitwise ops", () => {
    it("OR", () => {
      let a = u256.fromBits(0xF0F0F0F0, 0, 0, 0, 0, 0, 0, 0);
      let b = u256.fromBits(0x0F0F0F0F, 0, 0, 0, 0, 0, 0, 0);
      let c = a | b;
      expect(c.lo1).toBe(0xFFFFFFFF);
    });

    it("AND", () => {
      let a = u256.fromBits(0xF0F0F0F0, 0, 0, 0, 0, 0, 0, 0);
      let b = u256.fromBits(0x0F0F0F0F, 0, 0, 0, 0, 0, 0, 0);
      let c = a & b;
      expect(c.lo1).toBe(0);
    });

    it("XOR", () => {
      let a = u256.fromBits(0xF0F0F0F0, 0, 0, 0, 0, 0, 0, 0);
      let b = u256.fromBits(0x0F0F0F0F, 0, 0, 0, 0, 0, 0, 0);
      let c = a ^ b;
      expect(c.lo1).toBe(0xFFFFFFFF);
    });

    it("NOT", () => {
      let z = u256.Zero;
      let n = ~z;
      expect(n == u256.Max).toBe(true);
    });
  });

  describe("Shifts", () => {
    it("Left shift (<<)", () => {
      let val = u256.One;
      let s1 = val << 64;
      expect(s1.lo1).toBe(0);
      expect(s1.lo2).toBe(1);

      let s2 = val << 256;
      expect(s2.isZero()).toBe(true);

      let s3 = val << 33;
      expect(s3.lo1).toBe(8589934592); // 1 << 33
    });

    it("Left shift Edge Case: shift by 0", () => {
      let val = u256.One;
      let s = val << 0;
      expect(s == val).toBe(true);
    });

    it("Right shift (>>)", () => {
      let val = new u256(0, 1, 0, 0); // 2^64
      let s1 = val >> 64;
      expect(s1.lo1).toBe(1);
      expect(s1.lo2).toBe(0);

      let s2 = val >> 65;
      expect(s2.lo1).toBe(0);
    });

    it("Right shift Edge Case: shift by 0", () => {
      let val = u256.Max;
      let s = val >> 0;
      expect(s == val).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Comparison
  // --------------------------------------------------------------------------
  describe("Comparison", () => {
    it("eq/ne", () => {
      let small = u256.fromU64(10);
      let big = u256.fromU64(20);
      expect(small == small).toBe(true);
      expect(small != big).toBe(true);
    });

    it("lt/gt/le/ge", () => {
      let small = u256.fromU64(10);
      let big = u256.fromU64(20);
      expect(small < big).toBe(true);
      expect(big > small).toBe(true);
      expect(small <= small).toBe(true);
      expect(big >= small).toBe(true);
      expect(big < small).toBe(false);
    });

    it("isZero / isEmpty", () => {
      expect(u256.Zero.isZero()).toBe(true);
      expect(!u256.Zero).toBe(true);
      expect(u256.One.isZero()).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Conversions & Parsing
  // --------------------------------------------------------------------------
  describe("Conversions", () => {
    it("toString(10)", () => {
      let v = u256.fromU64(12345);
      expect(v.toString()).toBe("12345");
    });

    it("toString(16)", () => {
      let v = u256.fromU64(255);
      expect(v.toString(16)).toBe("ff");

      let v2 = new u256(0, 0, 0, 0x10);
      expect(v2.toString(16).startsWith("10000000")).toBe(true);
    });

    it("fromString", () => {
      let s = "123456789";
      let v = u256.fromString(s);
      expect(v.lo1).toBe(123456789);

      let h = "DeadBeef";
      let vh = u256.fromString(h, 16);
      expect(vh.lo1).toBe(0xDEADBEEF);
    });

    it("fromBytes (LE/BE)", () => {
      let bytes = new Uint8Array(32);
      bytes[0] = 1;
      let vLE = u256.fromBytes(bytes, false); // LE
      expect(vLE.lo1).toBe(1);

      let bytes2 = new Uint8Array(32);
      bytes2[31] = 1;
      let vBE = u256.fromBytes(bytes2, true); // BE
      expect(vBE.lo1).toBe(1);
    });

    it("fromBytes: Should throw on invalid length", () => {
      expect(() => {
        let bytes = new Uint8Array(31); // Too short
        u256.fromBytes(bytes, false);
      }).toThrow();

      expect(() => {
        let bytes2 = new Uint8Array(33); // Too long
        u256.fromBytes(bytes2, false);
      }).toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------
  describe("Helpers", () => {
    it("popcnt", () => {
      let v = u256.fromU64(3); // 11 binary
      expect(u256.popcnt(v)).toBe(2);
      expect(u256.popcnt(u256.Zero)).toBe(0);
    });

    it("clz", () => {
      let v = u256.One; // 00...01 (255 zeros)
      expect(u256.clz(v)).toBe(255);
      expect(u256.clz(u256.Zero)).toBe(256);
    });

    it("ctz", () => {
      let v = new u256(0, 1, 0, 0); // 2^64. bit 64 is set.
      expect(u256.ctz(v)).toBe(64);
      expect(u256.ctz(u256.Zero)).toBe(256);
    });

    it("Unary operators", () => {
      let v = u256.fromU64(1);
      let neg = -v; // Two's complement
      expect(neg == u256.Max).toBe(true);

      let copy = v.clone();
      copy++;
      expect(copy.lo1).toBe(2);

      copy--;
      expect(copy.lo1).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // Signed Integer Creation Edge Cases (Sign Extension)
  // --------------------------------------------------------------------------
  describe("Signed Integer Creation", () => {
    it("fromI64: Should sign extend negative values", () => {
      let v = u256.fromI64(-2);
      // -2 in two's complement is ...11110.
      // lo1 should be u64.MAX - 1.
      expect(v.lo1).toBe(u64.MAX_VALUE - 1);
      expect(v.lo2).toBe(u64.MAX_VALUE);
      expect(v.hi1).toBe(u64.MAX_VALUE);
      expect(v.hi2).toBe(u64.MAX_VALUE);
    });

    it("fromI32: Should sign extend negative values", () => {
      let v = u256.fromI32(-1);
      // -1 is all 1s
      expect(v == u256.Max).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Generic `as<T>` and `from<T>`
  // --------------------------------------------------------------------------
  describe("Generic casts", () => {
    it("Should cast to basic types", () => {
      let v = u256.fromU64(100);
      expect(v.as<u64>()).toBe(100);
      expect(v.as<u32>()).toBe(100);
      expect(v.as<u8>()).toBe(100);
      expect(v.as<bool>()).toBe(true);
    });

    it("Should create from generic", () => {
      let v = u256.from<u32>(123);
      expect(v.lo1).toBe(123);

      let v2 = u256.from<bool>(true);
      expect(v2.lo1).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases & Eth-like Behavior
  // --------------------------------------------------------------------------
  describe("Edge Cases", () => {
    it("Shift right by >= 256 should be zero", () => {
      let v = u256.Max;
      expect(u256.shr(v, 256).isZero()).toBe(true);
      expect(u256.shr(v, 500).isZero()).toBe(true);
    });

    it("Left shift by >= 256 should be zero", () => {
      let v = u256.Max;
      expect(u256.shl(v, 256).isZero()).toBe(true);
    });

    it("Zero division check", () => {
      expect(() => {
        let v = u256.div(u256.One, u256.Zero);
      }).toThrow();
    });

    it("Correct carry logic in multi-limb sub", () => {
      // Trigger borrow across multiple limbs
      let a = new u256(0, 0, 1, 0); // 2^128
      let b = u256.One;
      let diff = a - b;
      expect(diff.lo1).toBe(u64.MAX_VALUE);
      expect(diff.lo2).toBe(u64.MAX_VALUE);
      expect(diff.hi1).toBe(0);
    });
  });
});
