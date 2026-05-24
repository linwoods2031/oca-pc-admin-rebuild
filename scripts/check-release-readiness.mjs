import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkApiBoundary } from './check-api-boundary.mjs';
import { checkBuildOutput, checkReleaseProfile } from './check-build-output.mjs';
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
  const releaseProfile = checkReleaseProfile(env);
  const buildOutput = checkBuildOutput({ root, env });
  const defaultRuntime = createRuntimeConfig({});
  const readonlyDefaultIssues = defaultRuntime.isReadOnlyMode && !defaultRuntime.isWriteEnabled ? [] : [{ rule: 'readonly-default' }];
  const unitTests = env.VERIFY_UNIT_TESTS_STATUS || env.UNIT_TESTS_STATUS || 'unknown';
  const automatedGates = {
    readonlyDefault: gate('readonlyDefault', readonlyDefaultIssues),
    releaseProfile: gate('releaseProfile', releaseProfile.issues),
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
    releaseProfile: {
      name: releaseProfile.releaseProfile,
      writesRequested: releaseProfile.writesRequested,
      readonlyOverride: releaseProfile.readonlyOverride,
      classification: releaseProfile.releaseProfile === 'restricted-write-gray'
        ? 'restricted_write_gray_package'
        : releaseProfile.releaseProfile === 'readonly-gray'
          ? 'readonly_gray_package'
          : 'formal_review_candidate_package',
      formalCandidateRequiresReadonly: releaseProfile.releaseProfile === 'formal-candidate',
      notes: releaseProfile.releaseProfile === 'restricted-write-gray'
        ? 'This package may be used only for separately approved allow-list write gray verification; it is not a formal review candidate package.'
        : releaseProfile.releaseProfile === 'readonly-gray'
          ? 'This package may be used for readonly gray verification; it is not the default formal review candidate package.'
          : 'This package is expected to remain readonly by default and may be considered by automated gates as a formal review candidate only when all gates pass.',
    },
    automatedGates,
    requiredManualContracts: [
      {
        name: 'getInfo ownership fields',
        status: 'required_external_confirmation',
        blocksDirectLaunch: true,
        risk: 'Patient create/edit owner fields must be confirmed by backend ownership semantics.',
      },
      {
        name: 'getBase patientId/outpatientId semantics',
        status: 'required_external_confirmation',
        blocksDirectLaunch: true,
        risk: 'Base form writes must remain tied to the current assessment outpatientId.',
      },
      {
        name: 'getBaseMedications scope',
        status: 'required_external_confirmation',
        blocksDirectLaunch: true,
        risk: 'Medication rows must be confirmed as patient-scoped or assessment-scoped before broader write rollout.',
      },
      {
        name: 'editCheckReport payload compatibility with mini program',
        status: 'required_external_confirmation',
        blocksDirectLaunch: true,
        risk: 'Question payloads, including checkItem null and unsupported question types, must match the mini program/backend contract.',
      },
      {
        name: 'submitted status fields',
        status: 'required_external_confirmation',
        blocksDirectLaunch: true,
        risk: 'Submitted-state fields and values must be confirmed so write guards block every submitted record.',
      },
    ],
    productionActionsExecuted: false,
    realWriteApiCalled: false,
    deploymentExecuted: false,
    finalGate: {
      codeCandidate: automatedPass && releaseProfile.releaseProfile === 'formal-candidate',
      readonlyGrayCandidate: automatedPass && releaseProfile.releaseProfile === 'readonly-gray',
      restrictedWriteGrayCandidate: automatedPass && releaseProfile.releaseProfile === 'restricted-write-gray',
      directProductionLaunchAllowed: false,
      reason: !automatedPass
        ? 'One or more automated source gates failed.'
        : releaseProfile.releaseProfile === 'formal-candidate'
          ? 'Automated source gates passed for the default readonly formal review candidate package; direct production launch still requires external approval and contract confirmation.'
          : 'Automated gates passed for a gray package classification, but it is not a formal review candidate package and cannot be used for direct production launch.',
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
