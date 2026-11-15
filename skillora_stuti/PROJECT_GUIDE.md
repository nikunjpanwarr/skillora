# PROJECT_GUIDE.md --- Skillora

> Persistent project instructions for any AI coding assistant working on
> Skillora. Read this file and inspect the repository before making
> changes.

## 1. Project identity

**Product:** Skillora\
**Purpose:** A student-to-student service marketplace for Bennett
University students. Students can discover services offered by other
students and, eventually, publish services of their own.

**Product model:** - **Consumer:** A student who discovers and purchases
a service. - **Producer:** A student who offers and manages a service. -
**Admin:** An authorized operator who moderates and manages the
marketplace.

**Product positioning:** "Your Campus. Your Skills. Your Opportunities."

The current site copy says Skillora is intended for verified Bennett
University students and references university Microsoft sign-in. Treat
this as a product requirement, not proof that authentication is already
configured.

## 2. Existing repository --- verified from the supplied ZIP

The supplied archive is a flat static website. Its current files are:

``` text
skillora/
├── index.html
├── explore.html
├── become-producer.html
├── about.html
├── styles.css
├── script.js
├── explore.js
├── data.js
├── auth.js
├── README.md
└── images/
    └── hero-students.png
```

The archive does **not** currently contain: - `package.json` - a
Node.js/Express backend - database schema or migrations - a configured
database connection - `login.html` - consumer, producer, or admin
dashboard pages - service detail page - automated tests - production
deployment configuration

Some existing pages link to `login.html`, but that file is absent from
the supplied archive. Verify links before changing them.

### Existing code observations

-   `README.md` describes the project as a flat static site and says to
    open `index.html` with Live Server.
-   `data.js` defines eight service categories and a `SERVICES` array
    containing a sample/example listing. The sample is not a real
    marketplace record.
-   `explore.js` renders services from the in-memory `SERVICES` array
    and supports text search and category filtering. It does not fetch
    services from an API.
-   `script.js` builds the homepage category ticker, adds a scroll
    style, toggles the visual state of heart buttons, and creates a
    mobile navigation drawer.
-   `auth.js` currently stores a user object in `localStorage`. Its
    configuration has an empty Microsoft client ID, and it falls back to
    a demo email form. This is demo behavior, not secure production
    authentication.
-   `styles.css` contains the existing visual system and should be
    treated as the source of truth for the current design.
-   `index.html`, `explore.html`, `become-producer.html`, and
    `about.html` are the existing HTML pages.

Do not assume any additional features work unless you inspect and test
their implementation.

## 3. Non-negotiable development principles

1.  **Preserve the existing Skillora design.** Do not redesign the site
    or replace its branding without explicit approval.
2.  **Inspect before editing.** Read the relevant HTML, CSS, JavaScript,
    and related files before changing them.
3.  **Build on the current project.** Do not migrate to React, Next.js,
    TypeScript, Tailwind, or another frontend framework unless
    explicitly approved.
4.  **Avoid unnecessary rewrites.** Keep working code and make focused
    changes.
5.  **Do not invent completed functionality.** Clearly distinguish
    implemented, partially implemented, demo-only, and unimplemented
    features.
6.  **No fake production data.** Sample data may be used only in clearly
    identified development/demo environments.
7.  **Security belongs on the server.** Never rely on frontend checks
    for authorization, role assignment, payment verification, or
    university email verification.
8.  **Protect secrets.** Never put database passwords, Microsoft client
    secrets, payment secrets, or private API keys in browser code or
    commit them to version control.
9.  **Validate all untrusted input on the backend.** Use parameterized
    SQL queries.
10. **Keep the site responsive and accessible.** Preserve mobile
    navigation and test common screen sizes.
11. **Do not silently skip work.** Report blockers, missing credentials,
    external configuration, and unfinished tasks.
12. **Do not claim a feature is working unless it has been tested.**

## 4. Proposed technology direction

The current frontend is vanilla HTML, CSS, and JavaScript. Keep it
unless a change is approved.

The proposed backend and data stack is:

-   **Backend:** Node.js with Express.js.
-   **Database:** MySQL.
-   **Database driver:** `mysql2` with parameterized queries.
-   **Authentication:** Microsoft identity platform / Microsoft Entra
    ID, configured for the university account requirements.
