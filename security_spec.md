# Iron Circle Security Specification

## Data Invariants
- A Day document must always belong to the correct user.
- XP levels are calculated based on total XP.
- Users can only sign in with verified emails (if enforced, but here we use simple auth first).

## The Dirty Dozen Payloads
1. Attempt to update another user's Day tasks.
2. Attempt to join a group you are not a member of (if restricted).
3. Attempt to set XP to 1,000,000 on create.
4. Attempt to delete another user's tasks.
5. Attempt to read group data without being signed in.
... (etc)

## Test Runner
(Tests would be implemented in firestore.rules.test.ts if environment allowed full testing suite)
