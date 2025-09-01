# 🔐 Security Policy (Readr)

## Table of Contents
- [Supported Versions](#supported-versions)
- [Reporting a Vulnerability](#reporting-a-vulnerability-private-no-email-required)
- [Rules of Engagement (Testing Guidelines)](#rules-of-engagement-testing-guidelines)
- [What to Include](#what-to-include)
- [Response & Disclosure](#response--disclosure)
- [Severity & Target Timelines](#severity--target-timelines)
- [In Scope (examples for this project)](#in-scope-examples-for-this-project)
- [Out of Scope (for this project)](#out-of-scope-for-this-project)
- [CVE & Public Advisory](#cve--public-advisory)
- [Researcher Credit](#researcher-credit)
- [Safe Harbor](#safe-harbor)

## Supported Versions
This is an active project under development. Please report security issues against the `main` branch. Older tags may not be maintained.

## Reporting a Vulnerability (Private, no email required)
Please **do not** open a public issue for vulnerabilities.

Use GitHub's private flow:
- Go to the repository’s **Security → Report a vulnerability** in this repo, or open: https://github.com/conorgregson/reading-log-app/security/advisories/new

Include the steps to reproduce, impact, and any suggested fixes. If private reporting is temporarily unavailable, you may open a minimal public issue stating “Security report sent privately” (no technical details), and the maintainer will follow up.

## Rules of Engagement (Testing Guidelines)
- Test only with your own data and accounts.
- Don't disrupt service (no DDoS, excessive automated scanning).
- No social engineering, phishing, or attacks on non-project infrastructure.
- Share PoCs **privately** via the advisory thread. Please avoid submitting sensitive personal data in PoCs.

## What to Include
- Affected files/paths and steps to reproduce
- Expected vs. actual behavior
- Environment details (browser/version)
- Any PoC you can safely share privately

## Response & Disclosure
- We’ll acknowledge your report within **7 days**.
- We aim to provide a remediation plan or fix within **30 days**, depending on severity.
- After a fix is released, we’ll coordinate a safe disclosure window if needed.
- **Note**: We don't offer bounties at this time.

## Severity & Target Timelines
| Severity | Triage Ack | Target Fix/Plan |
|---|---:|---:|
| Critical | ≤ 3 days | ≤ 14 days |
| High     | ≤ 7 days | ≤ 30 days |
| Medium   | ≤ 14 days | ≤ 60 days |
| Low      | ≤ 21 days | Next reasonable release |

## In Scope (examples for this project)
- Stored or reflected **XSS** via book fields or **JSON import** paths.
- Logic flaws that read/write unexpected `localStorage` keys.
- **DOM clobbering** / prototype pollution leading to code execution.

## Out of Scope (for this project)
- Clickjacking/UI issues requiring cross-origin framing.
- Issues requiring privileged local device access or browser extensions.
- Social engineering or non-project infrastructure.
- Self-XSS (issues requiring a victim to paste code in the console).
- Rate-limit or brute-force findings without demonstrated impact.

## CVE & Public Advisory
We coordinate fixes and disclosure via **GitHub Security Advisories**. When applicable, a **CVE ID** may be requested through GitHub. A public advisory may be published **after** a fix is available.

## Researcher Credit
With your consent, we'll credit valid reporters in release notes/advisories. Anonymous credit is fine - just let us know.

## Safe Harbor
We will not pursue claims against researchers who:
- Act in **good faith** and follow this policy,
- Avoid privacy violations and service degradation, and 
- Give us a reasonable chance to remediate before public disclosure.