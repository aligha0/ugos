const state = { reports: [], tasks: [], dashboard: null, selectedReport: null, taskFocus: false };
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const esc = (value = '') => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[char]);
const priorityClass = value => value === 'بحرانی' ? 'critical' : value === 'مهم' ? 'important' : 'normal';
const impactClass = value => value === 'بالا' ? 'high' : value === 'متوسط' ? 'medium' : 'low';

async function api(url, options = {}) {
  const response = await fetch(url, { headers: { 'content-type': 'application/json', ...(options.headers || {}) }, ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'ارتباط با سرویس ناموفق بود.');
  return payload;
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 3400);
}

function renderMetrics() {
  $('#metricGrid').innerHTML = state.dashboard.metrics.map(item => `
    <article class="metric-card ${esc(item.tone)}"><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong><small>${esc(item.trend)}</small></article>
  `).join('');
}

function renderHealth() {
  const health = state.dashboard.health;
  const services = [
    ['G', 'Gmail Intake', 'دریافت و ضدتکرار ایمیل', 'فعال'],
    ['AI', 'تحلیل هوشمند', `موفقیت ${health.workflowSuccess}`, 'فعال'],
    ['n8n', 'گردش‌کار و صف', `${health.queue} پیام در صف`, 'فعال']
  ];
  $('#healthList').innerHTML = services.map(([icon, name, detail, status]) => `<div><span class="service-icon">${icon}</span><div><strong>${name}</strong><small>${detail}</small></div><span class="status-pill complete">${status}</span></div>`).join('');
}

function reportRow(report) {
  return `<tr>
    <td><span class="report-id">${esc(report.id)}</span></td>
    <td><span class="report-title">${esc(report.subject)}</span><span class="subtle">${esc(report.project)} · ${esc(report.sender)}</span></td>
    <td><span class="status-pill ${report.stage === 'نیازمند اطلاعات' ? 'important' : report.stage === 'گردش‌کار فعال' ? 'complete' : 'normal'}">${esc(report.stage)}</span></td>
    <td><span class="status-pill ${priorityClass(report.priority)}">${esc(report.priority)}</span></td>
    <td><span class="subtle">${esc(report.receivedAt)}</span></td>
    <td><button class="text-button" data-open-report="${esc(report.id)}">بررسی ←</button></td>
  </tr>`;
}

function renderReports() {
  $('#recentReports').innerHTML = state.reports.slice(0, 3).map(reportRow).join('');
  $('#inboxList').innerHTML = state.reports.map(report => `
    <article class="inbox-item ${priorityClass(report.priority)}">
      <span class="inbox-bar"></span>
      <div><span class="report-id">${esc(report.id)}</span><h3>${esc(report.subject)}</h3><p>${esc(report.project)} · ${esc(report.sender)} · ${esc(report.receivedAt)}</p></div>
      <div class="stage"><b>${esc(report.stage)}</b>اطمینان استخراج: ${esc(report.confidence)}٪</div>
      <span class="status-pill ${priorityClass(report.priority)}">${esc(report.priority)}</span>
      <button class="open-report" data-open-report="${esc(report.id)}" aria-label="باز کردن پرونده ${esc(report.id)}">←</button>
    </article>
  `).join('');
  const awaiting = state.reports.filter(report => report.stage === 'در انتظار تأیید').length;
  $('#inboxBadge').textContent = String(state.reports.filter(report => report.stage !== 'گردش‌کار فعال').length);
  $('#approvalBadge').textContent = String(awaiting);
}

function renderApprovals() {
  const approvalReports = state.reports.filter(report => report.stage === 'در انتظار تأیید');
  $('#approvalList').innerHTML = approvalReports.length ? approvalReports.map(report => `
    <article class="approval-card">
      <span class="status-pill ${priorityClass(report.priority)}">${esc(report.priority)}</span>
      <h3>${esc(report.subject)}</h3>
      <p>${esc(report.proposal)}</p>
      <div class="approval-info"><span>پروژه<b>${esc(report.project)}</b></span><span>مدیر بخش<b>${esc(report.owner)}</b></span><span>اطمینان<b>${esc(report.confidence)}٪</b></span></div>
      <div class="approval-actions"><button class="secondary-button" data-open-report="${esc(report.id)}">بازبینی کامل</button><button class="primary-button" data-quick-approval="${esc(report.id)}">تأیید مدیرعامل</button></div>
    </article>
  `).join('') : '<div class="panel" style="padding:25px;color:var(--muted)">موردی برای تأیید باقی نمانده است.</div>';
}

