name: Security Disclosure
description: Report a security vulnerability (private, not public)
title: "[Security]: "
labels: ["security", "private"]
assignees: ["salimemp"]
body:
  - type: markdown
    attributes:
      content: |
        **⚠️ This is for security vulnerabilities only.**
        For general bugs, use the Bug Report template. For non-security
        feedback, use Discussions.

        **Please do NOT disclose the vulnerability publicly** until we've
        had a chance to investigate and patch. See SECURITY.md for our
        full disclosure policy.

  - type: dropdown
    id: severity
    attributes:
      label: Severity (your estimate)
      description: Your best guess — we'll confirm
      options:
        - Critical (RCE, auth bypass, mass data exposure)
        - High (data exposure, privilege escalation, XSS with impact)
        - Medium (CSRF, info disclosure, session issues)
        - Low (header missing, informational)
        - Unknown
      validations:
        required: true

  - type: textarea
    id: summary
    attributes:
      label: Vulnerability summary
      description: One-paragraph description of the issue
    validations:
      required: true

  - type: textarea
    id: impact
    attributes:
      label: Impact
      description: What can an attacker do? What data is at risk?
    validations:
      required: true

  - type: textarea
    id: reproduction
    attributes:
      label: Steps to reproduce
      description: How to verify the vulnerability
      placeholder: |
        1. Sign up at getpdfpro.com
        2. Note the request to /api/v1/files/upload-url in DevTools
        3. Modify the file_id parameter to a different user's UUID
        4. Observe 200 OK with valid upload URL (should be 403)
    validations:
      required: true

  - type: textarea
    id: affected
    attributes:
      label: Affected components
      description: Which parts of the system? URLs, endpoints, files
    validations:
      required: true

  - type: input
    id: discovered-by
    attributes:
      label: Your name / handle (for credit)
      description: How should we credit you in the fix release notes? Leave blank to stay anonymous.
    validations:
      required: false

  - type: checkbox
    id: disclosure
    attributes:
      label: Disclosure agreement
      description: |
        I agree to:
        - Not publicly disclose the vulnerability until GetPDFPro has
          confirmed a fix is in production (or 90 days have passed,
          whichever is sooner)
        - Not exploit the vulnerability beyond what's necessary to
          demonstrate it
        - Not access, modify, retain, or transfer user data
          belonging to anyone other than myself
      options:
        - label: I agree to responsible disclosure terms
          required: true

  - type: markdown
    attributes:
      content: |
        ---

        **What happens next:**
        1. We confirm receipt within 24 hours
        2. We investigate and triage within 3 business days
        3. We keep you updated on our progress
        4. We credit you in the fix release (unless you prefer anonymity)
        5. We may invite you to our bug bounty program (in development)

        **For urgent issues** (active exploitation, mass data breach):
        Email **security@getpdfpro.com** directly with the same info.