-   **Image storage:** A suitable private or controlled cloud
    object-storage service; do not assume local uploads are production
    storage.
-   **Configuration:** Environment variables loaded on the server.
-   **Validation:** A maintained server-side validation library or
    consistent custom validation.
-   **Testing:** Automated API and browser tests where practical.

This is a proposed architecture, not an existing implementation. Before
installing dependencies or creating backend files, inspect the
repository and propose the exact structure. Do not add a second
competing architecture.

### Important authentication clarification

The existing `auth.js` demo flow is not secure authentication.
Production authentication must validate Microsoft-issued identity
information on the server, enforce the permitted university account
policy, establish a secure session, and authorize requests on the
backend. Do not treat a typed email address or a `localStorage` value as
proof of identity.

The exact permitted email domain, tenant policy, Microsoft application
registration, redirect URIs, and identity claims must be confirmed
during setup. Do not guess tenant IDs or credentials.

## 5. Product modules and expected behavior

Implement these modules incrementally, only after their dependencies are
ready.

### A. Public website

-   Homepage and existing informational pages.
-   Navigation between valid pages.
-   Explore services.
-   Clear login and registration entry points.
-   Consistent responsive layout.

### B. Authentication and accounts

-   Microsoft sign-in for eligible university accounts.
-   Server-side identity validation.
-   Secure login/logout and session handling.
-   User profile.
-   Backend-enforced roles and permissions.
-   A user may act as a consumer and may also become a producer.
-   Admin access must be granted securely, never through public
    self-registration.

### C. Producer onboarding and dashboard

-   Producer onboarding.
-   Profile and skills information.
-   Create, edit, publish, deactivate, and delete own service listings.
-   Upload service images safely.
-   View and manage incoming orders.
-   View accurate activity and earnings information only when supported
    by verified transaction data.

### D. Marketplace / Explore

-   Fetch real active listings from the backend.
-   Search title, description, category, and producer.
-   Filter by category and supported attributes.
-   Sort using server-supported values.
-   Paginate or limit results.
-   Service detail page with producer profile, description, images,
    price, delivery estimate, availability, and reviews.
-   Useful loading, empty, and error states.

### E. Consumer dashboard

-   Profile.
-   Own orders and order history.
-   Persistent favourites stored in the database.
-   Notifications.
-   Account settings.

### F. Order management

-   Create orders only for valid, available listings.
-   Store order requirements and price snapshots.
-   Producer can accept or reject eligible incoming orders.
-   Track progress and delivery.
-   Consumer can cancel only when allowed by the agreed order rules.
-   Completion must be explicitly recorded.
-   Enforce valid status transitions on the backend.
-   Only the consumer, producer, and authorized administrators may
    access the relevant order.

Suggested statuses (confirm the final lifecycle before implementing):
`Pending`, `Accepted`, `Rejected`, `In Progress`, `Delivered`,
`Completed`, `Cancelled`.

### G. Reviews and ratings

-   Only eligible consumers can review completed orders.
-   Rating range 1--5.
-   Prevent duplicate reviews for the same order.
-   Calculate displayed averages from actual review records.
-   Provide moderation/reporting controls.

### H. Administration and moderation

-   Admin-only dashboard and APIs.
-   User and listing management.
-   Review reports.
-   Moderation actions and audit trail.
-   Dashboard statistics derived from actual database records.

### I. Payments --- later phase

-   Do not implement payments until the order lifecycle and business
    rules are defined.
-   Select and configure a supported payment provider only after owner
    approval.
-   Create payment orders on the backend.
-   Verify signatures/webhooks server-side.
-   Make payment processing idempotent.
-   Never store card numbers or CVV.
-   Do not describe a payment as successful based only on a frontend
    response.
-   Clarify whether the platform will collect payments, facilitate
    direct payments, or use a marketplace/split-settlement arrangement.
    This affects legal, gateway, and settlement requirements.

### J. Notifications and messaging

-   Persist notifications in the database.
-   Authorize access to each user's notifications.
-   Consider real-time delivery only after a reliable basic notification
    flow exists.
-   Order-related messages must be visible only to authorized
    participants.
-   Add reporting and abuse controls if messaging is implemented.

## 6. Suggested database entities

