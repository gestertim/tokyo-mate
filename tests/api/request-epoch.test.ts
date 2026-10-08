// @vitest-environment node
import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { capabilityTimeValid, deriveOwnerScope, signCapability, verifyCapability,
  type CapabilityPayload, type CapabilityVerificationKey } from '../../api/_lib/request-epoch';

const kid = Buffer.alloc(16, 0x22).toString('base64url');
const signingKey = Buffer.alloc(32, 0x11);
const scopeKey = Buffer.alloc(32, 0x33);
const payload: CapabilityPayload = {
  generation: 7,
  epochId: `g7_${kid}`,
  kid,
  scopeKeyVersion: 'scope-v1',
  ownerScope: 's'.repeat(43),
  endpoint: 'places',
  operationHandle: 'h'.repeat(43),
  issuedAtMs: 1_800_000_000_000,
  expiresAtMs: 1_800_086_400_000,
};
const keys: CapabilityVerificationKey[] = [{ kid, key: signingKey, state: 'verify_only' }];

describe('request epoch capability encoding', () => {
  it('uses the fixed payload and MAC domains and verifies a verify-only key', () => {
    const token = signCapability(payload, signingKey);
    expect(createHash('sha256').update(token).digest('hex'))
      .toBe('b6d767ab82d348ccaada4280a4bbca6b3d7a3160580fef5f1ceb8a5a615bef6e');
    expect(token.split('.')).toHaveLength(4);
    expect(token).toMatch(/^v1\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/);
    expect(Buffer.byteLength(token, 'ascii')).toBeLessThanOrEqual(1024);
    expect(verifyCapability(token, keys)).toEqual(payload);
    expect(capabilityTimeValid(payload, payload.issuedAtMs - 1)).toBe(false);
    expect(capabilityTimeValid(payload, payload.issuedAtMs)).toBe(true);
    expect(capabilityTimeValid(payload, payload.expiresAtMs - 1)).toBe(true);
    expect(capabilityTimeValid(payload, payload.expiresAtMs)).toBe(false);
    expect(capabilityTimeValid(payload, payload.expiresAtMs + 1)).toBe(false);
  });

  it('rejects padding, altered MAC, unknown/revoked keys and noncanonical payload bytes', () => {
    const token = signCapability(payload, signingKey);
    expect(verifyCapability(`${token}=`, keys)).toBeNull();
    expect(verifyCapability(token.replace(/.$/, token.endsWith('A') ? 'B' : 'A'), keys)).toBeNull();
    expect(verifyCapability(token, [])).toBeNull();
    expect(verifyCapability(token, [{ kid, key: signingKey, state: 'revoked' }])).toBeNull();

    const wire = ['tm/request-capability/v1', payload.generation, payload.epochId, kid,
      payload.scopeKeyVersion, payload.ownerScope, payload.endpoint, payload.operationHandle,
      payload.issuedAtMs, payload.expiresAtMs];
    const noncanonical = Buffer.from(JSON.stringify(wire, null, 1), 'utf8').toString('base64url');
    const input = Buffer.from(JSON.stringify(['tm/capability-sign/v1', kid, noncanonical]), 'utf8');
    const mac = createHmac('sha256', signingKey).update(input).digest('base64url');
    expect(verifyCapability(`v1.${kid}.${noncanonical}.${mac}`, keys)).toBeNull();
  });

  it('domain-separates owner scope by key version and subject', () => {
    const owner = deriveOwnerScope(scopeKey, 'scope-v1', 'fixture-subject');
    expect(owner).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(deriveOwnerScope(scopeKey, 'scope-v1', 'fixture-subject')).toBe(owner);
    expect(deriveOwnerScope(scopeKey, 'scope-v2', 'fixture-subject')).not.toBe(owner);
    expect(deriveOwnerScope(scopeKey, 'scope-v1', 'another-subject')).not.toBe(owner);
  });
});
