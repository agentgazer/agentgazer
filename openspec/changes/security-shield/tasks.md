# Tasks: Security Shield

## 1. Database Schema

- [x] 1.1 Add security_config table migration in packages/server/src/db.ts
- [x] 1.2 Add security_events table migration in packages/server/src/db.ts
- [x] 1.3 Create getSecurityConfig() function
- [x] 1.4 Create upsertSecurityConfig() function
- [x] 1.5 Create insertSecurityEvent() function
- [x] 1.6 Create getSecurityEvents() with pagination and filters

## 2. Security Patterns Module

- [x] 2.1 Create packages/shared/src/security-patterns.ts
- [x] 2.2 Add PROMPT_INJECTION_PATTERNS constant
- [x] 2.3 Add SENSITIVE_DATA_PATTERNS constant
- [x] 2.4 Add TOOL_CATEGORIES constant
- [x] 2.5 Export pattern matching helper functions
- [x] 2.6 Add tests for pattern matching

## 3. Server Routes

- [x] 3.1 Create packages/server/src/routes/security.ts
- [x] 3.2 Implement GET /api/security/config endpoint
- [x] 3.3 Implement PUT /api/security/config endpoint
- [x] 3.4 Implement GET /api/security/events endpoint
- [x] 3.5 Implement GET /api/security/events/:id endpoint
- [x] 3.6 Register security routes in server.ts
- [x] 3.7 Add tests for security routes

## 4. Proxy Security Module

- [x] 4.1 Create packages/proxy/src/security-filter.ts
- [x] 4.2 Implement SecurityFilter class with config loading
- [x] 4.3 Implement checkPromptInjection() method
- [x] 4.4 Implement maskSensitiveData() method
- [x] 4.5 Implement checkToolRestrictions() method
- [x] 4.6 Add security config cache with TTL
- [x] 4.7 Add cache clear endpoint /internal/security/clear-cache

## 5. Proxy Integration

- [x] 5.1 Import SecurityFilter in proxy-server.ts
- [x] 5.2 Add security check before forwarding request (data masking + tool restrictions)
- [x] 5.3 Add security check after receiving response (prompt injection + data masking)
- [x] 5.4 Record security events via POST /api/security/events
- [x] 5.5 Handle block action (return error response)
- [x] 5.6 Add tests for proxy security integration

## 6. Dashboard Security Page

- [x] 6.1 Create apps/dashboard-local/src/pages/SecurityPage.tsx
- [x] 6.2 Add agent selector dropdown (ALL + agent list)
- [x] 6.3 Implement Prompt Injection Detection section with toggles
- [x] 6.4 Implement Sensitive Data Masking section with toggles
- [x] 6.5 Implement Tool Call Restrictions section with toggles
- [x] 6.6 Implement custom pattern add/edit/delete for each section
- [x] 6.7 Implement parent toggle logic (all on/off/partial)
- [x] 6.8 Add Security Events table with filters

## 7. Dashboard Integration

- [x] 7.1 Add Security link to sidebar in Layout.tsx
- [x] 7.2 Add security API functions to lib/api.ts
- [x] 7.3 Add SecurityPage route to App.tsx
- [x] 7.4 Add security event type to Events page filters

## 8. Alert Integration

- [x] 8.1 Fire alert on critical security events (prompt injection blocked)
- [x] 8.2 Add security_event alert rule type
- [x] 8.3 Update alert evaluator to handle security events
