# WhatsApp Number Verification Specification
Version: 1.0

## Overview

This specification describes a secure, user-initiated WhatsApp number verification flow using the official Meta WhatsApp Business Cloud API.

Unlike SMS OTP, this approach verifies ownership by requiring the user to send a WhatsApp message to the platform's official Business Account.

The solution is intended to become a **shared platform service** within the Community Platform so every ecosystem application can rely on a single verified WhatsApp identity.

---

# Goals

- Verify that a user actually owns the WhatsApp number they entered.
- Avoid SMS OTP costs.
- Leverage Meta's free monthly user-initiated conversations.
- Keep verification centralized within Community Platform.
- Produce an auditable verification history.
- Allow future ecosystem apps to trust the verified phone number.

---

# High Level Architecture

```
Browser
    │
    │ Request verification
    ▼
Community Platform Backend
    │
    │ Generate verification code
    ▼
Redis
    │
    │ Store temporary verification session
    ▼
User clicks Verify
    │
    ▼
WhatsApp
    │
    │ User sends message
    ▼
Meta Cloud API
    │
    │ Incoming Webhook
    ▼
Community Platform Backend
    │
    │ Verify code
    │
    │ Update profile
    │
    │ Log governance event
    ▼
Supabase
```

---

# Verification Flow

## Step 1

Authenticated user opens Profile page.

Current status:

```
WhatsApp Number

628123456789

Status:
Not Verified
```

---

## Step 2

User enters their WhatsApp number.

Example

```
08123456789
```

Backend normalizes it into

```
628123456789
```

---

## Step 3

Backend generates a verification session.

Example

```
VERIFY-A81QW
```

Store inside Redis.

```
Key

VERIFY-A81QW

Value

{
    user_id,
    normalized_phone,
    created_at,
    expires_at,
    browser_session_id
}
```

TTL

```
5 minutes
```

---

## Step 4

Backend returns

```
https://wa.me/<business_number>?text=VERIFY-A81QW
```

Frontend displays

```
Verify via WhatsApp
```

---

## Step 5

User taps button.

WhatsApp opens automatically.

Prefilled message

```
VERIFY-A81QW
```

User presses Send.

---

## Step 6

Meta sends webhook.

Webhook payload includes

- sender phone number
- message body
- message id
- timestamp

Example

```
from

628123456789

text

VERIFY-A81QW
```

---

## Step 7

Backend validates

- verification code exists
- code not expired
- code unused
- normalized sender number equals expected number

If successful

- delete Redis entry
- update profile
- create audit log
- notify frontend

---

## Step 8

Frontend detects successful verification.

Display

```
✅ WhatsApp Verified
```

No page refresh required.

---

# Database Changes

## profiles

Add columns

```sql
whatsapp_number TEXT

whatsapp_verified_at TIMESTAMPTZ

whatsapp_verification_method TEXT
```

Example

```
whatsapp_number

628123456789

verified_at

2026-08-03T12:00Z

verification_method

meta_cloud
```

---

## Constraints

Normalize every number into E.164 format.

Indonesia example

```
08123456789

↓

628123456789
```

Prevent duplicate ownership.

Recommended

```sql
UNIQUE (whatsapp_number)
WHERE whatsapp_verified_at IS NOT NULL;
```

---

# Verification Log

Create

```
whatsapp_verification_logs
```

Suggested columns

```sql
id UUID

profile_id UUID

phone_number TEXT

verification_code TEXT

status TEXT

meta_message_id TEXT

verified_at TIMESTAMPTZ

created_at TIMESTAMPTZ

ip_address TEXT

user_agent TEXT
```

Purpose

- auditing
- troubleshooting
- security investigation

---

# Governance Event

Insert into

```
governance_events
```

Action

```
PROFILE_WHATSAPP_VERIFIED
```

Metadata example

```json
{
  "phone": "628123456789",
  "method": "meta_cloud"
}
```

---

# Redis Structure

Key

```
VERIFY-A81QW
```

Value

```json
{
    "user_id": "...",
    "phone": "628123456789",
    "created_at": "...",
    "expires_at": "...",
    "used": false
}
```

TTL

```
5 minutes
```

Immediately delete after successful verification.

---

# Webhook Processing

Upon receiving webhook

1. Validate Meta signature.
2. Parse incoming message.
3. Normalize sender phone.
4. Find verification session.
5. Reject expired session.
6. Reject reused session.
7. Reject mismatched phone.
8. Update profile.
9. Create verification log.
10. Create governance event.
11. Delete Redis key.
12. Return HTTP 200 immediately.

Heavy processing should happen asynchronously if possible.

---

# Security

## Verification Code

- Random
- Cryptographically secure
- Single use
- Five-minute expiration

---

## Replay Protection

Successful verification immediately removes Redis entry.

Verification code can never be reused.

---

## Duplicate Numbers

One verified WhatsApp number can belong to only one account.

Reject attempts to verify a number already owned by another approved user.

---

## Rate Limiting

### Per User

```
Maximum

5 verification requests/hour
```

---

### Per IP

```
Maximum

20 requests/hour
```

---

### Per Phone Number

```
Maximum

3 verification attempts/hour
```

---

## Phone Normalization

Store only canonical format.

Example

```
0812xxxx

+62812xxxx

62812xxxx

↓

62812xxxx
```

---

## Meta Verification

Always verify

- webhook signature
- sender phone number
- verification code

Never trust only the message body.

---

# Verification State Machine

```
UNVERIFIED

↓

PENDING

↓

VERIFIED
```

Possible future states

```
REVOKED

REVERIFY_REQUIRED
```

---

# Frontend UX

Current screen

```
WhatsApp Number

[628123456789]

Status

Not Verified

[ Verify via WhatsApp ]
```

After button click

```
Opening WhatsApp...
```

After sending

```
Waiting for verification...
```

Frontend polls

```
GET /api/profile
```

every

```
2 seconds
```

Maximum

```
60 seconds
```

Alternative

Use Supabase Realtime or WebSocket to instantly notify browser.

---

# Error Handling

Expired

```
Verification code expired.

Please generate a new verification code.
```

Already Verified

```
This WhatsApp number has already been verified.
```

Duplicate Number

```
This WhatsApp number is already associated with another account.
```

Invalid Code

```
Verification failed.

Please try again.
```

---

# Future Enhancements

- Support WhatsApp Business Templates for notifications.
- Allow administrators to revoke verification.
- Automatic re-verification when phone number changes.
- Display verification history in Admin Dashboard.
- Add analytics for verification success rate.
- Add support for multiple verified contact methods (WhatsApp, SMS, Email).

---

# Design Principles

- Platform-first, not application-specific.
- User-centric rather than browser-session-centric.
- Secure by default.
- Single source of truth for verified phone numbers.
- Fully auditable.
- Future-proof for ecosystem expansion.