# Security Policy

## Supported Versions

| Version | Security Updates |
|---------|-----------------|
| 1.1.x   | ✅ Current       |
| 1.0.x   | ⚠️ Upgrade recommended |
| < 1.0   | ❌ No support   |

---

## Architecture & Trust Boundaries

Understanding Nodex's architecture is essential context for security research:

- **No backend server.** There is nothing to attack remotely. All logic runs inside Chrome.
- **Zero network egress.** The extension makes no outbound requests. MediaPipe models and all assets are bundled locally.
- **Camera data never leaves the browser.** Frames are processed in-memory by a local WASM binary and discarded after gesture inference. No recording, no storage of video.
- **Two isolated content worlds.** The MAIN world runs the MediaPipe bridge; the ISOLATED world runs gesture logic. Communication is via `window.postMessage` with origin validation.
- **Permissions scope:** `storage`, `sidePanel`, `scripting`, `tabs` — plus `host_permissions` restricted to `https://www.youtube.com/*` only.

---

## Scope

### In Scope

| Area | Examples |
|---|---|
| Content script injection | Script injection into unintended origins, CSP bypass |
| Message passing | Spoofing `window.postMessage` between MAIN / ISOLATED worlds, forged `chrome.runtime.sendMessage` |
| Storage | Unauthorized read/write of `chrome.storage.local` (calibration, gesture maps, settings) |
| Camera permission abuse | Any vector that causes the camera to activate without explicit user action |
| Privilege escalation | Gaining capabilities beyond declared `manifest.json` permissions |
| Supply chain | Compromised build output, tampered `dist/` assets |
| XSS via injected UI | Shadow DOM escape, script execution via HUD or side panel |

### Out of Scope

- Vulnerabilities in Chrome itself or the Chrome Extensions platform
- Vulnerabilities in MediaPipe (report to [Google](https://g.co/vulnreward))
- Attacks requiring physical access to the user's machine
- Social engineering attacks against the user
- Self-XSS (requires the attacker to already have code execution)
- Denial of service against the local machine (high CPU from camera processing is expected behavior)
- Reports about `wasm-unsafe-eval` in CSP — this is a documented, intentional requirement for running the MediaPipe WASM binary locally

---

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report privately by email:

**khegai.dev@gmail.com**

Use the subject line: `[SECURITY] Nodex — <brief description>`

### What to include

1. **Description** — What is the vulnerability and what can an attacker achieve?
2. **Steps to reproduce** — Minimal, clear reproduction steps
3. **Impact** — Who is affected and under what conditions?
4. **Affected version** — Which extension version did you test against?
5. **Proof of concept** — Code snippet, screen recording, or extension build (optional but helpful)

PGP encryption is not required but you may request a public key before sending sensitive details.

---

## Response Timeline

| Milestone | Target |
|---|---|
| Acknowledgement | Within 48 hours |
| Initial assessment | Within 5 business days |
| Fix or mitigation shipped | Within 30 days for critical/high; 90 days for medium/low |
| Public disclosure | Coordinated with reporter after fix is released |

We follow **responsible disclosure**: if you give us reasonable time to fix the issue before publishing, we will credit you in the release notes.

---

## Severity Guidance

We use a simplified CVSS-based classification:

| Severity | Example |
|---|---|
| **Critical** | Remote code execution in the extension context; camera activates without user consent |
| **High** | Cross-origin data exfiltration; persistent storage corruption leading to data loss |
| **Medium** | UI spoofing inside the side panel; gesture commands injected by a malicious YouTube page |
| **Low** | Information disclosure limited to non-sensitive data; requires significant user interaction |

---

## Bug Bounty

Nodex is an open-source project maintained by a solo developer. There is no formal paid bug bounty program at this time. Verified valid security reports will receive **public credit** in the changelog and release notes.

---

## Known Limitations (Not Security Issues)

These are documented design trade-offs, not vulnerabilities:

- **`wasm-unsafe-eval` in CSP** — required to load the MediaPipe WASM binary. All WASM is bundled with the extension; no remote code is loaded.
- **`window.postMessage` between content worlds** — origin is validated (`e.source !== window` check), but the MAIN world and ISOLATED world share the same page origin by design. This is required by the Chrome MV3 two-world architecture.
- **Camera light stays on while engine runs** — intentional. The camera is explicitly released (all tracks stopped) when the user clicks Stop or navigates away from YouTube.

---

*Last updated: April 2026 — Nodex v1.1.0*