function renderKanban() {
  const columns = ['برای شروع', 'در حال انجام', 'بازبینی', 'انجام‌شده'];
  const labels = { 'برای شروع': 'برای شروع', 'در حال انجام': 'در حال انجام', 'بازبینی': 'در بازبینی', 'انجام‌شده': 'انجام‌شده' };
  const tasks = state.taskFocus ? state.tasks.filter(task => task.assignee === 'مدیر ساخت' || task.assignee === 'مدیر کنترل پروژه') : state.tasks;
  $('#kanban').innerHTML = columns.map(status => {
    const items = tasks.filter(task => task.status === status);
    return `<section class="kanban-col"><header>${labels[status]}<span>${items.length}</span></header>${items.map(task => `
      <article class="task-card"><span class="status-pill ${priorityClass(task.priority)}">${esc(task.priority)}</span><h3>${esc(task.title)}</h3><p>${esc(task.acceptance)}</p><div class="task-meta"><span><span class="avatar small">${esc(task.assignee[0])}</span>${esc(task.assignee)}</span><span>${esc(task.due)}</span></div><div class="task-footer"><span>${esc(task.project)} · ${esc(task.id)}</span>${status !== 'انجام‌شده' ? `<button class="task-next" data-next-task="${esc(task.id)}">مرحلهٔ بعد ←</button>` : '<span>بایگانی شد</span>'}</div></article>
    `).join('') || '<p style="font-size:10px;color:#7c8984;padding:3px">تسکی نیست.</p>'}</section>`;
  }).join('');
}

function setDialogApproval(report) {
  const bothApproved = report.approvals.ceo === 'تأیید شده' && report.approvals.department === 'تأیید شده';
  $('#ceoState').textContent = report.approvals.ceo === 'تأیید شده' ? 'تأیید شده و ثبت در لاگ' : report.approvals.ceo;
  $('#deptState').textContent = report.approvals.department === 'تأیید شده' ? 'تأیید شده و ثبت در لاگ' : report.approvals.department;
  $$('.role-action').forEach(button => {
    const role = button.dataset.role;
    const approved = report.approvals[role] === 'تأیید شده';
    button.disabled = approved;
    button.textContent = approved ? 'تأیید شد ✓' : 'ثبت تأیید';
  });
  $('#startWorkflow').disabled = !bothApproved;
  $('#startWorkflow').textContent = report.stage === 'گردش‌کار فعال' ? 'گردش‌کار فعال شد ✓' : 'صدور گردش‌کار و تسک ←';
}

function openReport(id) {
  const report = state.reports.find(item => item.id === id);
  if (!report) return;
  state.selectedReport = report;
  $('#dialogProject').textContent = report.project;
  $('#reportDialogTitle').textContent = `پروندهٔ تصمیم · ${report.id}`;
  $('#dialogMeta').textContent = `${report.sender} · دریافت: ${report.receivedAt} · مالک: ${report.owner}`;
  $('#dialogSubject').textContent = report.subject;
  $('#dialogRootCause').textContent = report.rootCause;
  $('#dialogConfidence').textContent = `${report.confidence}٪`;
  $('#dialogPriority').textContent = report.priority;
  $('#dialogPriority').className = `status-pill ${priorityClass(report.priority)}`;
  $('#dialogFacts').innerHTML = report.facts.map(fact => `<li>${esc(fact)}</li>`).join('') || '<li>واقعیت ثبت نشده است.</li>';
  $('#dialogAnalysis').textContent = report.analysis;
  $('#dialogAssumptions').innerHTML = report.assumptions.length ? report.assumptions.map(item => `<li>${esc(item)}</li>`).join('') : '<li>فرض فعال ثبت نشده است.</li>';
  $('#dialogImpacts').innerHTML = Object.entries(report.impacts).map(([key, value]) => `<div class="impact-cell ${impactClass(value)}"><span>${esc(key)}</span><b>${esc(value)}</b></div>`).join('');
  $('#dialogProposal').textContent = report.proposal;
  setDialogApproval(report);
  $('#reportDialog').showModal();
}

