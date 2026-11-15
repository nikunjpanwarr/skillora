# Skillora — Student Service Marketplace (Bennett University)

"Your Campus. Your Skills. Your Opportunities."

Skillora is a verified student-to-student service marketplace designed for Bennett University students.

---

## Architecture & Technology Stack

- **Frontend:** Vanilla HTML5, CSS3 (Custom Design System with CSS variables), and ES6+ JavaScript.
- **Backend:** Node.js with Express.js.
- **Database:** MySQL 8.0 with `mysql2/promise` and parameterized queries.
- **Authentication:** Microsoft Entra ID (Azure AD) + server-side domain verification (`@bennett.edu.in`) with JWT HTTP-only session cookies and gated development demo fallback.
- **Security:** Parameterized SQL queries preventing SQL injection, server-side role enforcement, and secure HTTP cookies.

---

## Quick Start Guide

### 1. Prerequisites
- **Node.js** (v18 or higher recommended)
- **MySQL Server 8.0**

### 2. Environment Configuration
Copy the example environment file and set your credentials:
```bash
cp .env.example .env
```
Update your MySQL credentials in `.env`:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=skillora_db
JWT_SECRET=your_custom_secret_key_min_32_characters
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Database Setup & Seeding
Run the automated schema and seed migration script:
```bash
npm run db:setup
```
This creates the `skillora_db` database, sets up all tables (`users`, `categories`, `services`, `service_images`, `favorites`, `orders`, `reviews`), and seeds the 8 Bennett University service categories along with initial student listings.

### 5. Start the Server
```bash
# Start server in production mode
npm start

# Or start in watch/development mode
npm run dev
```
Visit: **http://localhost:3000**

---

## API Endpoints Reference

### Health
- `GET /api/health` — Checks API server and MySQL database connection status.

### Authentication (`/api/auth`)
- `GET /api/auth/me` — Fetches current authenticated student profile and university auth config.
- `POST /api/auth/login/demo` — Authenticates with university email (`@bennett.edu.in`) in development demo mode.
- `POST /api/auth/login/microsoft` — Validates Microsoft Entra ID access token and university email.
- `POST /api/auth/logout` — Invalidation and clearance of HTTP-only session cookies.
- `PATCH /api/auth/profile` — Updates user profile details and role (`consumer` $\leftrightarrow$ `producer`).

### Marketplace (`/api/categories` & `/api/services`)
- `GET /api/categories` — Fetches all 8 service categories with visual tone, icon, and display order.
- `GET /api/services` — Fetches active services with filtering (`?category=slug`), full-text search (`?q=term`), sorting (`?sort=price_asc|price_desc|newest`), and pagination (`?page=1&limit=20`).
- `GET /api/services/:id` — Fetches complete service details, producer profile, and images.
- `POST /api/services` — Publishes a new service listing (requires authenticated session).

### Orders & Lifecycle (`/api/orders`)
- `POST /api/orders` — Places a new service order with requirements intake and price snapshot.
- `GET /api/orders/my-orders` — Returns student buyer order history with live status tracking.
- `GET /api/orders/:id` — Retrieves order details (consumer, producer, or admin access only).
- `PATCH /api/orders/:id/cancel` — Buyer cancels order while in `pending` status.
- `PATCH /api/orders/:id/complete` — Buyer confirms delivery completion and releases escrow.

### Producer Hub (`/api/producer`)
- `GET /api/producer/stats` — Real performance metrics (earnings, active listings, pending & completed orders).
- `GET /api/producer/services` — Retrieves all listings owned by producer.
- `POST /api/producer/services` — Publishes a new service listing.
- `PUT /api/producer/services/:id` — Updates an existing listing.
- `DELETE /api/producer/services/:id` — Deactivates a listing.
- `GET /api/producer/orders` — Incoming orders from fellow Bennett students.
- `PATCH /api/producer/orders/:id/status` — State transitions: `accepted`, `rejected`, `in_progress`, `delivered`.

### Favourites (`/api/favorites`)
- `GET /api/favorites` — Returns saved services for logged-in user.
- `POST /api/favorites/:serviceId` — Saves a service.
- `DELETE /api/favorites/:serviceId` — Removes a service from favorites.
- `GET /api/favorites/check/:serviceId` — Checks favorite state for heart icon.

### Reviews & Ratings (`/api/reviews`)
- `POST /api/reviews` — Submits 1-5 star rating and comment for a verified `completed` order.
- `GET /api/reviews/service/:serviceId` — Returns all public reviews and calculated average rating.

### In-App Notifications (`/api/notifications`)
- `GET /api/notifications` — Lists user notifications with unread counter.
- `PATCH /api/notifications/:id/read` — Marks single notification read.
- `POST /api/notifications/mark-all-read` — Marks all notifications read.

### Administration & Moderation (`/api/admin`)
- `GET /api/admin/stats` — Complete platform analytics (GMV, users, active services, order counts).
- `GET /api/admin/users` — User management directory with email search and role filter.
- `PATCH /api/admin/users/:id/role` — Assigns user roles (`consumer`, `producer`, `admin`).
- `GET /api/admin/services` — Platform-wide listing review.
- `PATCH /api/admin/services/:id/status` — Moderation controls (`active`, `suspended`, `inactive`).
- `GET /api/admin/orders` — Full audit log of all marketplace transactions.

### Payments & Escrow (`/api/payments`)
- `POST /api/payments/create-intent` — Idempotent escrow payment initialization.
- `POST /api/payments/verify` — Server-side signature verification & order transition to `in_progress`.

### Order Messaging & Chat (`/api/messages`)
- `GET /api/messages/order/:orderId` — Retrieves order conversation thread.
- `POST /api/messages` — Sends direct message within an order and notifies partner.

### Platform Reports & Disputes (`/api/reports`)
- `POST /api/reports` — Submits a moderation report for a listing, order, or user.
- `GET /api/reports` — Admin overview of platform reports.
- `PATCH /api/reports/:id` — Admin updates report resolution status (`investigating`, `resolved`, `dismissed`).

---

## Testing (Phase 11 Scaffolding / Phase 12) & Docker Deployment (Phase 14)

### Automated Test Suite
Run the built-in automated test suite verifying university security policies, category integrity, and order state machines:
```bash
npm test
```

### Docker Multi-Container Deployment (Phase 14)
Launch the full platform (Skillora Express app + MySQL 8.0) in Docker:
```bash
docker-compose up -d
```

---

## User Dashboards & Pages
- **Explore:** `http://localhost:3000/explore.html`
- **Service Detail & Order Intake:** `http://localhost:3000/service-detail.html?id=1`
- **Student Consumer Hub:** `http://localhost:3000/consumer-dashboard.html`
- **Producer Hub:** `http://localhost:3000/producer-dashboard.html`
- **Admin Moderation Hub:** `http://localhost:3000/admin-dashboard.html`

---

## Fallback / Offline Mode
The frontend automatically falls back gracefully to `data.js` and local storage when running in static file mode (e.g. VS Code Live Server or offline preview), ensuring zero broken views if the backend server is temporarily not running.
