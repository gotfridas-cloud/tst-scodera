# Changelog

All notable changes to this repository are documented here.

This changelog follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html) when it has versioned releases.

## [Unreleased]

### Added

- PAY-7: Added capture and void operations for authorized payments, including atomic in-memory state transitions and amount validation.
- PAY-6: Added an in-memory 3-D Secure payment challenge flow with a ten-minute timeout.
- PAY-4: Added payment status transition validation with machine-readable 409 errors for invalid transitions.
- PAY-3: Added `GET /payments/:id` to retrieve stored payments with only the card's last four digits.
- PAY-2: Added `POST /payments` with positive integer amount and currency validation, in-memory payment storage, and idempotency handling.
- PAY-1: Added the Node.js 20 Express scaffold, health endpoint, Jest/Supertest coverage, ESLint configuration, and pull request CI.
- PAY-0: Added contribution workflow guidance, a pull request template, and per-ticket agent run logging.