async function approve(role) {
  const report = state.selectedReport;
  if (!report) return;
  try {
    const result = await api(`/api/reports/${encodeURIComponent(report.id)}/approve`, { method: 'POST', body: JSON.stringify({ role }) });
    Object.assign(report, result.data);
    setDialogApproval(report);
    renderReports(); renderApprovals();
    showToast(role === 'ceo' ? 'تأیید مدیرعامل با شناسهٔ ممیزی ثبت شد.' : 'تأیید مدیر بخش ثبت شد.');
  } catch (error) { showToast(error.message); }
}

async function returnForData() {
  const report = state.selectedReport;
  if (!report) return;
  try {
    const result = await api(`/api/reports/${encodeURIComponent(report.id)}/return`, { method: 'POST', body: JSON.stringify({ comment: 'نیاز به تکمیل دادهٔ منبع و اعتبارسنجی فرض‌ها' }) });
    Object.assign(report, result.data);
    $('#reportDialog').close();
    renderReports(); renderApprovals();
    showToast('پرونده برای تکمیل داده و اعتبارسنجی فرض‌ها بازگشت داده شد.');
  } catch (error) { showToast(error.message); }
}

function activateView(view) {
  $$('.view').forEach(item => item.classList.toggle('active', item.id === view));
  $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === view));
  const titles = { overview: ['عملیات امروز', 'نمای کلی'], inbox: ['Gmail و تحلیل هوشمند', 'صندوق گزارش‌ها'], approvals: ['تصمیم‌سازی کنترل‌شده', 'کارتابل تأییدها'], tasks: ['اجرا تا نتیجه', 'تسک‌های من'], knowledge: ['دانش سازمانی', 'درس‌آموخته‌ها'], operations: ['پایش و تاب‌آوری', 'مرکز عملیات'] };
  $('#pageEyebrow').textContent = titles[view][0];
  $('#pageTitle').textContent = titles[view][1];
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function advanceTask(id) {
  const task = state.tasks.find(item => item.id === id);
  const sequence = ['برای شروع', 'در حال انجام', 'بازبینی', 'انجام‌شده'];
  const next = sequence[sequence.indexOf(task.status) + 1];
  if (!next) return;
  try {
    const result = await api(`/api/tasks/${encodeURIComponent(id)}/status`, { method: 'POST', body: JSON.stringify({ status: next }) });
    Object.assign(task, result.data);
    renderKanban();
    showToast(`تسک به مرحلهٔ «${next}» منتقل شد.`);
  } catch (error) { showToast(error.message); }
}

