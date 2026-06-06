name: Bug Report
description: Report a bug or unexpected behavior
title: "[Bug]: "
labels: ["bug", "triage"]
assignees: []
body:
  - type: markdown
    attributes:
      content: |
        Thanks for taking the time to report a bug! Please fill out the
        template below so we can reproduce and fix it quickly.

  - type: dropdown
    id: platform
    attributes:
      label: Platform
      description: Where did you see this bug?
      options:
        - Web (getpdfpro.com)
        - Web (app.getpdfpro.com)
        - iOS app
        - Android app
        - macOS app
        - Windows app
        - Linux app
        - All platforms
        - Other
      validations:
        required: true

  - type: dropdown
    id: tool
    attributes:
      label: Which tool?
      description: Which PDF tool had the issue?
      options:
        - Merge PDF
        - Split PDF
        - Compress PDF
        - PDF to Word
        - PDF to JPG
        - JPG to PDF
        - Sign PDF
        - OCR PDF
        - Watermark
        - Page numbers
        - Rotate PDF
        - Protect / Unlock
        - Redact
        - AI Assistant / Chat
        - Voice command
        - Read aloud
        - Account / billing
        - Other
      validations:
        required: true

  - type: input
    id: account-tier
    attributes:
      label: Account tier
      description: Are you on Free, Pro, or Team?
      placeholder: "Free / Pro / Team"
    validations:
      required: false

  - type: textarea
    id: description
    attributes:
      label: What happened?
      description: Clear, concise description of the bug
      placeholder: |
        I was trying to merge 3 PDFs but the result was corrupted.
        The page count showed 12 pages (correct) but the last 3 pages
        were blank.
    validations:
      required: true

  - type: textarea
    id: expected
    attributes:
      label: What did you expect to happen?
      description: What you expected to see
    validations:
      required: true

  - type: textarea
    id: reproduce
    attributes:
      label: Steps to reproduce
      description: How can we reproduce this?
      placeholder: |
        1. Go to getpdfpro.com/tools/merge
        2. Upload file A (12 pages), file B (5 pages), file C (8 pages)
        3. Click "Merge"
        4. Download the result
        5. See blank pages
    validations:
      required: true

  - type: input
    id: url
    attributes:
      label: URL where the bug occurred
      placeholder: "https://getpdfpro.com/tools/merge"
    validations:
      required: false

  - type: input
    id: browser
    attributes:
      label: Browser / OS
      description: e.g. Chrome 124 on Windows 11, Safari 17.5 on macOS 14
    validations:
      required: false

  - type: textarea
    id: console
    attributes:
      label: Browser console errors
      description: If you opened DevTools, any errors?
      placeholder: |
        Uncaught (in promise) TypeError: Cannot read properties of undefined
    validations:
      required: false

  - type: textarea
    id: screenshots
    attributes:
      label: Screenshots / screen recording
      description: Drag images here or paste links
    validations:
      required: false

  - type: dropdown
    id: severity
    attributes:
      label: Severity
      description: How much does this affect your work?
      options:
        - Critical (can't use the app at all)
        - High (main feature broken)
        - Medium (workaround exists)
        - Low (cosmetic / minor)
      validations:
        required: true

  - type: checkboxes
    id: checks
    attributes:
      label: Before submitting
      options:
        - label: I've searched existing issues and didn't find this
          required: true
        - label: I'm using the latest version
          required: true
        - label: I've cleared my browser cache / restarted the app
          required: false
        - label: I understand this is not a security issue (use the Security Disclosure template for those)
          required: true
