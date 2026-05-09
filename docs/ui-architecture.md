# UI Architecture

## Routes
- `/login`: Sign in and self-serve registration.
- `/`: Dashboard summary cards.
- `/projects`: Project list + create form.
- `/tasks`: Task list, create task, and status transitions.

## State Management
- `AuthContext` stores token/user, persists to `localStorage`, and applies auth header on API client.
- Route-level local state handles entity lists and form state for MVP simplicity.

## Component Organization
- `src/components`: shared shell/layout and route protection.
- `src/pages`: route-specific screens.
- `src/api`: Axios client and auth header wiring.
- `src/context`: global auth boundary.
- `src/types.ts`: shared DTO/shape typing for API payload consumption.

## Future Evolution
- Introduce React Query for cache and mutation orchestration.
- Add feature folders (`features/projects`, `features/tasks`) when domain grows.
- Add design system primitives for reusable visual consistency.
