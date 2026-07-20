# Security Policy

## Before you report

Please read the [threat model](README.md#security-and-threat-model) first.

BananaBook ships with **no authentication by design**. It is built for a single
self-hosted household instance on a trusted local network. The following are known and
intentional, and are not treated as vulnerabilities:

- Any endpoint being reachable without credentials.
- One household member being able to see or edit another's data.
- The SQLite database being readable by anyone with access to the host filesystem.

If an instance is exposed to the public internet, everything above is reachable by
anyone. That is a deployment mistake rather than a bug — please don't do it.

## What is in scope

Anything that breaks the model above on a *correctly deployed* instance, such as:

- Remote code execution, path traversal, or SQL injection.
- A way for a page on another origin to read or modify data from a LAN instance
  (for example, CSRF or a cross-origin leak).
- Dependency vulnerabilities that are actually exploitable in this application.

## Reporting

Report privately through GitHub's
[private vulnerability reporting](https://github.com/majoragee/bananabook/security/advisories/new)
— the **Security** tab of this repository. Please do not open a public issue for a
security problem.

Include what you did, what happened, and what you expected. A proof of concept helps.

This is a personal project maintained in spare time, so there is no guaranteed response
window, but reports will be read and acknowledged.

## Supported versions

Only the latest commit on `main` is supported. There are no backported fixes.
