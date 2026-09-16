# معماری تولید UGOS

این سند مرز MVP فعلی را با مسیر تولید مشخص می‌کند. نسخهٔ جاری داده را در حافظه نگه می‌دارد و منبع حقیقت نیست.

## حلقهٔ محصول

```
Signal → Evidence → Decision → Approval → Action → Outcome → Learning
```

n8n، Gmail و مدل زبانی ابزار پیرامونی‌اند، نه هسته.

## لایه‌ها

```
UGOS Core          Reports, Decisions, Approvals, Tasks, Audit, Knowledge
Intelligence       استخراج، ساختاربندی، اطمینان، بازبینی انسانی
Automation         n8n / Gmail / Slack / Webhooks
```

## وضعیت فعلی در برابر تولید

| بخش | MVP | تولید |
|---|---|---|
| داده | آرایه در حافظه | PostgreSQL |
| فایل | ندارد | Object Storage سازگار با S3 |
| صف | شبیه‌سازی UI | Redis / صف پایدار |
| هویت | نقش انتخابی در UI | Auth + RBAC با محدوده سازمان/پروژه |
| ممیزی | `auditId` تصادفی | AuditLog غیرقابل‌تغییر |
| وب‌هوک | secret اختیاری در توسعه | secret اجباری، حداقل ۳۲ نویسه |
| مشاهده‌پذیری | اعداد نمایشی | Logs + Metrics + Traces |

اگر `NODE_ENV=production` باشد و `N8N_WEBHOOK_SECRET` خالی باشد، وب‌هوک Intake رد می‌شود.

## کنترل‌های امنیتی حداقل

- HTTPS
- مقایسهٔ secret با `timingSafeEqual`
- محدودسازی بدنهٔ درخواست (۱MB)
- جلوگیری از path traversal در فایل استاتیک
- RBAC: تأیید فقط با نقش مجاز سمت سرور (هنوز در MVP نقش از بدنه می‌آید)
- پشتیبان و آزمون بازیابی
- Rate limit روی وب‌هوک و API

## استقرار پیشنهادی

1. سرویس API پشت reverse proxy
2. پایگاه داده جدا با مهاجرت نسخه‌دار
3. n8n در شبکهٔ خصوصی؛ فقط به `/api/webhooks/n8n/report` دسترسی داشته باشد
4. CI: lint + `npm test` قبل از merge
5. Staging با دادهٔ مصنوعی، سپس production

## CI/CD حداقلی

```
feature branch → PR → test → review → main
```

بازنویسی تاریخچهٔ کامیت اولیه («Add files via upload») لازم نیست؛ از این نقطه کامیت‌های معنادار کافی است.
