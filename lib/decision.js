'use strict';

const APPROVAL_ROLES = ['ceo', 'department'];
const TASK_STATUSES = ['برای شروع', 'در حال انجام', 'بازبینی', 'انجام‌شده'];
const APPROVED = 'تأیید شده';

function isFilled(value) {
  const text = String(value || '').trim();
  return Boolean(text) && text !== 'در انتظار بررسی' && !text.includes('نامشخص');
}

function evaluateDecisionGate(report) {
  const facts = Array.isArray(report?.facts) ? report.facts.filter(Boolean) : [];
  const impacts = report?.impacts && typeof report.impacts === 'object' ? report.impacts : {};
  const approvals = report?.approvals || {};

  const checks = {
    problemDefined: isFilled(report?.rootCause) || isFilled(report?.subject),
    evidenceSufficient: facts.length > 0,
    rootCauseKnown: isFilled(report?.rootCause),
    assumptionsExposed: Array.isArray(report?.assumptions),
    impactAssessed: Object.keys(impacts).length > 0,
    ownerAssigned: Boolean(String(report?.owner || '').trim()),
    approvalRequired: true,
    approvalCompleted: approvals.ceo === APPROVED && approvals.department === APPROVED
  };

  return { checks, passed: Object.values(checks).every(Boolean) };
}

function approveReport(report, role) {
  if (!report || !APPROVAL_ROLES.includes(role)) {
    return { ok: false, status: 404, error: 'پرونده یا نقش معتبر نیست.' };
  }

  report.approvals = report.approvals || { ceo: 'در انتظار', department: 'در انتظار' };
  report.approvals[role] = APPROVED;

  if (report.approvals.ceo === APPROVED && report.approvals.department === APPROVED) {
    const gate = evaluateDecisionGate(report);
    if (!gate.passed) {
      report.approvals[role] = 'در انتظار';
      return {
        ok: false,
        status: 409,
        error: 'گیت تصمیم کامل نیست؛ صدور گردش‌کار مجاز نیست.',
        gate
      };
    }
    report.stage = 'گردش‌کار فعال';
  }

  return { ok: true, report, gate: evaluateDecisionGate(report) };
}

function returnReport(report, comment) {
  if (!report) return { ok: false, status: 404, error: 'پرونده یافت نشد.' };
  report.stage = 'نیازمند اطلاعات';
  report.approvals = report.approvals || {};
  report.approvals.department = `ارجاع: ${String(comment || 'بدون توضیح')}`;
  return { ok: true, report };
}

function setTaskStatus(task, status) {
  if (!task || !TASK_STATUSES.includes(status)) {
    return { ok: false, status: 400, error: 'وضعیت تسک معتبر نیست.' };
  }
  task.status = status;
  return { ok: true, task };
}

function nextTaskStatus(current) {
  const index = TASK_STATUSES.indexOf(current);
  if (index < 0 || index >= TASK_STATUSES.length - 1) return null;
  return TASK_STATUSES[index + 1];
}

function verifyWebhookSecret(supplied, expected, { requireSecret = false } = {}) {
  const expectedBuffer = Buffer.from(String(expected || ''));
  const suppliedBuffer = Buffer.from(String(supplied || ''));

  if (requireSecret && expectedBuffer.length === 0) return false;
  if (expectedBuffer.length === 0) return true;
  if (suppliedBuffer.length !== expectedBuffer.length) return false;
  return require('node:crypto').timingSafeEqual(suppliedBuffer, expectedBuffer);
}

module.exports = {
  APPROVAL_ROLES,
  TASK_STATUSES,
  evaluateDecisionGate,
  approveReport,
  returnReport,
  setTaskStatus,
  nextTaskStatus,
  verifyWebhookSecret
};
