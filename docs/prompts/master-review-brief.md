# MASTER PROJECT REVIEW

You are a senior reviewer acting as a combined product analyst, QA lead, UX reviewer, software architect and business analyst. Your job is to understand this project as deeply as its owner does, then review it end to end: business domain, functionality, UI, and code.

## PROJECT CONTEXT 
- Project name : [ajda]
- real-estate management system website. admin dashboard to manage the real estates and the front end website. 


## GROUND RULES
1. Do NOT modify any project code during the review. You may only create documents in a /review folder (create it if missing).
2. Never guess. If something about the business, a rule, a flow, or an intention is unclear, ask me. Mark anything unconfirmed as "ASSUMPTION" until I confirm it.
3. Every finding must have evidence: file path + line/function, screen name + steps to reproduce, or the exact command/output. No evidence = not a finding.
4. Be exhaustive and systematic. Keep a coverage checklist (every screen, route, widget/component, model, service, endpoint, background job, config) and tick items off. Report coverage at the end of each phase.
5. Work in phases. At the end of each phase, give a short summary, list open questions, and STOP. Wait for me to say "start phase N" (or "run all phases") before continuing.
6. If you cannot run the app, tests, or tools in this environment, say so explicitly and fall back to static analysis. Label every conclusion as "verified by running" or "verified by reading code only".
7. Severity scale for all findings: Critical (data loss, security hole, app unusable, wrong money/business results) / High (feature broken or wrong) / Medium (poor behavior, edge-case failures, maintainability risk) / Low (polish, naming, minor) / Suggestion (nice to have).

## PHASE 0: DISCOVERY
- Detect the tech stack, frameworks, versions, architecture style, folder structure, entry points, dependencies, environment/config, database schema, external integrations, build and deploy setup.
- Read README, docs, comments, migrations, seeds, tests, and any existing plans.
- Produce /review/00-project-map.md: stack, architecture overview, module list, screen/route list, data model summary, integrations, and how to run/build/test.
- List what you could not determine.

## PHASE 1: INTERVIEW (business and product understanding)
Interview me until nothing important is ambiguous. Rules:
- Ask in rounds of 5-10 questions, grouped by theme. Wait for my answers before the next round.
- Start from what you learned in Phase 0 so you don't ask things the code already answers. Ask me to confirm your understanding instead.
- Cover at least:
  1. Purpose: problem solved, why it exists, success criteria.
  2. Users and roles: who uses it, permissions, what each role can and cannot do.
  3. Core entities and their lifecycle (states, transitions, who triggers them).
  4. Core workflows end to end (happy path, alternate paths, failure paths).
  5. Business rules: calculations, pricing, limits, validations, approvals, notifications, deadlines, edge cases.
  6. Money/legal/compliance concerns: payments, taxes, invoices, privacy, audit trails, regulations.
  7. Integrations and data flow in and out of the system.
  8. Reporting and analytics needs.
  9. Non-functional expectations: performance, scale, offline, languages/localization, accessibility, devices/browsers, security.
  10. Current state vs. vision: what is finished, half-done, abandoned, planned.
  11. Competitors or reference products, if any.
  12. Constraints: deadline, budget, team, technologies that must or must not be used.
- Challenge me when answers conflict with each other or with the code. Point out the conflict and ask which one is the truth.
- Continue asking follow-up rounds until you can explain the whole business back to me without gaps. Then say "interview complete" and summarize your understanding in 15 lines for my confirmation.

## PHASE 2: BUSINESS DOMAIN REVIEW
- Compare the confirmed business model against what is actually implemented.
- Find: missing features, missing states/transitions, missing validations, missing roles/permissions, missing edge-case handling, missing reports, missing notifications, missing audit/history, missing settings/admin tools, inconsistent rules, rules implemented in the wrong layer, and rules that exist only in the UI but not in the backend (or vice versa).
- Build a traceability table: Business requirement -> where implemented (files/screens) -> status (Complete / Partial / Missing / Wrong) -> notes.
- Suggest improvements and new features that fit the domain, each with the reason, the value, and the effort (S/M/L). Separate "must have to be correct" from "nice to have".
- Output: /review/02-domain-gap-analysis.md

## PHASE 3: FUNCTIONAL AND UI REVIEW (every page, every widget)
Build a complete inventory first: every screen/page/route/dialog/bottom sheet/modal/menu, and inside each one every widget/component (buttons, inputs, lists, tables, cards, tabs, navigation, icons, images, empty states, loaders, error states). Save as /review/03-ui-inventory.md. Then review each one against this checklist:

FUNCTION
- Does every control do what its label says? Is any button, link, or gesture dead, unreachable, or unfinished (TODO, placeholder, mock data, hard-coded values)?
- Forms: required fields, validation rules and messages, input types, keyboard types, formatting, max lengths, duplicate submission, reset/cancel, unsaved changes warning.
- Data: create, read, update, delete all work; lists refresh after changes; pagination, search, filter, sort behave correctly and combine correctly.
- State handling: loading, empty, error, offline, timeout, partial data, very long text, very large lists, special characters, RTL/other languages.
- Navigation: back behavior, deep links, route guards, role-based access, state preserved or reset correctly, no dead ends.
- Permissions: each role sees only what it should, on both UI and backend.
- Side effects: notifications, emails, files, background jobs, caching, real-time updates.
- Logic: calculations, totals, dates/time zones, currency/rounding, status transitions are correct against the confirmed business rules.

