# Security Specification (`wissenapk1`)

## 1. Data Invariants
1. **Path ID Hardening**: All document IDs (`sessionId`, `questionId`) must match `^[a-zA-Z0-9_\-]+$` and be at most 128 characters.
2. **Schema & Volumetric Bounds**:
   - `StudentSession` documents in `/sessions/{sessionId}` must contain required keys (`id`, `fullName`, `password`, `status`, `currentModule`, `currentQuestionIndex`, `viewMode`, `startedAt`, `updatedAt`, `answers`, `flagged`, `eliminated`, `highlights`, `moduleTimeRemaining`, `completedModules`, `score`) and strictly validate string lengths (`fullName <= 120`, `password <= 64`, `status in ['in_progress', 'break', 'completed']`).
   - `SATQuestion` documents in `/questions/{questionId}` must validate `moduleId in ['rw_1', 'rw_2', 'math_1', 'math_2']`, `type in ['mcq', 'spr']`, `prompt <= 4000`, and `correctAnswer <= 64`.
3. **Default Deny Catch-All**: All unmatched paths are strictly denied (`allow read, write: if false;`).

## 2. Dirty Dozen Payloads
1. Poisoned ID > 128 chars or containing spaces/slashes.
2. Shadow field injection (`isAdmin: true`) on `/sessions/{sessionId}`.
3. Oversized `fullName` (> 120 chars) on `/sessions/{sessionId}`.
4. Invalid `status` enum (`status: "hacked"`) on `/sessions/{sessionId}`.
5. Invalid `currentModule` enum (`currentModule: "math_99"`).
6. Negative `currentQuestionIndex` (`-1`).
7. Unbounded `highlights` array (> 100 items).
8. Unbounded `completedModules` array (> 4 items).
9. Oversized `prompt` (> 4000 chars) on `/questions/{questionId}`.
10. Invalid `type` (`type: "essay"`) on `/questions/{questionId}`.
11. Missing `correctAnswer` on `/questions/{questionId}`.
12. Write to unknown collection `/system_secrets/root`.