The following are candidate entities, not a finalized schema:

-   `users`
-   `categories`
-   `services`
-   `service_images`
-   `orders`
-   `favorites`
-   `reviews`
-   `notifications`
-   `reports`

Additional entities may be needed for sessions, payments,
conversations/messages, producer profiles, moderation audit logs, or
settlements.

Before writing schema or migrations: 1. Define relationships and
ownership. 2. Define deletion and retention rules. 3. Define uniqueness
and indexing requirements. 4. Define order and payment state
transitions. 5. Avoid storing redundant or sensitive data. 6. Present
the ER diagram and migration plan for review.

## 7. Development workflow --- follow for every task

For each feature or phase:

1.  **Read context:** Read this guide and inspect all relevant current
    files.
2.  **Audit:** Explain what already exists and what is missing.
3.  **Plan:** List intended changes and files to be created/modified.
4.  **Clarify blockers:** Ask only for information or credentials that
    are genuinely required. Never fabricate them.
5.  **Implement:** Make the smallest coherent set of changes.
6.  **Integrate:** Connect frontend, API, and database where applicable.
7.  **Validate:** Run available linting, tests, server checks, and
    manual workflow checks.
8.  **Review:** Check for regressions, security issues, broken links,
    and responsive layout problems.
9.  **Report:** State what changed, what was tested, results, and what
    remains.
10. **Stop:** Do not begin unrelated phases unless requested.

If the coding environment cannot access or edit the user's local project
directly, explain that limitation and provide exact file contents or
patch instructions instead of claiming files were changed.

## 8. Session handoff and progress tracking

At the end of every work session, provide a concise handoff containing:

``` text
COMPLETED:
- ...

FILES CREATED:
- ...

FILES MODIFIED:
- ...

TESTS RUN:
- ...
RESULTS:
- ...

BLOCKERS / CONFIGURATION REQUIRED:
- ...

NOT COMPLETED:
- ...

NEXT RECOMMENDED TASK:
- ...
```

Update this guide's **Project status** section only when the repository
has actually changed and the relevant feature has been verified. Do not
mark work complete merely because code was generated.

## 9. Development Roadmap & Execution Status

This roadmap defines the complete development lifecycle for Skillora. Every phase must be executed in strict sequence. No phase may be assumed or marked completed without verification.

### Phase Execution Chart

