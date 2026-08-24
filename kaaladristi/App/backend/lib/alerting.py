"""
lib/alerting.py
===============
The alert channel the backend did not have.

Audit 2026-08-03: `grep alert|notify|smtp|telegram|webhook` over
pipeline2/ + lib/ returned ZERO hits — the Pipeline Dashboard is
pull-only, so a silent failure stayed silent until somebody happened to
look. Three real bugs (and two more found by hand on 2026-08-24) lived
in that gap.

Design: transport-agnostic and OPT-IN. Nothing here fails a pipeline run
— an alert that breaks the job it is reporting on is worse than no alert.
Configure by env; unset = the dispatcher no-ops and says so.

    ALERT_WEBHOOK_URL   generic JSON POST — Slack / Telegram-bridge /
                        Discord / n8n / anything that takes a webhook
    ALERT_EMAIL_TO      comma-separated recipients (needs SMTP_* below)
    SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD / SMTP_FROM

Findings are always persisted to km_integrity_findings regardless of
whether a transport is configured — the DB is the durable record and the
dashboard reads it; transports are only the push.
"""

from __future__ import annotations

import json
import os
import smtplib
import urllib.request
from email.message import EmailMessage
from typing import Iterable

ALERT_TIMEOUT_SECONDS = 10


def _env(key: str) -> str | None:
    v = os.getenv(key)
    return v.strip() if v and v.strip() else None


def transports_configured() -> list[str]:
    out = []
    if _env('ALERT_WEBHOOK_URL'):
        out.append('webhook')
    if _env('ALERT_EMAIL_TO') and _env('SMTP_HOST'):
        out.append('email')
    return out


def _post_webhook(url: str, subject: str, body: str, payload: dict) -> None:
    data = json.dumps({
        'text': f'{subject}\n\n{body}',   # Slack/Discord-compatible
        'subject': subject,
        'body': body,
        'findings': payload.get('findings', []),
        'source': 'kaaladristi-integrity',
    }).encode('utf-8')
    req = urllib.request.Request(url, data=data,
                                 headers={'Content-Type': 'application/json'})
    urllib.request.urlopen(req, timeout=ALERT_TIMEOUT_SECONDS).read()


def _send_email(subject: str, body: str) -> None:
    host = _env('SMTP_HOST')
    port = int(_env('SMTP_PORT') or 587)
    user = _env('SMTP_USER')
    password = _env('SMTP_PASSWORD')
    sender = _env('SMTP_FROM') or user or 'kaaladristi@localhost'
    recipients = [r.strip() for r in (_env('ALERT_EMAIL_TO') or '').split(',') if r.strip()]
    if not (host and recipients):
        return

    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = sender
    msg['To'] = ', '.join(recipients)
    msg.set_content(body)

    with smtplib.SMTP(host, port, timeout=ALERT_TIMEOUT_SECONDS) as smtp:
        try:
            smtp.starttls()
        except Exception:
            pass          # plain SMTP relay
        if user and password:
            smtp.login(user, password)
        smtp.send_message(msg)


def dispatch(subject: str, body: str, payload: dict | None = None,
             verbose: bool = True) -> list[str]:
    """Push an alert to every configured transport. Returns the transports
    that succeeded. NEVER raises — a transport failure is logged, not
    propagated, so alerting can't take down the pipeline."""
    payload = payload or {}
    sent: list[str] = []

    url = _env('ALERT_WEBHOOK_URL')
    if url:
        try:
            _post_webhook(url, subject, body, payload)
            sent.append('webhook')
        except Exception as e:
            if verbose:
                print(f'  [alert] webhook failed: {e}')

    if _env('ALERT_EMAIL_TO') and _env('SMTP_HOST'):
        try:
            _send_email(subject, body)
            sent.append('email')
        except Exception as e:
            if verbose:
                print(f'  [alert] email failed: {e}')

    if verbose and not sent:
        configured = transports_configured()
        if configured:
            print(f'  [alert] all configured transports failed ({", ".join(configured)})')
        else:
            print('  [alert] no transport configured (set ALERT_WEBHOOK_URL or '
                  'ALERT_EMAIL_TO + SMTP_HOST) — findings persisted to '
                  'km_integrity_findings only')
    return sent


def format_findings(findings: Iterable) -> tuple[str, str]:
    """(subject, body) for a batch of Finding objects, severity-ordered."""
    fs = list(findings)
    crit = [f for f in fs if f.severity == 'critical']
    warn = [f for f in fs if f.severity == 'warning']

    if crit:
        subject = f'[KaalaDristi] {len(crit)} CRITICAL data finding(s)' + (
            f' + {len(warn)} warning(s)' if warn else '')
    elif warn:
        subject = f'[KaalaDristi] {len(warn)} data warning(s)'
    else:
        subject = '[KaalaDristi] data integrity clean'

    lines = []
    for label, group in (('CRITICAL', crit), ('WARNING', warn)):
        if not group:
            continue
        lines.append(f'{label}:')
        for f in group:
            lines.append(f'  · [{f.check_class}] {f.summary}')
        lines.append('')
    if not lines:
        lines = ['All integrity checks passed.']
    return subject, '\n'.join(lines)
