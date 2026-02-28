# Security Policy

<p align="center">
  <a href="https://verichains.io">
    <img src="https://raw.githubusercontent.com/btc-vision/contract-logo/refs/heads/main/public-assets/verichains.png" alt="Verichains" width="300"/>
  </a>
</p>

<p align="center">
  <strong>Professionally Audited by <a href="https://verichains.io">Verichains</a></strong>
</p>

## Audit Status

| Aspect                    | Status                              |
|---------------------------|-------------------------------------|
| **Auditor**               | [Verichains](https://verichains.io) |
| **Audit Date**            | 2025                                |
| **Report Status**         | Pending Publication                 |
| **Severity Issues Found** | All resolved                        |

## About the Audit

This library has undergone a comprehensive security audit by [Verichains](https://verichains.io), a leading blockchain
security firm with extensive experience in:

- Smart contract security audits
- Blockchain protocol assessments
- Cryptographic implementation reviews
- WebAssembly security analysis

### Audit Scope

The security audit covered the following areas:

#### Integer Operations

- [x] Overflow/underflow detection in arithmetic operations
- [x] Division by zero handling
- [x] Modulo operation edge cases
- [x] Multiplication overflow scenarios
- [x] Power function boundary conditions

#### Bit Manipulation

- [x] Shift operation bounds checking
- [x] Rotate operations correctness
- [x] Bitwise AND/OR/XOR/NOT operations
- [x] Count leading/trailing zeros accuracy
- [x] Population count correctness

#### Type Conversions

- [x] Safe narrowing conversions (u256 → u128 → u64)
- [x] Sign extension correctness (signed types)
- [x] Float-to-integer conversion safety
- [x] String parsing validation
- [x] Byte array serialization/deserialization

#### Memory Safety

- [x] Buffer bounds checking
- [x] Immutable constant protection
- [x] Clone operation integrity
- [x] No uninitialized memory access

## Vulnerabilities Addressed

This fork addresses critical vulnerabilities found in the original [as-bignum](https://github.com/MaxGraey/as-bignum)
library:

### Critical

- **Division Operations**: The original library lacked proper division implementation for u128/u256 types. This fork
  implements secure division with proper zero-divisor checks.

### High

- **Overflow in Multiplication**: Fixed potential overflow scenarios in 128-bit and 256-bit multiplication operations.
- **Shift Operation Edge Cases**: Corrected behavior for shift amounts >= bit width.

### Medium

- **String Parsing**: Added proper validation for string-to-integer conversion.
- **Byte Array Handling**: Fixed potential issues with incorrect byte array lengths.

### Low

- **Performance Optimizations**: Rewrote critical paths to prevent timing-based side channels.
- **Memory Efficiency**: Reduced unnecessary allocations that could lead to memory exhaustion.

## Supported Versions

| Version | Supported              |
|---------|------------------------|
| 0.0.7   | ✅ Current              |
| < 0.0.7 | ⚠️ Upgrade recommended |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

1. **DO NOT** open a public GitHub issue for security vulnerabilities
2. Email your findings to the maintainers (see package.json for contact)
3. Include detailed steps to reproduce the vulnerability
4. Allow reasonable time for a fix before public disclosure

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Suggested fix (if any)

### Response Timeline

| Action                     | Timeframe           |
|----------------------------|---------------------|
| Initial response           | 48 hours            |
| Vulnerability confirmation | 7 days              |
| Patch development          | 14-30 days          |
| Public disclosure          | After patch release |

## Security Best Practices

When using this library, follow these guidelines:

### Input Validation

```typescript
// Always validate external input before conversion
if (inputString.length > 78) { // Max digits for u256
  throw new Error("Input too large");
}
let value = u256.fromString(inputString);
```

### Division Safety

```typescript
// Check for zero divisor
if (divisor.isZero()) {
  throw new Error("Division by zero");
}
let result = dividend / divisor;
```

### Overflow Awareness

```typescript
// Use muldiv for multiplication followed by division to avoid overflow
let result = u128.muldiv(a, b, c); // (a * b) / c without intermediate overflow
```

### Immutable Constants

```typescript
// Use immutable versions for read-only access
let zero = u128.immutableZero; // More efficient, guaranteed unchanged
```

## Audit Report

The full audit report from Verichains will be published here upon completion of the disclosure process.

📄 **[Audit Report - Coming Soon]**

## Contact

- **Security Issues**: Report via GitHub Security Advisories
- **General Questions**: Open a GitHub Issue
- **Maintainer**: [OPNet](https://opnet.org)
- **Auditor**: [Verichains](https://verichains.io)

---

<p align="center">
  <sub>Security is a continuous process. This document will be updated as new audits are completed.</sub>
</p>
