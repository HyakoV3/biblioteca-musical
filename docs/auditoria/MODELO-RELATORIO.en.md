[Português](MODELO-RELATORIO.md) · **English** · [Español](MODELO-RELATORIO.es.md)

# Individual audit report template

> Copy this template to `RELATORIO-<id>-<slug>.md`. It is only a template; replace the fields with the real evidence.

## Identification

- **Persona / auditor:**
- **Project:** Biblioteca Musical CCB
- **Version/commit audited:**
- **Date:**
- **Platforms:**
- **Artifacts analyzed:**
- **Environment and prerequisites:**

## Scope and method

- **In scope:**
- **Out of scope:**
- **Method:** static review / automated tests / manual inspection / on-device test
- **Data used:** fictional or authorized; no unlicensed third-party content

## Executive summary

- **Verdict:** Accept / Accept with conditions / Reject / Inconclusive
- **P0 findings:** 0 | **P1:** 0 | **P2:** 0 | **P3:** 0
- **Unverified risks:** 0
- **Release blockers, if any:**

## Findings

### [P?] Title

- **ID:** AREA-001
- **Status:** Confirmado | Provável | Risco a verificar | Não reproduzido (confirmed | probable | risk to verify | not reproduced)
- **Confidence:** High | Medium | Low
- **Evidence:** file:line / run / capture / log
- **Preconditions:**
- **Steps:** 1. ... 2. ... 3. ...
- **Expected:**
- **Observed:**
- **Impact:**
- **Recommendation:**
- **Suggested regression:**
- **Suggested owner:**

## Tests and checks

| ID | Procedure | Environment | Result | Evidence |
|---|---|---|---|---|
| T-01 | | | Passed / Failed / Not run | |

## Tests not run and limitations

- Describe missing prerequisites, such as an APK, a device, Chrome or dependencies.
- **Never state that a scenario passed if it was not run.**

## Risks to verify

- Risk — reason for the uncertainty — verification needed — responsible persona.

## Regression plan

1. Scenario that must pass after the fix.
2. Recommended automated test.
3. Test on a real Android device, when needed.

## Referrals and decision

- **Other personas to involve:**
- **Owner's pending items:**
- **Acceptance recommendation:**
