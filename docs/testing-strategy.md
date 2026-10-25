# Ajda Real Estate Platform — Testing Strategy

> **Last Updated**: 2026-10-01
> **Framework**: Vitest (server), Manual E2E (frontend)

---

## Current State

### Server Tests (`server/test/`)

**21 test files** covering critical paths:

| Category | Files | Coverage |
|----------|-------|----------|
| Authentication | `authz.test.ts`, `email-otp.test.ts`, `sessions.test.ts` | Login, OTP, sessions |
| Security | `security.test.ts`, `escalation.test.ts`, `security-settings.test.ts` | Permissions, escalation |
| Core CRUD | `floors.test.ts`, `publish.test.ts`, `duplicate-project.test.ts` | Projects, floors, units |
| Features | `newsletter.test.ts`, `notification-listeners.test.ts`, `preferences.test.ts` | Newsletter, notifications |
| Infrastructure | `media.test.ts`, `realtime.test.ts`, `exports.test.ts` | Uploads, WebSocket, CSV |

### Test Infrastructure

```
server/test/
├── global-setup.ts          # Test database setup
├── setup-env.ts             # Environment variables
├── helpers.ts               # Test utilities
├── harness.test.ts          # Test runner validation
└── [feature].test.ts        # Feature-specific tests
```

---

## Testing Pyramid

```
        ╱  E2E Tests  ╲         ← Manual (planned: Playwright)
       ╱   Integration  ╲      ← Vitest (current)
      ╱     Unit Tests    ╲    ← Vitest (current)
     ╱──────────────────────╲
```

### Unit Tests (Current)
- Service layer functions
- Utility functions
- Schema validation

### Integration Tests (Current)
- API endpoint testing
- Database operations
- Authentication flows
- Permission checks

### E2E Tests (Planned)
- Critical user journeys
- Cross-browser testing
- Visual regression

---

## Coverage Goals

| Area | Current | Target | Gap |
|------|---------|--------|-----|
| Authentication | ✅ Good | 90%+ | — |
| Authorization | ✅ Good | 90%+ | — |
| Projects/Units | ✅ Good | 85%+ | — |
| Inquiries | ⚠️ Basic | 80%+ | More edge cases |
| Media | ✅ Good | 80%+ | — |
| Settings | ⚠️ Basic | 75%+ | Expand |
| CMS (Phase 9) | ❌ None | 85%+ | To be written |
| Frontend | ❌ None | 70%+ | To be written |

---

## Test Types

### 1. Authentication Tests

```typescript
// Example: email-otp.test.ts
describe('Email OTP', () => {
  it('sends OTP on login when enabled', async () => {
    // Test implementation
  });

  it('rejects invalid OTP code', async () => {
    // Test implementation
  });

  it('locks after 5 failed attempts', async () => {
    // Test implementation
  });
});
```

**Critical paths:**
- Login with/without OTP
- Password reset flow
- Session management
- Token expiration

---

### 2. Authorization Tests

```typescript
// Example: authz.test.ts
describe('Permissions', () => {
  it('super_admin can access all routes', async () => {
    // Test implementation
  });

  it('viewer cannot create projects', async () => {
    // Test implementation
  });

  it('user permissions override role permissions', async () => {
    // Test implementation
  });
});
```

**Critical paths:**
- Role-based access
- Permission inheritance
- Per-user overrides
- Super admin bypass

---

### 3. CRUD Tests

```typescript
// Example: floors.test.ts
describe('Floor Management', () => {
  it('creates floor with units', async () => {
    // Test implementation
  });

  it('updates floor name on all units', async () => {
    // Test implementation
  });

  it('deletes floor and cascades to units', async () => {
    // Test implementation
  });
});
```

---

### 4. Security Tests

```typescript
// Example: security.test.ts
describe('Security', () => {
  it('rejects invalid file types', async () => {
    // Test implementation
  });

  it('sanitizes HTML in inputs', async () => {
    // Test implementation
  });

  it('enforces rate limits', async () => {
    // Test implementation
  });
});
```

---

## Frontend Testing (Planned)

### Current Gap
No automated frontend tests exist.

### Recommended Approach

#### 1. Component Tests (Vitest + React Testing Library)

```typescript
// Example: DataTable.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable } from './DataTable';

describe('DataTable', () => {
  it('renders columns correctly', () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('sorts on column header click', () => {
    // Test implementation
  });

  it('selects rows with checkboxes', () => {
    // Test implementation
  });
});
```

**Priority components:**
- `DataTable` — Complex, critical
- `ConfirmDialog` — User safety
- `ViewSwitcher` — User preference
- Form inputs — Validation

---

#### 2. E2E Tests (Playwright)

```typescript
// Example: admin-flow.spec.ts
import { test, expect } from '@playwright/test';

test('admin can create project', async ({ page }) => {
  await page.goto('/admin/login');
  await page.fill('[name=email]', 'admin@ajda.sa');
  await page.fill('[name=password]', 'password');
  await page.click('button[type=submit]');

  await page.click('text=New Project');
  await page.fill('[name=titleAr]', 'مشروع تجريبي');
  await page.fill('[name=titleEn]', 'Test Project');
  await page.click('text=Save');

  await expect(page.locator('text=Project created')).toBeVisible();
});
```

**Critical journeys:**
1. Admin login → Create project → Add floors/units → Publish
2. Public user → Browse projects → Submit inquiry
3. Admin → View inquiry → Update status
4. Admin → Upload media → Verify processing

---

## Continuous Integration

### Recommended Pipeline

```yaml
# .github/workflows/test.yml (example)
name: Tests

on: [push, pull_request]

jobs:
  server-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd server && npm ci
      - run: cd server && npm test

  frontend-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - run: npm run lint

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test  # When implemented
```

---

## Test Data Management

### Fixtures

```typescript
// server/test/fixtures/
export const testAdmin = {
  email: 'admin@test.com',
  password: 'TestPass123!',
  role: 'super_admin'
};

export const testProject = {
  titleAr: 'مشروع تجريبي',
  titleEn: 'Test Project',
  city: 'Riyadh',
  type: 'commercial'
};
```

### Database Seeding

```typescript
// global-setup.ts
export async function setup() {
  // Create test database
  // Run migrations
  // Seed test data
}

export async function teardown() {
  // Drop test database
}
```

---

## Manual Testing Checklist

### Pre-Release Checklist

- [ ] Login/logout flow
- [ ] OTP verification (if enabled)
- [ ] Create project with floors/units
- [ ] Upload images and PDFs
- [ ] Submit inquiry from public site
- [ ] Update inquiry status in admin
- [ ] Change unit status (verify realtime)
- [ ] Test on mobile viewport
- [ ] Test RTL/LTR switching
- [ ] Verify email notifications

---

## Future Improvements

| Priority | Item | Effort |
|----------|------|--------|
| High | Add frontend component tests | 2-3 days |
| High | E2E tests for critical flows | 3-5 days |
| Medium | Visual regression testing | 2 days |
| Medium | Load testing (k6) | 1-2 days |
| Low | Mutation testing | 2 days |
| Low | Property-based testing | 2 days |

---

*See [architecture.md](architecture.md) for system design.*
*See [TODO.md](TODO.md) for testing-related tasks.*
