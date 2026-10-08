# Project logs

Append-only daily logs (one `YYYY-MM-DD.md` per working day), giving every
developer the context of earlier changes before touching the code (ADR-15).
`logs/*.md` is `merge=union` so parallel branches never conflict here.

**Dates are IST (Asia/Kolkata), not UTC.** Name each file by the current IST
date: `TZ=Asia/Kolkata date '+%Y-%m-%d'`.
