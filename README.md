# tst-scodera

Repository initialized.

## Payment test cards

Use these application-defined test card numbers to select deterministic outcomes
in the payment creation flow:

| Card number | Expected outcome |
| --- | --- |
| `4242 4242 4242 4242` | Payment succeeds (`succeeded`). |
| `4000 0000 0000 9995` | Payment is declined for insufficient funds. |
| `4000 0025 0000 3155` | Payment requires 3-D Secure authentication (`requires_action`). |
| `4000 0000 0000 0119` | Simulated technical error; the API returns HTTP 503. |

These numbers define the intended local test behavior and do not represent real
payment credentials. This repository currently contains no payment creation API,
so the outcomes are documented here but are not yet wired to a running flow.
