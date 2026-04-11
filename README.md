# Product Reference Manager

A modern, industry-grade product reference management system built by **[Zain Technologies LTD](https://zaintechnologiesltd.github.io)**.

## Features

- **Product CRUD** — Create, read, update, and delete products with full validation
- **Server-Side Pagination** — Sort, search, and filter across large datasets
- **Bulk Operations** — Select multiple products for bulk delete or CSV export
- **Authentication** — Secure username/password auth with session management
- **Dark Mode** — Toggle between light and dark themes
- **Responsive UI** — Works on desktop and mobile

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4 |
| UI Components | shadcn/ui (New York), TanStack Table |
| Backend | Express 4, tRPC v11, Pino logging |
| Database | MySQL 8, Drizzle ORM |
| Auth | @oslojs/crypto (SHA-256 sessions), @node-rs/argon2 |
| Testing | Vitest, Testing Library, ESLint |

## Quick Start

### Prerequisites

- [Node.js 20+](https://nodejs.org)
- [MySQL 8](https://dev.mysql.com/downloads/)
- [pnpm](https://pnpm.io) (`npm install -g pnpm`)

### Installation

```bash
# Clone the repo
git clone https://github.com/ZainTechnologiesLTD/Product_Reference.git
cd Product_Reference

# Install dependencies
pnpm install

# Create .env file
cp .env.example .env
# Edit .env with your MySQL credentials:
# DATABASE_URL=mysql://root:yourpassword@localhost:3306/product_manager
```

### Database Setup

```bash
# Create the database in MySQL
mysql -u root -p -e "CREATE DATABASE product_manager;"

# Run migrations
pnpm run db:push
```

### Run

```bash
# Development
pnpm run dev

# Production build
pnpm run build
pnpm run start
```

Open **http://localhost:3000** and register your first account.

### Docker

```bash
docker compose up -d
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start development server |
| `pnpm run build` | Build for production |
| `pnpm run start` | Run production build |
| `pnpm run check` | TypeScript type check |
| `pnpm run lint` | ESLint |
| `pnpm run test` | Run tests |
| `pnpm run ci` | check + lint + test |
| `pnpm run db:push` | Generate & run DB migrations |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | MySQL connection string |
| `NODE_ENV` | No | `development` | `development` / `production` / `test` |
| `PORT` | No | `3000` | Server port |

## Project Structure

```
├── client/src/
│   ├── components/       # Shared components (AppLayout, DataTable, UI)
│   ├── features/
│   │   ├── auth/         # Login & Register pages
│   │   └── products/     # Products page, columns, form dialog
│   ├── hooks/            # useDebounce, useComposition, useMobile
│   ├── contexts/         # ThemeContext
│   └── lib/              # tRPC client, utils
├── server/
│   ├── _core/            # Express setup, tRPC, env, context
│   ├── auth/             # Session management, auth routes
│   ├── lib/              # Pino logger
│   ├── db.ts             # Database queries
│   └── routers.ts        # tRPC router definitions
├── drizzle/              # Schema, relations, migrations
├── shared/               # Shared constants & types
├── Dockerfile
└── docker-compose.yml
```

## License

[MIT](LICENSE) © [Zain Technologies LTD](https://zaintechnologiesltd.github.io)
