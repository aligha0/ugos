# مدل دامنه UGOS

هسته محصول **Case** است، نه صفحه داشبورد و نه خود Report.

```
Signal (Report / API / فرم)
        ↓
       CASE
   ┌─────┴─────┐
Evidence     Problem
   └─────┬─────┘
     Decision
         ↓
      Approval
         ↓
        Task
         ↓
      Outcome
         ↓
   LessonLearned
```

Report فقط یکی از ورودی‌های ایجاد Case است. n8n و Gmail منبع حقیقت نیستند.

مرجع وضعیت‌ها: [state-machine.md](./state-machine.md)

## موجودیت‌ها

### Case
واحد کاری حاکمیت تصمیم. هر Case یک مسئله عملیاتی است که باید قبل از اجرا ساختاربندی، تأیید و پیگیری شود.

فیلدهای اصلی: `id`, `projectId`, `ownerId`, `priority`, `status`, `source`

### Report
سیگنال ورودی. می‌تواند به یک Case جدید تبدیل شود یا به Case موجود بچسبد.

| فیلد | معنی | هسته نیست |
|---|---|---|
| `subject` | عنوان کوتاه | عنوان ≠ تعریف مسئله |
| `sender` | فرستنده سیگنال | — |
| `receivedAt` | زمان دریافت | — |

### Problem
تعریف مسئله، جدا از عنوان و جدا از علت.

| فیلد | مثال |
|---|---|
| `statement` | کاهش ۵۰٪ ظرفیت تأمین‌کننده، بتن‌ریزی سقف طبقه ۸ را تهدید می‌کند |
| `rootCause` | وابستگی به یک تأمین‌کننده بدون ظرفیت رزرو |
| `subject` (روی Case/Report) | تأخیر تأمین بتن |

`problemDefined` فقط با `problem.statement` پر و معتبر برقرار است.

### Evidence
شواهد موجودیتی مستقل است، نه رشته داخل آرایه.

| فیلد | الزام v1 |
|---|---|
| `content` | بله |
| `source` | توصیه‌شده |
| `type` | observation / document / measurement / testimony |
| `timestamp` | توصیه‌شده |
| `verified` | بله/خیر |
| `reliability` | اختیاری |

کفایت شواهد در گیت فعلی: حداقل دو مدرک، یا یک مدرک با `source` یا `verified`.

### Assumption
فرض آشکارشده. حتی آرایه خالی معتبر است؛ فرض پنهان مجاز نیست.

### Impact
اثر چندبعدی: فنی، مالی، زمانی، حقوقی، انسانی، اعتباری — با سطح low/medium/high.

### Decision
گزینه و حکم. هنوز موتور کامل کیفیت نیست؛ حداقل فیلدهای Core v1:

- `options[]`
- `recommendation`
- `rationale`
- `riskLevel`
- `confidence`

Task فقط از Decision تأییدشده صادر می‌شود.

### Approval
رخداد نقش‌دار: چه کسی، با کدام نقش، چه عملی (`approve` / `reject` / `return_for_data`)، چه زمانی، چه توضیحی.

نقش در MVP از بدنه درخواست می‌آید؛ در Core v1 باید از هویت سرور بیاید.

### Task
اقدام اجرایی بعد از Approval. مالک، موعد، معیار پذیرش، وضعیت.

### Outcome
نتیجه واقعی پس از اجرا. بدون Outcome، Case بستهٔ کامل نیست.

### AuditEvent
append-only. همزمان با persistence طراحی می‌شود، نه به‌عنوان افزونه بعدی.

حداقل: `actor`, `action`, `entityType`, `entityId`, `before`, `after`, `reason`, `source`, `correlationId`, `createdAt`

## گیت فعلی در برابر موتور تصمیم

| الان (Completeness Gate) | هدف Core v1 (Quality Engine) |
|---|---|
| مسئله تعریف شده | `problem.statement` جدا از subject |
| شواهد کافی | Evidence entity + منبع/تأیید/تعداد |
| علت ریشه‌ای | علت ≠ مسئله ≠ عنوان |
| فرض‌ها آشکار | فرض‌های متعارض |
| اثر ثبت شده | اثر مالی/زمانی/حقوقی تفکیک‌شده |
| مالک | مالک + approver از RBAC |
| تأیید کامل | تاریخچه Approval واقعی |
| — | options, rationale, confidence, freshness |

## نگاشت کد فعلی

| کد MVP | دامنه |
|---|---|
| شیء `report` در حافظه | Case + Report به‌صورت فشرده |
| `report.subject` | عنوان |
| `report.problemStatement` | Problem.statement |
| `report.facts` | Evidence (رشته یا شیء) |
| `report.rootCause` | Problem.rootCause |
| `lib/decision.js` | Completeness Gate روی Case |

تا قبل از PostgreSQL این مدل منبع حقیقت معماری است. جدول‌ها باید از روی همین سند ساخته شوند، نه از روی شکل UI.
