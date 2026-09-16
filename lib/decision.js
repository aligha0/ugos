'use strict';

const crypto = require('node:crypto');

const APPROVAL_ROLES = ['ceo', 'department'];
const TASK_STATUSES = ['برای شروع', 'در حال انجام', 'بازبینی', 'انجام‌شده'];
const APPROVED = 'تأیید شده';
const MIN_SECRET_LENGTH = 32;

function isFilled(value) {
  const text = String(value || '').trim();
  return Boolean(text) && text !== 'در انتظار بررسی' && !text.includes('نامشخص');
}

function normalizeEvidence(items) {
  if (!Array.isArray(items)) return [];
  return items.map(item => {
    if (item && typeof item === 'object') {
      return {
        content: String(item.content || item.text || '').trim(),
        source: String(item.source || '').trim(),
        type: item.type || 'observation',
        timestamp: item.timestamp || null,
        verified: Boolean(item.verified),
        reliability: item.reliability || null
      };
    }
    return {
      content: String(item || '').trim(),
      source: '',
      type: 'observation',
      timestamp: null,
      verified: false,
      reliability: null
    };
  }).filter(item => item.content);
}

function evaluateEvidence(items) {
  const evidence = normalizeEvidence(items);
  const hasSource = evidence.some(item => item.source);
  const hasVerified = evidence.some(item => item.verified);
  return {
    count: evidence.length,
    hasSource,
    hasVerified,
    sufficient: evidence.length >= 2 || (evidence.length === 1 && (hasSource || hasVerified)),
    items: evidence
  };
}

function evaluateDecisionGate(report) {
  const evidence = evaluateEvidence(report?.facts || report?.evidence);
  const impacts = report?.impacts && typeof report.impacts === 'object' ? report.impacts : {};
  const approvals = report?.approvals || {};

  const checks = {
    problemDefined: isFilled(report?.problemStatement),
    evidenceSufficient: evidence.sufficient,
    rootCauseKnown: isFilled(report?.rootCause),
    assumptionsExposed: Array.isArray(report?.assumptions),
    impactAssessed: Object.keys(impacts).length > 0,
    ownerAssigned: Boolean(String(report?.owner || '').trim()),
    approvalRequired: true,
    approvalCompleted: approvals.ceo === APPROVED && approvals.department === APPROVED
  };

  return {
    checks,
    evidence,
    passed: Object.values(checks).every(Boolean)
  };
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
  const expectedStr = String(expected || '');
  const suppliedStr = String(supplied || '');
  const expectedLength = Buffer.byteLength(expectedStr, 'utf8');

  if (requireSecret && expectedLength < MIN_SECRET_LENGTH) return false;
  if (!requireSecret && expectedLength === 0) return true;
  if (expectedLength > 0 && expectedLength < MIN_SECRET_LENGTH) return false;

  const expectedBuffer = Buffer.from(expectedStr);
  const suppliedBuffer = Buffer.from(suppliedStr);
  if (suppliedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
}

module.exports = {
  APPROVAL_ROLES,
  TASK_STATUSES,
  MIN_SECRET_LENGTH,
  normalizeEvidence,
  evaluateEvidence,
  evaluateDecisionGate,
  approveReport,
  returnReport,
  setTaskStatus,
  nextTaskStatus,
  verifyWebhookSecret
};
