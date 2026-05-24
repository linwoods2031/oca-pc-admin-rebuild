import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildCrossSystemAlignmentReport,
  renderMarkdownAlignment,
} from './cross-system-alignment.mjs';

function writeFile(root, file, content) {
  const fullPath = path.join(root, file);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

function makeFixtureRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cross-system-alignment-'));
}

function writePcFixture(root) {
  writeFile(root, 'src/config/runtime.js', 'baseWriteDisabledMessage\nisBaseWriteEnabled: false\nassertBaseWriteAllowed');
  writeFile(root, 'src/api/oca.js', 'export function addBase() { assertBaseWriteAllowed(); }\nexport function updateBase() { assertBaseWriteAllowed(); }');
  writeFile(root, 'src/views/PatientDetailView.vue', '<el-form :disabled="baseReadonly"></el-form>\n:disabled="baseReadonly"\nfunction saveBaseForm() {}\nbaseWriteDisabledMessage');
  writeFile(root, 'docs/mini-program-final-requirements.md', '小程序最终口径对齐清单\nPC 后台不单独定义上述量表评分和结论规则\n以后端返回的量表名称、分值和结论为准');
  writeFile(root, 'docs/recovered-contracts.md', 'PC 后台正式使用时不允许修改一般情况表和当前用药\n用药修改在平板端完成\n因 PC 不开放一般情况表和当前用药保存');
}

function writeMiniMaintenanceFixture(root) {
  writeFile(root, 'OPERATIONS.md', '1.1.51\n当前正式长期二维码仍是旧正式包\n住院号搜索\n修改患者\n上次得分\n上次结论\n预计复诊日期');
  writeFile(root, 'artifacts/oca-preview-qrcode-1.1.50.jpg', 'old-preview');
  writeFile(root, 'artifacts/oca-preview-qrcode-1.1.51.jpg', 'mock-preview');
  writeFile(root, 'artifacts/oca-preview-qrcode-latest.jpg', 'mock-preview');
  writeFile(root, 'artifacts/miniprogram-formal-qrcode-current.png', 'mock-formal');
  writeFile(root, 'db-hotfix/2026-04-30-feedback-fixes.sql', 'Zung氏焦虑自评量表（SAS） 简易智力状况检查表（MMSE） 33 分 限女性 限男性 握力 步速 用药史');
  writeFile(root, 'db-hotfix/2026-05-15-feedback-rules-format.sql', 'ADL AIS SPPB MMSE 33 分量表 握力 步速');
  writeFile(root, 'db-hotfix/2026-05-16-fried-short-lines.sql', 'FRIED BMI 握力 步速减慢');
  writeFile(root, 'db-hotfix/2026-05-16-mmse-degree-question.sql', '文化程度 33 分 文盲 小学 中学及以上');
  writeFile(root, 'db-hotfix/2026-05-17-adl-estimate-rule.sql', 'ADL 能自理 轻度功能缺陷 中度功能缺陷 严重功能缺陷 极严重功能缺陷');
  writeFile(root, 'db-hotfix/2026-05-20-iadl-option-scores.sql', 'IADL option_score = 0 option_score = 1');
  writeFile(root, 'backend-hotfix-src/com/qihao/udp/oca/web/controller/business/OutpatientCheckController.java', 'FEMALE_ONLY_MARKERS MALE_ONLY_MARKERS ADL_TABLE_ID IADL_TABLE_ID FRA_TABLE_ID sortQuestionsById');
  writeFile(root, 'backend-hotfix-src/com/qihao/udp/oca/business/score/MMSEScoreComputer.java', 'MMSE 文化程度 ServiceException');
  writeFile(root, 'backend-hotfix-src/com/qihao/udp/oca/business/score/TcmCorporeityComputer.java', 'FEMALE_ONLY_MARKERS MALE_ONLY_MARKERS 湿热质');
}

