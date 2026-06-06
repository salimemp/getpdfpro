name: Feature Request
description: Suggest a new feature or improvement
title: "[Feature]: "
labels: ["enhancement", "triage"]
assignees: []
body:
  - type: markdown
    attributes:
      content: |
        We love feature requests! Please describe what you'd like and
        why it would be useful. The clearer the use case, the more
        likely we'll prioritize it.

  - type: dropdown
    id: category
    attributes:
      label: Category
      options:
        - New PDF tool
        - AI feature
        - Voice / accessibility
        - Mobile / desktop app
        - Web app UI
        - Billing / account
        - Performance
        - Other
      validations:
        required: true

  - type: textarea
    id: problem
    attributes:
      label: What problem does this solve?
      description: What are you trying to do that you can't today?
      placeholder: |
        I need to send the same PDF to 50 clients with each one's
        name and address on page 1, but I have to manually edit each
        one. This takes hours.
    validations:
      required: true

  - type: textarea
    id: solution
    attributes:
      label: Proposed solution
      description: How would you like this to work?
      placeholder: |
        Add a "mail merge" feature where I upload a CSV with
        client data and a PDF template, and it generates 50
        personalized PDFs.
    validations:
      required: true

  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives considered
      description: Other ways to solve this you've thought of
    validations:
      required: false

  - type: textarea
    id: context
    attributes:
      label: Additional context
      description: Screenshots, mockups, links, etc.
    validations:
      required: false

  - type: dropdown
    id: willingness
    attributes:
      label: Willingness to contribute
      description: Would you help build this?
      options:
        - I'd build it myself (PR incoming)
        - I could help test
        - I can provide feedback / designs
        - Just the idea, no contribution
      validations:
        required: false

  - type: input
    id: tier
    attributes:
      label: Your account tier
      description: Free / Pro / Team — helps us prioritize
    validations:
      required: false
