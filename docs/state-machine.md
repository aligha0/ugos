# ماشین حالت UGOS

هر انتقال باید صریح، قابل‌تست و قابل‌ممیزی باشد. Task قبل از Decision تأییدشده وجود ندارد.

## Case

```
INTAKE
  → NEEDS_REVIEW
      → NEEDS_DATA ⇄ NEEDS_REVIEW
      → PENDING_APPROVAL
          → APPROVED
              → EXECUTING
                  → COMPLETED
                      → REVIEWED
                          → CLOSED
          → REJECTED
          → NEEDS_DATA
```

| وضعیت | معنی | خروج مجاز |
|---|---|---|
| `INTAKE` | سیگنال ثبت شد | بررسی اولیه |
| `NEEDS_REVIEW` | Case ساخته شده؛ گیت هنوز کامل نیست | تکمیل شواهد / ارسال به تأیید / ارجاع داده |
| `NEEDS_DATA` | ارجاع برای کمبود شواهد یا فرض | بازگشت به بررسی پس از تکمیل |
| `PENDING_APPROVAL` | گیت completeness برای ورود به تأیید برقرار است | approve / reject / return |
| `APPROVED` | تأییدهای لازم ثبت شد | صدور Task |
| `EXECUTING` | حداقل یک Task فعال | تکمیل تسک‌ها |
| `COMPLETED` | تسک‌ها تمام شده | ثبت Outcome |
| `REVIEWED` | Outcome بررسی شده | بستن / درس‌آموخته |
| `CLOSED` | پایان | هیچ (جز بایگانی) |
| `REJECTED` | تصمیم رد شد | فقط audit |

### نگهبان‌های مهم Case

- `NEEDS_REVIEW → PENDING_APPROVAL` فقط اگر `problemDefined` و `evidenceSufficient` و `rootCauseKnown` و `impactAssessed`
- `PENDING_APPROVAL → APPROVED` فقط اگر Approvalهای الزامی کامل باشند **و** گیت هنوز برقرار باشد
- `APPROVED → EXECUTING` فقط با ایجاد حداقل یک Task دارای owner و acceptance criteria
- `EXECUTING → COMPLETED` فقط اگر هیچ Task باز یا مسدودِ اجباری نماند
- `COMPLETED → CLOSED` فقط با Outcome ثبت‌شده

معادل فارسی UI فعلی:

| کد | برچسب فعلی |
|---|---|
| `NEEDS_REVIEW` | نیازمند بررسی |
| `NEEDS_DATA` | نیازمند اطلاعات |
| `PENDING_APPROVAL` | در انتظار تأیید |
| `EXECUTING` | گردش‌کار فعال |

## Evidence

`RECORDED → VERIFIED | DISPUTED`

شواهد disputed گیت را برای `PENDING_APPROVAL` نگه می‌دارد مگر Evidence جایگزین verified باشد.

## Decision

`DRAFT → PROPOSED → PENDING_APPROVAL → APPROVED | REJECTED | RETURNED`

در MVP فعلی Decision داخل همان شیء Case فشرده است. در Core v1 جدول جدا می‌شود.

## Approval

رویداد است نه وضعیت طولانی‌مدت. زنجیره:

`requested → approve | reject | return_for_data`

هر رویداد یک `AuditEvent` می‌سازد.

## Task

`TODO → IN_PROGRESS → REVIEW → DONE`

معادل فارسی: برای شروع → در حال انجام → بازبینی → انجام‌شده

پریدن به عقب فقط با دلیل ثبت‌شده (مثلاً رد بازبینی: `REVIEW → IN_PROGRESS`).

## Outcome

`DRAFT → RECORDED → REVIEWED`

بدون `RECORDED` نمی‌توان Case را `CLOSED` کرد.

## قانون طلایی

```
اگر گیت تصمیم fail است → Task نساز
اگر Approval ناقص است → Task نساز
اگر Outcome نیست → Case را CLOSED نکن
هر انتقال → AuditEvent
```
