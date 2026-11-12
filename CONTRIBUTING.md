# Contributing

## Work by ticket

Create one branch for each ticket, using `feature/<short-title>` (for example, `feature/pay-0-workflow-logging`). Start every commit subject with the ticket ID, such as `PAY-0: add repository workflow docs`.

Open a pull request for each ticket. Link the GitHub issue or project ticket in the PR, summarize the change, and describe how it was tested. Use the [pull request template](.github/pull_request_template.md).

## Definition of Done

A ticket is Done only after its pull request is merged and all of the following are true:

- Tests pass and the required CI checks are green.
- The README and OpenAPI documentation are updated when the change affects them; otherwise, mark them not applicable in the PR.
- `CHANGELOG.md` and `docs/agent-log.md` are updated for the ticket.
- Bugs and follow-up work found during implementation or review are opened as GitHub issues and linked from the PR. If none are found, say so in the PR.
- The pull request has been reviewed before merge.

## `main` branch policy

Repository settings for `main` must require changes to arrive through a pull request and require the repository's CI checks to pass before merge. Configure required check names from the checks actually provided by this repository; do not select checks that do not exist. Maintainers should keep this policy aligned with the active CI workflows.