| Phase | Title | Scope & Key Tasks | Status |
| :--- | :--- | :--- | :--- |
| **Phase 0** | **Base UI & Static Pages** | Static pages (`index.html`, `explore.html`, `become-producer.html`, `about.html`), CSS design system (`styles.css`), responsive nav (`script.js`), and updated hero image with floating Bennett University badge. | **Completed & Verified** |
| **Phase 1** | **Backend & DB Foundation** | Express.js server (`server.js`), MySQL connection pool (`db/connection.js`), relational schema (`db/schema.sql`), initial seed data (`db/seed.sql`), setup script (`scripts/setup-db.js`). | **Code Completed** *(Awaiting live DB run in Phase 14)* |
| **Phase 2** | **Authentication & Accounts** | Microsoft Entra ID verification & domain validation (`@bennett.edu.in`), JWT HTTP-only cookies (`middleware/auth.js`), login & profile routes (`routes/auth.js`, `login.html`), role gating. | **Code Completed** *(Gated campus demo mode active)* |
| **Phase 3** | **Marketplace & Explore** | Category API (`routes/categories.js`), dynamic service querying with search, category filtering, price/newest sorting, pagination (`routes/services.js`), explore page integration, service detail intake (`service-detail.html`). | **Completed & Verified** |
| **Phase 4** | **Producer Hub & Listings** | Producer statistics (`/api/producer/stats`), listing CRUD (`/api/producer/services`), multipart file upload with MIME & size validation (`middleware/upload.js`), incoming order management, producer dashboard (`producer-dashboard.html`). | **Completed & Verified** |
| **Phase 5** | **Consumer Dashboard & Orders** | Service order creation with price snapshots (`routes/orders.js`), buyer order history, order cancellation/completion lifecycle, persistent favorites (`routes/favorites.js`), consumer dashboard (`consumer-dashboard.html`). | **Completed & Verified** |
| **Phase 6** | **Reviews & Notifications** | Verified order review intake (1–5 stars, duplicate blocking), review aggregate calculations (`routes/reviews.js`), persistent in-app notifications (`routes/notifications.js`). | **Completed & Verified** |
| **Phase 7** | **Admin Dashboard & Moderation** | Administrative metrics, user directory with role management (`routes/admin.js`), listing moderation (`active`/`suspended`/`inactive`), transaction audit logs (`admin-dashboard.html`). | **Completed & Verified** |
| **Phase 8** | **Campus Escrow Payments** | Escrow payment intent creation (`POST /api/payments/create-intent`), server-side verification, order transition to `in_progress`. | **Simulation Completed** *(Production commercial gateway deferred per Section 5.I)* |
| **Phase 9** | **Order Chat & Messaging** | Order-linked discussion thread (`routes/messages.js`), access control (buyer/producer/admin only), in-app chat modal in user dashboards. | **Completed & Verified** |
| **Phase 10** | **Disputes & Moderation Reports**| Reporting endpoints for listings, orders, and users (`routes/reports.js`), reporting modal on `service-detail.html`, admin dispute resolution actions. | **Completed & Verified** |
| **Phase 11** | **Automated Test Scaffolding** | Test suite verifying email domain regex, category counts, order state machine transitions, and review rules. | **Completed** |
| **Phase 12** | **Security, Testing & Bug Fixing** | Security hardening (Helmet headers, tiered rate-limiting, CSRF token/SameSite validation, deep input sanitization against XSS), producer image upload pipeline (`middleware/upload.js`), 88 automated regression & security tests (`scripts/test-api.js`, `scripts/test-suite.ps1`). | **Completed & Verified (88/88 Tests Passed)** |
| **Phase 13** | **UI/UX Optimization & Responsiveness** | Cross-device responsive layout polish, interactive toast notifications (`window.showToast`), skeleton loading placeholders (`.skeleton`), polished empty-state cards (`.empty-card`), modal zoom transitions, accessible focus rings, and reduced-motion support. | **Completed & Verified** |
| **Phase 14** | **Final Deployment** | Production Docker multi-container builds (`Dockerfile`, `docker-compose.yml`), volumes configuration (`./uploads:/app/uploads`), production environment setup, and reverse proxy guidelines. | **Ready for Deployment (Strictly Pending User Approval)** |

---

## 10. Completed Dependencies & Readiness for Phase 14

All prerequisites and gaps from Phases 1–13 have been addressed and verified:

1. **Front-Page Hero Image & Badge (Completed):**
   - High-resolution hero image updated with user asset in `images/hero-students.png`.
   - Floating Bennett University verified badge (`.hero-badge-float`) positioned in bottom-right with subtle CSS animation.
2. **Producer Image Upload Handler (Completed):**
   - Implemented `middleware/upload.js` with 5MB size limit, MIME/extension whitelisting, and unique filename generation.
   - Connected to `routes/producer.js` (`POST /api/producer/services` & `POST /api/producer/services/:id/image`) and `producer-dashboard.html`.
3. **Comprehensive Security Hardening (Completed):**
   - `middleware/security.js` active with Helmet headers, sliding-window rate limiters, XSS input sanitization, and CSRF protection.
4. **Automated Verification (Completed):**
   - All 88 tests pass cleanly with zero failures (`scripts/test-suite.ps1`, `scripts/test-api.js`).
5. **UI/UX Polish (Completed):**
   - Toast notification system, loading skeletons, responsive tables, and empty states active across all user views.
6. **Deployment Assets (Ready):**
   - Multi-container `docker-compose.yml` and `Dockerfile` configured with persistent volume mounts, ready for launch upon user approval.

---

## 11. First instruction to the AI

Before implementing anything:

1.  Read this entire `PROJECT_GUIDE.md`.
2.  Inspect the current repository and compare it with the project structure and status above.
3.  Identify any differences between the guide and the actual files.
4.  Produce a concise audit and a phased implementation plan.
5.  Recommend the first small, testable development task.
6.  Do not modify files until the user approves the plan.

**Primary objective:** Evolve the existing Skillora static frontend into a secure, reliable, fully functional student marketplace while preserving its existing visual identity and avoiding unnecessary rewrites.
