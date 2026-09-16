/*
 * Deliberately dependency-free demo server.
 * Production authority, data retention and audit data are described in docs/production-architecture.md.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { approveReport, returnReport, setTaskStatus, verifyWebhookSecret } = require('./lib/decision');
const { resolveStaticPath } = require('./lib/static-path');

const PORT = Number(process.env.PORT || 8787);
const WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET || '';
const REQUIRE_WEBHOOK_SECRET = process.env.NODE_ENV === 'production' || WEBHOOK_SECRET.length > 0;
const ROOT = __dirname;

const reports = [
  {
    id: 'REP-1405-021',
    project: 'پروژه آفتاب',
    subject: 'احتمال تأخیر در تأمین بتن سقف طبقه ۸',
    sender: 'مهندس امیر رضایی — مدیر پروژه',
    receivedAt: 'امروز، ۱۰:۴۲',
    owner: 'مدیر ساخت',
    priority: 'بحرانی',
    stage: 'در انتظار تأیید',
    confidence: 86,
    facts: [
      'تأمین‌کننده در ایمیل، ظرفیت روزانه را از ۱۸۰ به ۹۰ مترمکعب اعلام کرده است.',
      'بتن‌ریزی سقف طبقه ۸ برای ۲۹ مرداد در برنامهٔ مصوب ثبت شده است.',
      'دو جبههٔ اجرایی وابسته به این بتن‌ریزی هستند.'
    ],
    analysis: 'ریسک اصلی، تأخیر زنجیره‌ای در برنامهٔ سازه و افزایش هزینهٔ تجهیز مجدد است؛ توقف عملیات بدون جایگزین، موعد تحویل بخش شمالی را تحت فشار قرار می‌دهد.',
    assumptions: ['ظرفیت تأمین‌کنندگان جایگزین در شعاع ۳۰ کیلومتری هنوز استعلام نشده است.', 'افزایش قیمت جایگزین بیش از ۸٪ نخواهد بود.'],
    rootCause: 'وابستگی عملیاتی به یک تأمین‌کننده بدون ظرفیت رزرو و SLA جبرانی.',
    proposal: 'هم‌زمان استعلام دو تأمین‌کنندهٔ جایگزین، مذاکره با تأمین‌کنندهٔ فعلی برای شیفت دوم و بازچینی توالی اجرا برای حفظ فعالیت‌های غیر وابسته.',
    impacts: { فنی: 'متوسط', مالی: 'بالا', زمانی: 'بالا', حقوقی: 'متوسط', انسانی: 'پایین', اعتباری: 'بالا' },
    approvals: { ceo: 'در انتظار', department: 'در انتظار' }
  },
  {
    id: 'REP-1405-020',
    project: 'پروژه مهتاب',
    subject: 'افزایش پرت میلگرد در فاز B',
    sender: 'سرپرست کارگاه',
    receivedAt: 'دیروز، ۱۷:۱۵',
    owner: 'مدیر دفتر فنی',
    priority: 'مهم',
    stage: 'نیازمند اطلاعات',
    confidence: 62,
    facts: ['پرت ثبت‌شده در سه هفتهٔ اخیر ۷٫۴٪ است.', 'حد آستانهٔ پروژه ۳٪ تعریف شده است.'],
    analysis: 'داده برای تعیین علت کافی نیست؛ تفکیک پرت ناشی از برش، تغییر نقشه و انبارش ثبت نشده است.',
    assumptions: ['بخش عمدهٔ پرت به تغییر نقشه مرتبط است.'],
    rootCause: 'نامشخص؛ نیاز به تفکیک دادهٔ روزانه.',
    proposal: 'فعال‌سازی ثبت علت پرت و نمونه‌گیری ۵ روزه پیش از تصمیم اصلاحی.',
    impacts: { فنی: 'متوسط', مالی: 'متوسط', زمانی: 'پایین', حقوقی: 'پایین', انسانی: 'پایین', اعتباری: 'پایین' },
    approvals: { ceo: 'نیاز ندارد', department: 'نیازمند تکمیل' }
  },
  {
    id: 'REP-1405-019',
    project: 'پروژه آفتاب',
    subject: 'ابهام در بند تعدیل قرارداد نما',
    sender: 'مدیر قراردادها',
    receivedAt: 'دیروز، ۱۲:۰۲',
    owner: 'مدیر حقوقی',
    priority: 'مهم',
    stage: 'گردش‌کار فعال',
    confidence: 91,
    facts: ['پیمانکار درخواست تعدیل ۱۴٪ ثبت کرده است.', 'تفسیر بند ۱۲ قرارداد به نظر مشترک حقوقی و مالی نیاز دارد.'],
    analysis: 'پذیرش بدون بررسی مستند، ریسک هزینه و سابقهٔ قراردادی ایجاد می‌کند.',
    assumptions: [],
    rootCause: 'ابهام در شاخص مرجع تعدیل قرارداد.',
    proposal: 'دریافت مستند شاخص، تحلیل حقوقی-مالی و مذاکرهٔ مبتنی بر سناریو.',
    impacts: { فنی: 'پایین', مالی: 'بالا', زمانی: 'متوسط', حقوقی: 'بالا', انسانی: 'پایین', اعتباری: 'متوسط' },
    approvals: { ceo: 'تأیید شده', department: 'تأیید شده' }
  }
];

const tasks = [
  { id: 'TSK-841', title: 'استعلام ظرفیت و قیمت دو تأمین‌کنندهٔ جایگزین', assignee: 'مدیر تأمین', project: 'آفتاب', due: 'امروز، ۱۶:۰۰', status: 'در حال انجام', priority: 'بحرانی', acceptance: 'دو پیش‌فاکتور معتبر با ظرفیت، قیمت و شرایط پرداخت ثبت شود.' },
  { id: 'TSK-842', title: 'تحلیل اثر تأخیر بر برنامهٔ مبنا', assignee: 'مدیر کنترل پروژه', project: 'آفتاب', due: 'امروز، ۱۸:۰۰', status: 'برای شروع', priority: 'بحرانی', acceptance: 'سناریوی ۰، ۲ و ۴ روزه با اثر بر مسیر بحرانی ارائه شود.' },
  { id: 'TSK-839', title: 'بررسی بند تعدیل قرارداد نما', assignee: 'مدیر حقوقی', project: 'مهتاب', due: 'فردا', status: 'بازبینی', priority: 'مهم', acceptance: 'تفسیر قراردادی و ریسک هر سناریو مستند شود.' },
  { id: 'TSK-836', title: 'ثبت تفکیکی علت پرت میلگرد', assignee: 'سرپرست کارگاه', project: 'مهتاب', due: '۳۱ مرداد', status: 'برای شروع', priority: 'مهم', acceptance: 'دادهٔ پنج روزه با کد علت تکمیل شود.' },
  { id: 'TSK-832', title: 'به‌روزرسانی بانک درس‌آموخته‌های تأمین', assignee: 'کارشناس PMO', project: 'سازمانی', due: 'بسته شد', status: 'انجام‌شده', priority: 'عادی', acceptance: 'الگوی SLA و تأمین‌کنندهٔ جایگزین ثبت شود.' }
];

function send(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(payload));
}

function body(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', part => { raw += part; if (raw.length > 1_000_000) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('بدنهٔ JSON معتبر نیست.')); } });
  });
}

function readStatic(urlPath, res) {
  const file = resolveStaticPath(ROOT, urlPath);
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return false;
  const type = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8'
  }[path.extname(file)] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': type, 'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin' });
  fs.createReadStream(file).pipe(res);
  return true;
}

function dashboard() {
  return {
    metrics: [
      { label: 'گزارش‌های جدید', value: reports.filter(r => r.stage !== 'گردش‌کار فعال').length, trend: 'در ۲۴ ساعت اخیر', tone: 'blue' },
      { label: 'نیازمند تصمیم', value: reports.filter(r => r.stage === 'در انتظار تأیید').length, trend: 'یک مورد بحرانی', tone: 'orange' },
      { label: 'تسک‌های سررسید امروز', value: tasks.filter(t => t.due.includes('امروز')).length, trend: '۲ مورد مسیر بحرانی', tone: 'red' },
      { label: 'نرخ تکمیل به‌موقع', value: '۸۷٪', trend: '۴٪ بهتر از هفتهٔ قبل', tone: 'green' }
    ],
    health: { workflowSuccess: '99.6%', queue: 12, p95: '1.8s', errors: 1 }
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/dashboard') return send(res, 200, dashboard());
    if (req.method === 'GET' && url.pathname === '/api/reports') return send(res, 200, { data: reports });
    if (req.method === 'GET' && url.pathname === '/api/tasks') return send(res, 200, { data: tasks });

    const approval = url.pathname.match(/^\/api\/reports\/([^/]+)\/approve$/);
    if (req.method === 'POST' && approval) {
      const payload = await body(req);
      const report = reports.find(x => x.id === approval[1]);
      const result = approveReport(report, payload.role);
      if (!result.ok) return send(res, result.status, { error: result.error, gate: result.gate });
      return send(res, 200, { data: result.report, auditId: crypto.randomUUID(), gate: result.gate });
    }

    const returnForData = url.pathname.match(/^\/api\/reports\/([^/]+)\/return$/);
    if (req.method === 'POST' && returnForData) {
      const payload = await body(req);
      const report = reports.find(x => x.id === returnForData[1]);
      const result = returnReport(report, payload.comment);
      if (!result.ok) return send(res, result.status, { error: result.error });
      return send(res, 200, { data: result.report });
    }

    const changeTask = url.pathname.match(/^\/api\/tasks\/([^/]+)\/status$/);
    if (req.method === 'POST' && changeTask) {
      const payload = await body(req);
      const task = tasks.find(x => x.id === changeTask[1]);
      const result = setTaskStatus(task, payload.status);
      if (!result.ok) return send(res, result.status, { error: result.error });
      return send(res, 200, { data: result.task });
    }

    if (req.method === 'POST' && url.pathname === '/api/webhooks/n8n/report') {
      const allowed = verifyWebhookSecret(req.headers['x-ugos-webhook-secret'], WEBHOOK_SECRET, {
        requireSecret: REQUIRE_WEBHOOK_SECRET
      });
      if (!allowed) return send(res, 401, { error: 'وب‌هوک مجاز نیست.' });
      const payload = await body(req);
      if (!payload.subject || !payload.project || !Array.isArray(payload.facts)) {
        return send(res, 422, { error: 'project، subject و facts الزامی هستند.' });
      }
      const report = {
        id: `REP-${Date.now()}`,
        project: payload.project,
        subject: payload.subject,
        sender: payload.sender || 'n8n',
        receivedAt: 'همین حالا',
        owner: payload.owner || 'مدیر پروژه',
        priority: payload.priority || 'مهم',
        stage: 'نیازمند بررسی',
        confidence: Number(payload.confidence || 0),
        facts: payload.facts,
        analysis: payload.analysis || 'در انتظار تحلیل',
        assumptions: payload.assumptions || [],
        rootCause: payload.rootCause || 'در انتظار بررسی',
        proposal: payload.proposal || 'در انتظار پیشنهاد',
        impacts: payload.impacts || {},
        approvals: { ceo: 'در انتظار', department: 'در انتظار' }
      };
      reports.unshift(report);
      return send(res, 201, { data: report });
    }

    if (req.method === 'GET' && readStatic(url.pathname, res)) return;
    send(res, 404, { error: 'مسیر یافت نشد.' });
  } catch (error) {
    send(res, 400, { error: error.message || 'خطای غیرمنتظره.' });
  }
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`UGOS Control Center: http://localhost:${PORT}`));
}

module.exports = { server, reports, tasks };
