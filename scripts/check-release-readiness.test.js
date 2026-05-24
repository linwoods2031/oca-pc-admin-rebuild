import { describe, expect, it } from 'vitest';
import { CONFIRMED_RECOVERED_CONTRACTS, REQUIRED_MANUAL_CONTRACTS } from './check-release-readiness.mjs';

function names(list) {
  return list.map((item) => item.name);
}

describe('check-release-readiness contract classification', () => {
  it('keeps recovered backend and accepted mini-program contracts out of manual unknowns', () => {
    const confirmed = names(CONFIRMED_RECOVERED_CONTRACTS);
    const manual = names(REQUIRED_MANUAL_CONTRACTS);

    expect(confirmed).toContain('editCheckReport payload compatibility with mini program');
    expect(confirmed).toContain('submitted state fields');
    expect(confirmed).toContain('patient base and medication storage scope');
    expect(manual).not.toContain('editCheckReport payload compatibility with mini program');
    expect(manual).not.toContain('submitted status fields');
    expect(manual).not.toContain('getBaseMedications scope');
  });

  it('keeps rollout approval and server artifact parity as external blockers', () => {
    const manual = names(REQUIRED_MANUAL_CONTRACTS);

    expect(manual).toContain('patient-scoped base write rollout approval');
    expect(manual).toContain('server artifact parity for recovered contracts');
    expect(REQUIRED_MANUAL_CONTRACTS.every((item) => item.blocksDirectLaunch)).toBe(true);
  });
});
