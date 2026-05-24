import { describe, expect, it } from 'vitest';
import {
  CONFIRMED_EXTERNAL_DECISIONS,
  CONFIRMED_RECOVERED_CONTRACTS,
  REQUIRED_MANUAL_CONTRACTS,
} from './check-release-readiness.mjs';

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

  it('records the user decision to keep PC base and medication writes readonly', () => {
    const confirmed = names(CONFIRMED_EXTERNAL_DECISIONS);
    const manual = names(REQUIRED_MANUAL_CONTRACTS);

    expect(confirmed).toContain('pc base and medication write policy');
    expect(confirmed).toContain('mini program final requirements source of truth');
    expect(manual).not.toContain('patient-scoped base write rollout approval');
    expect(CONFIRMED_EXTERNAL_DECISIONS[0].status).toBe('confirmed_user_decision_readonly');
    expect(CONFIRMED_EXTERNAL_DECISIONS[0].scope).toContain('readonly');
  });

  it('keeps server artifact parity as an external blocker', () => {
    const manual = names(REQUIRED_MANUAL_CONTRACTS);

    expect(manual).toContain('server artifact parity for recovered contracts');
    expect(REQUIRED_MANUAL_CONTRACTS.every((item) => item.blocksDirectLaunch)).toBe(true);
  });
});
