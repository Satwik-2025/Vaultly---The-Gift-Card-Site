# Security

## Reporting a vulnerability

Please **don't open a public issue** for a security problem. Email
**satwikgupta2005@gmail.com** with what you found and how to reproduce it. You'll get a reply as
soon as I can manage, and I'll credit you in the fix if you'd like.

## What's in scope

Vaultly has accounts, so these matter most:

- sign-up, sign-in and session handling (`server/auth-core.mjs`, `api/auth/[action].mjs`);
- saved cards and anything else stored per account;
- the live re-check endpoint (`api/refresh/[brandId].mjs`).

## How accounts are protected

- Passwords are hashed with **scrypt** on the server and never stored as typed.
- Sessions are a random token in an **`HttpOnly`, `SameSite=Lax`, `Secure`** cookie. The database
  holds only a hash of the token.
- Wrong sign-in attempts are rate-limited per email and per network.
- Sign-in answers identically for "no such account" and "wrong password", and takes the same time
  for both.
- No credentials, tokens or keys are committed — they're environment variables on Vercel.

## Out of scope

- Prices or terms that are wrong. That's a data problem, not a security one — please use the
  *Wrong price or term* issue template.
- Findings that need a rooted device, a compromised browser, or physical access.
