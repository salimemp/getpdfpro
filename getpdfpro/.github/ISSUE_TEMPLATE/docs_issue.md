name: Documentation Issue
description: Report a problem with our docs (typo, broken link, missing info, unclear)
title: "[Docs]: "
labels: ["documentation", "triage"]
body:
  - type: input
    id: url
    attributes:
      label: Page URL
      description: Where is the issue?
      placeholder: "https://getpdfpro.com/docs/how-to-merge-pdfs"
    validations:
      required: true

  - type: dropdown
    id: type
    attributes:
      label: Type of issue
      options:
        - Typo / grammar
        - Broken link
        - Missing information
        - Unclear / confusing
        - Outdated
        - Wrong information
        - Translation issue (specific language)
      validations:
        required: true

  - type: dropdown
    id: language
    attributes:
      label: Language
      options:
        - English
        - Spanish
        - French
        - German
        - Italian
        - Portuguese
        - Arabic
        - Hindi
        - Japanese
        - Other / not sure
      validations:
        required: true

  - type: textarea
    id: description
    attributes:
      label: Describe the issue
    validations:
      required: true

  - type: textarea
    id: suggestion
    attributes:
      label: Suggested fix
      description: Optional — what should it say instead?
    validations:
      required: false