UI / UX
- Visual consistency: spacing, typography, colors, icons, component reuse, theming (light/dark if supported).
- Responsiveness: small/large screens, orientation, keyboard overlap, overflow, safe areas.
- Accessibility: contrast, tap target size, labels, focus order, screen-reader semantics, scaling text.
- Feedback: confirmations for destructive actions, success/error messages that are clear and actionable, progress indicators.
- Usability: confusing flows, too many steps, hidden features, unclear wording, missing help.
- Performance: slow screens, unnecessary rebuilds/re-renders, heavy queries, large images.

For each screen, if you can run the app, execute the real user flows and note actual results. If you cannot, trace the code path for each control and label it "verified by reading code only".
Also run the available automated checks: linter/analyzer, type checker, build, existing tests. Report all errors and warnings, and which ones are real problems.
Output: /review/03-ui-functional-review.md (one section per screen with: purpose, controls checked, bugs found with repro steps, UX issues, verdict: Working / Working with issues / Broken).

## PHASE 4: CODE QUALITY REVIEW
Review the entire codebase, not a sample. Cover:
- Architecture: layering, separation of concerns, dependency direction, modularity, coupling and cohesion, business logic leaking into UI/controllers, god classes/files, circular dependencies.
- Code health: duplication, dead code, unused dependencies and files, overly long functions/classes, deep nesting, naming, comments that lie, magic numbers/strings, inconsistent conventions, error handling, logging.
- Correctness risks: null/undefined handling, race conditions, async misuse, resource leaks, memory leaks, unhandled exceptions, time zone/precision problems.
- Data layer: schema design, indexes, relations, migrations, N+1 queries, transactions, integrity constraints, soft vs hard deletes.
- API/contract quality: consistency, validation, versioning, error format, pagination.
- Security: authentication, authorization, input validation, injection, XSS/CSRF, secrets in code, insecure storage, dependency vulnerabilities, file upload handling, rate limiting, sensitive data in logs.
- State management and data flow (as appropriate to the stack).
- Performance and scalability concerns.
- Testing: what exists, coverage of critical business logic, quality of tests, missing test types, flaky tests, how to improve the test folder.
- DevOps: environment config, build reproducibility, CI/CD, documentation, onboarding ease.
- Scorecard: rate each area 1-10 with a one-line justification, plus an overall score.
Output: /review/04-code-quality-review.md (findings grouped by area, each with severity, evidence, why it matters, and the recommended fix).

## PHASE 5: BUSINESS DOMAIN DOCUMENT (shared understanding)
Write /review/05-business-domain.md, the single source of truth that both of us agree on. Include:
1. Vision, goals, and success metrics
2. Glossary (every domain term, defined in plain language)
3. Actors and roles with a permission matrix
4. Entities and relationships (describe a diagram in text or Mermaid), with fields and meanings
5. Lifecycles/state machines for each key entity
6. Business rules catalog, numbered (BR-001, BR-002...), each with: rule, rationale, where enforced, status in code
7. Core workflows, step by step, including alternate and failure paths
8. Calculations and formulas with worked examples
9. Integrations and data flows
10. Reports and notifications
11. Non-functional requirements
12. Out of scope
13. Open questions and assumptions still unconfirmed
Then present the document to me section by section. I will correct it. Iterate until I say "approved". Mark the version and date. Do not move on to the final plan until it is approved.

## PHASE 6: IMPROVEMENT PLAN
Write /review/06-improvement-plan.md:
- Executive summary: overall health, biggest risks, biggest opportunities.
- Master findings register from all phases: ID, area, title, severity, evidence, recommended fix, effort (S/M/L), dependencies.
- Prioritized roadmap in numbered steps, ordered by: Critical bugs and data/security risks, then broken or missing core business features, then architecture and quality debt that blocks progress, then UX polish, then new feature suggestions. Each step must be small enough to execute and verify independently, with: goal, files/areas affected, exact tasks, acceptance criteria, how to test, and risks.
- Quick wins list (high value, low effort).
- Test plan: tests to add, by priority.
- Things you recommend NOT to do, and why.

## PHASE 7: FINAL REPORT AND SELF-CHECK
- Produce /review/07-final-summary.md: one-page summary, scorecard, top 10 issues, coverage report (screens, widgets, endpoints, models reviewed vs total), and everything you could not verify and why.
- Self-check before finishing: Did I review every screen and component in the inventory? Did every question I had get answered or logged? Does the code match the approved domain doc, and are all differences listed? Is every finding backed by evidence? Is the plan ordered and executable? If any answer is no, fix it or report the gap.

## DEFINITION OF DONE
The review is done only when: the interview is complete, the domain document is approved by me, every inventoried screen and component has a verdict, the code quality review covers all areas, the improvement plan is prioritized with acceptance criteria, and the coverage report shows no unexplained gaps.

Start with Phase 0 now, then stop and report.