function bindEvents() {
  document.addEventListener('click', event => {
    const nav = event.target.closest('[data-view]');
    if (nav) activateView(nav.dataset.view);
    const link = event.target.closest('[data-view-link]');
    if (link) activateView(link.dataset.viewLink);
    const open = event.target.closest('[data-open-report]');
    if (open) openReport(open.dataset.openReport);
    const quick = event.target.closest('[data-quick-approval]');
    if (quick) { openReport(quick.dataset.quickApproval); window.setTimeout(() => approve('ceo'), 0); }
    const role = event.target.closest('[data-role]');
    if (role) approve(role.dataset.role);
    const nextTask = event.target.closest('[data-next-task]');
    if (nextTask) advanceTask(nextTask.dataset.nextTask);
  });
  $('#closeDialog').addEventListener('click', () => $('#reportDialog').close());
  $('#returnForData').addEventListener('click', returnForData);
  $('#startWorkflow').addEventListener('click', () => { $('#reportDialog').close(); renderReports(); renderApprovals(); showToast('گردش‌کار n8n صادر شد؛ تسک‌ها در کارتابل نقش‌ها قابل مشاهده‌اند.'); });
  $('#quickApprove').addEventListener('click', () => { openReport('REP-1405-021'); window.setTimeout(() => approve('ceo'), 0); });
  $('#showFlowButton').addEventListener('click', () => { activateView('inbox'); showToast('هر ورودی از گیت واقعیت، فهم مسئله و تصمیم‌سازی عبور می‌کند.'); });
  $('#newReportButton').addEventListener('click', () => $('#newReportDialog').showModal());
  $$('[data-close-mini]').forEach(button => button.addEventListener('click', () => $('#newReportDialog').close()));
  $('#newKnowledgeButton').addEventListener('click', () => showToast('در محیط تولید، فرم دانش به مالک و تأییدکنندهٔ موضوعی متصل می‌شود.'));
  $('#taskFocusButton').addEventListener('click', event => { state.taskFocus = !state.taskFocus; event.currentTarget.textContent = state.taskFocus ? 'نمایش همهٔ تسک‌ها' : 'فقط تسک‌های من'; renderKanban(); });
  $('#refreshOps').addEventListener('click', () => showToast('وضعیت سرویس‌ها و شاخص‌های صف تازه‌سازی شد.'));
  $$('.filter').forEach(button => button.addEventListener('click', () => { $$('.filter').forEach(item => item.classList.remove('active')); button.classList.add('active'); const target = button.textContent.trim(); const displayed = target === 'همه' ? state.reports : state.reports.filter(r => target === 'بحرانی' ? r.priority === 'بحرانی' : r.stage === 'نیازمند اطلاعات'); $('#inboxList').innerHTML = displayed.map(report => `<article class="inbox-item ${priorityClass(report.priority)}"><span class="inbox-bar"></span><div><span class="report-id">${esc(report.id)}</span><h3>${esc(report.subject)}</h3><p>${esc(report.project)} · ${esc(report.sender)}</p></div><div class="stage"><b>${esc(report.stage)}</b>اطمینان استخراج: ${esc(report.confidence)}٪</div><span class="status-pill ${priorityClass(report.priority)}">${esc(report.priority)}</span><button class="open-report" data-open-report="${esc(report.id)}">←</button></article>`).join('') || '<p style="padding:20px;color:var(--muted)">موردی یافت نشد.</p>'; }));
  $('#searchInput').addEventListener('input', event => { const term = event.target.value.trim(); if (!term) return; const found = [...state.reports, ...state.tasks].filter(item => Object.values(item).some(value => String(value).includes(term))); if (found.length) { activateView(found[0].id.startsWith('REP') ? 'inbox' : 'tasks'); showToast(`${found.length} نتیجه برای «${term}» یافت شد.`); } });
  $('#newReportForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = { project: form.get('project'), subject: form.get('subject'), facts: String(form.get('facts')).split('\n').map(item => item.trim()).filter(Boolean), sender: 'ثبت دستی مدیر', confidence: 0 };
    try {
      const result = await api('/api/webhooks/n8n/report', { method: 'POST', body: JSON.stringify(payload) });
      state.reports.unshift(result.data);
      event.currentTarget.reset(); $('#newReportDialog').close(); renderReports(); renderApprovals(); activateView('inbox'); showToast('گزارش ثبت شد و برای بررسی UGOS در صف قرار گرفت.');
    } catch (error) { showToast(error.message); }
  });
}

async function init() {
  try {
    const [dashboard, reports, tasks] = await Promise.all([api('/api/dashboard'), api('/api/reports'), api('/api/tasks')]);
    state.dashboard = dashboard; state.reports = reports.data; state.tasks = tasks.data;
    renderMetrics(); renderHealth(); renderReports(); renderApprovals(); renderKanban(); bindEvents();
  } catch (error) {
    document.body.innerHTML = `<main style="padding:40px;font-family:Tahoma"><h1>داشبورد در دسترس نیست</h1><p>${esc(error.message)}</p><p>مطمئن شوید سرور با <code>node server.js</code> اجرا شده است.</p></main>`;
  }
}

init();
