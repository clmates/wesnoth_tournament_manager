Testing scripts
---------------

This folder contains helper scripts to run automated API tests against the local backend.

Key scripts
- `run_api_tests.js` - existing general API test runner
- `recalculate_and_verify.js` - runs admin recalculation and integrity checker
- `run_tournament_api_test.js` - (new) simulate N elimination tournaments. Configurable variables at top via environment variables:
  - `NUM_TOURNAMENTS` (default 10)
  - `MIN_PLAYERS` (default 4)
  - `MAX_PLAYERS` (default 16)
  - `DISPUTE_PROB` (default 0.05)
  - `APPROVAL_PROB` (default 0.95)

- `summarize_tournament_logs.js` - (new) parse logs created by the tournament runner and produce a CSV summary in `testing/results/`.

How to run

1) Start backend locally (default expected at `http://localhost:3000`).

2) Ensure `testing/scripts/test_credentials.csv` contains test users including an `admin` user with known password.

3) Run the tournament runner (example):

```powershell
cd testing/scripts
node run_tournament_api_test.js
```

Or with custom variables:

```powershell
$env:NUM_TOURNAMENTS=5; $env:MIN_PLAYERS=6; $env:MAX_PLAYERS=12; node run_tournament_api_test.js
```

4) Summarize generated logs:

```powershell
node summarize_tournament_logs.js
```

Notes
- Scripts only use API calls; they expect the backend routes documented in the project to be available.
- I will not run the scripts unless you ask me to. Use the environment variables above to tune behavior.