function writeMiniShellFixture(root) {
  writeFile(root, 'pages/assessment/create/index.js', '简易智力状况检查表（MMSE） MMSE 33 分量表 Zung氏焦虑自评量表（SAS） 衰弱评定量表（FRIED） 老年人跌倒风险评估表（FRA）');
  writeFile(root, 'pages/assessment/create/index.wxml', '全选 清空');
  writeFile(root, 'pages/assessment/menu/index.wxml', '上次得分 上次结论 预计复诊日期');
  writeFile(root, 'pages/patient/list/index.wxml', '住院号 输入住院号搜索');
  writeFile(root, 'pages/patient/form/index.wxml', '修改患者 住院号');
  writeFile(root, 'pages/assessment/base/index.wxml', '居住楼层 电梯房 跌倒史 义齿');
}

describe('cross-system alignment report', () => {
  it('passes local alignment when PC, mini-program, backend, and SQL evidence is present', () => {
    const root = makeFixtureRoot();
    const miniMaintenanceDir = makeFixtureRoot();
    const miniShellDir = makeFixtureRoot();
    writePcFixture(root);
    writeMiniMaintenanceFixture(miniMaintenanceDir);
    writeMiniShellFixture(miniShellDir);

    const report = buildCrossSystemAlignmentReport({ root, miniMaintenanceDir, miniShellDir });

    expect(report.summary.fail).toBe(0);
    expect(report.summary.unknown).toBe(0);
    expect(report.summary.requiredExternalEvidence).toBe(2);
    expect(report.summary.requiredExternalAction).toBe(1);
    expect(report.finalGate.localCrossSystemAlignmentCandidate).toBe(true);
    expect(report.finalGate.directProductionLaunchAllowed).toBe(false);
  });

  it('keeps the final gate blocked when external workspaces cannot be scanned', () => {
    const root = makeFixtureRoot();
    writePcFixture(root);

    const report = buildCrossSystemAlignmentReport({
      root,
      miniMaintenanceDir: path.join(root, 'missing-mini-maintenance'),
      miniShellDir: path.join(root, 'missing-mini-shell'),
    });

    expect(report.summary.fail).toBe(0);
    expect(report.summary.unknown).toBe(2);
    expect(report.finalGate.localCrossSystemAlignmentCandidate).toBe(false);
    expect(report.finalGate.directProductionLaunchAllowed).toBe(false);
  });

  it('fails when the latest preview alias points at an older QR code', () => {
    const root = makeFixtureRoot();
    const miniMaintenanceDir = makeFixtureRoot();
    const miniShellDir = makeFixtureRoot();
    writePcFixture(root);
    writeMiniMaintenanceFixture(miniMaintenanceDir);
    writeMiniShellFixture(miniShellDir);
    writeFile(miniMaintenanceDir, 'artifacts/oca-preview-qrcode-latest.jpg', 'old-preview');

    const report = buildCrossSystemAlignmentReport({ root, miniMaintenanceDir, miniShellDir });
    const previewCheck = report.sections.miniProgramOperations.find((check) => check.name === 'Latest mini-program preview QR artifact is present and aliased');

    expect(previewCheck.status).toBe('fail');
    expect(previewCheck.missing.join('\n')).toContain('latest preview QR alias does not match 1.1.51 artifact');
    expect(report.finalGate.localCrossSystemAlignmentCandidate).toBe(false);
  });

  it('renders a release-owner friendly markdown summary', () => {
    const root = makeFixtureRoot();
    writePcFixture(root);
    const report = buildCrossSystemAlignmentReport({
      root,
      miniMaintenanceDir: path.join(root, 'missing-mini-maintenance'),
      miniShellDir: path.join(root, 'missing-mini-shell'),
    });

    const markdown = renderMarkdownAlignment(report);

    expect(markdown).toContain('Cross-System Alignment Report');
    expect(markdown).toContain('Direct production launch allowed: no');
    expect(markdown).toContain('Server artifact parity for recovered backend and SQL contracts');
  });
});
