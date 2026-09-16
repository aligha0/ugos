'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  MIN_SECRET_LENGTH,
  evaluateDecisionGate,
  approveReport,
  returnReport,
  setTaskStatus,
  nextTaskStatus,
  verifyWebhookSecret
} = require('../lib/decision');
const { resolveStaticPath } = require('../lib/static-path');

const VALID_SECRET = 'a'.repeat(MIN_SECRET_LENGTH);

function completeReport(overrides = {}) {
  return {
    id: 'REP-TEST',
    subject: 'تأخیر تأمین بتن',
    problemStatement: 'کاهش ۵۰٪ ظرفیت تأمین‌کننده، بتن‌ریزی سقف طبقه ۸ را تهدید می‌کند.',
    owner: 'مدیر ساخت',
    stage: 'در انتظار تأیید',
    facts: [
      { content: 'ظرفیت روزانه از ۱۸۰ به ۹۰ مترمکعب کاهش یافته است.', source: 'ایمیل تأمین‌کننده', verified: true },
      { content: 'بتن‌ریزی سقف طبقه ۸ در برنامهٔ مصوب ثبت شده است.', source: 'برنامه مبنا' }
    ],
    assumptions: ['جایگزین در ۳۰ کیلومتری موجود است.'],
    rootCause: 'نقطه شکست واحد در تأمین.',
    impacts: { مالی: 'بالا', زمانی: 'بالا' },
    approvals: { ceo: 'در انتظار', department: 'در انتظار' },
    ...overrides
  };
}

test('گیت تصمیم با شواهد ناقص عبور نمی‌کند', () => {
  const gate = evaluateDecisionGate(completeReport({ facts: [], rootCause: 'نامشخص' }));
  assert.equal(gate.passed, false);
  assert.equal(gate.checks.evidenceSufficient, false);
  assert.equal(gate.checks.rootCauseKnown, false);
  assert.equal(gate.checks.approvalCompleted, false);
});

test('صرف subject مسئله را تعریف‌شده حساب نمی‌کند', () => {
  const gate = evaluateDecisionGate(completeReport({ problemStatement: '' }));
  assert.equal(gate.checks.problemDefined, false);
  assert.equal(gate.passed, false);
});

test('یک واقعیت بدون منبع و بدون تأیید کافی نیست', () => {
  const gate = evaluateDecisionGate(completeReport({ facts: ['تأمین‌کننده گفته ظرفیت کم شده.'] }));
  assert.equal(gate.evidence.count, 1);
  assert.equal(gate.checks.evidenceSufficient, false);
});

test('گیت تصمیم پس از مسئله، شواهد باکیفیت، علت و دو تأیید عبور می‌کند', () => {
  const report = completeReport({ approvals: { ceo: 'تأیید شده', department: 'تأیید شده' } });
  const gate = evaluateDecisionGate(report);
  assert.equal(gate.passed, true);
});

test('تأیید نقش نامعتبر رد می‌شود', () => {
  const result = approveReport(completeReport(), 'intern');
  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
});

test('یک تأیید به‌تنهایی گردش‌کار صادر نمی‌کند', () => {
  const report = completeReport();
  const result = approveReport(report, 'ceo');
  assert.equal(result.ok, true);
  assert.equal(report.stage, 'در انتظار تأیید');
  assert.equal(report.approvals.ceo, 'تأیید شده');
  assert.equal(result.gate.checks.approvalCompleted, false);
});

test('دو تأیید روی پرونده کامل گردش‌کار را فعال می‌کند', () => {
  const report = completeReport();
  approveReport(report, 'department');
  const result = approveReport(report, 'ceo');
  assert.equal(result.ok, true);
  assert.equal(report.stage, 'گردش‌کار فعال');
});

test('دو تأیید روی پرونده بدون علت ریشه‌ای مسدود می‌شود', () => {
  const report = completeReport({ rootCause: 'نامشخص' });
  approveReport(report, 'department');
  const result = approveReport(report, 'ceo');
  assert.equal(result.ok, false);
  assert.equal(result.status, 409);
  assert.notEqual(report.stage, 'گردش‌کار فعال');
});

test('ارجاع برای تکمیل داده مرحله را به نیازمند اطلاعات برمی‌گرداند', () => {
  const report = completeReport();
  const result = returnReport(report, 'استعلام جایگزین لازم است');
  assert.equal(result.ok, true);
  assert.equal(report.stage, 'نیازمند اطلاعات');
  assert.match(report.approvals.department, /استعلام جایگزین/);
});

test('ارجاع پرونده ناموجود خطای ۴۰۴ می‌دهد', () => {
  const result = returnReport(null, 'x');
  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
});

test('وضعیت تسک فقط در توالی مجاز جلو می‌رود', () => {
  const task = { id: 'TSK-1', status: 'برای شروع' };
  assert.equal(nextTaskStatus(task.status), 'در حال انجام');
  assert.equal(setTaskStatus(task, 'بازبینی').ok, true);
  assert.equal(task.status, 'بازبینی');
  assert.equal(setTaskStatus(task, 'نامعتبر').ok, false);
  assert.equal(nextTaskStatus('انجام‌شده'), null);
});

test('وب‌هوک secret کوتاه حتی در صورت برابری رد می‌شود', () => {
  assert.equal(verifyWebhookSecret('', '', { requireSecret: true }), false);
  assert.equal(verifyWebhookSecret('', '', { requireSecret: false }), true);
  assert.equal(verifyWebhookSecret('abc', 'abc'), false);
  assert.equal(verifyWebhookSecret(VALID_SECRET, VALID_SECRET), true);
  assert.equal(verifyWebhookSecret(VALID_SECRET, `${VALID_SECRET}x`), false);
});

test('resolveStaticPath از خروج از ریشه جلوگیری می‌کند', () => {
  const root = '/tmp/ugos-static-root';
  assert.equal(resolveStaticPath(root, '/index.html'), `${root}/index.html`);
  assert.equal(resolveStaticPath(root, '/../secret.txt'), null);
  assert.equal(resolveStaticPath(root, '/docs/../server.js'), `${root}/server.js`);
  assert.equal(resolveStaticPath(root, '/docs/api-contract.md'), `${root}/docs/api-contract.md`);
});
