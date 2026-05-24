import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkApiBoundary } from './check-api-boundary.mjs';
import { checkBuildOutput } from './check-build-output.mjs';
import { checkSensitive } from './check-sensitive.mjs';
import { createRuntimeConfig } from '../src/config/runtime.js';

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function statusFromIssues(issues) {
  return issues.length ? 'fail' : 'pass';
}

function gate(name, issues = []) {
  return { name, status: statusFromIssues(issues), issueCount: issues.length };
}

export function buildReleaseReadinessReport({ root = process.cwd(), env = process.env } = {}) {
  const apiBoundaryIssues = checkApiBoundary({ root });
  const sensitiveIssues = checkSensitive({ root });
  const buildOutput = checkBuildOutput({ root, env });
  const defaultRuntime = createRuntimeConfig({});
  const readonlyDefaultIssues = defaultRuntime.isReadOnlyMode && !defaultRuntime.isWriteEnabled ? [] : [{ rule: 'readonly-default' }];
  const unitTests = env.VERIFY_UNIT_TESTS_STATUS || env.UNIT_TESTS_STATUS || 'unknown';
  const automatedGates = {
    readonlyDefault: gate('readonlyDefault', readonlyDefaultIssues),
    apiBoundary: gate('apiBoundary', apiBoundaryIssues),
    sensitiveScan: gate('sensitiveScan', sensitiveIssues),
    buildOutput: gate('buildOutput', buildOutput.issues),
    unitTests,
  };
  const automatedPass = Object.entries(automatedGates)
    .filter(([, value]) => typeof value === 'object' && value?.status)
    .every(([, value]) => value.status === 'pass');

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    commit: {
      sha: git(['rev-parse', 'HEAD']),
      shortSha: git(['rev-parse', '--short', 'HEAD']),
      branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
      dirty: Boolean(git(['status', '--short'])),
    },
    automatedGates,
    requiredManualContracts: [
      { name: 'getInfo ownership fields', status: 'required_external_confirmation' },
      { name: 'getBase patientId/outpatientId semantics', status: 'required_external_confirmation' },
      { name: 'getBaseMedications scope', status: 'required_external_confirmation' },
      { name: 'editCheckReport payload compatibility with mini program', status: 'required_external_confirmation' },
      { name: 'submitted status fields', status: 'required_external_confirmation' },
    ],
    productionActionsExecuted: false,
    realWriteApiCalled: false,
    deploymentExecuted: false,
    finalGate: {
      codeCandidate: automatedPass,
      directProductionLaunchAllowed: false,
      reason: automatedPass
        ? 'Automated source gates passed; direct production launch still requires external approval and contract confirmation.'
        : 'One or more automated source gates failed.',
    },
  };
}

const isMain = import.meta.url === pathToFileURL(fileURLToPath(import.meta.url)).href
  && process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const report = buildReleaseReadinessReport();
  console.log(JSON.stringify(report, null, 2));
  const failed = Object.values(report.automatedGates).some((value) => typeof value === 'object' && value?.status === 'fail');
  if (failed) process.exit(1);
}
