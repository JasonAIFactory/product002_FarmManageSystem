# BINJO (빈조) — Farm Management & Direct Sales Platform

> 농사가 본업이다. 나머지는 다 자동으로.
> Farming is the real job. Everything else runs itself.

AI-powered farm management platform for 빈조농장, a solo apple orchard in Sacheon, Gyeongnam.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your values

# Set up database
npx prisma generate
npx prisma db push
npx prisma db seed

# Run development server
npm run dev
```

## Development

See `CLAUDE.md` for coding conventions and project structure.
See `/docs/` for detailed implementation specs per phase.

## Tech Stack (Phase 1)

- **Framework**: Next.js 14+ (App Router, TypeScript)
- **Styling**: Tailwind CSS
- **Database**: Supabase PostgreSQL + Prisma ORM
- **Storage**: Supabase Storage
- **Deploy**: Vercel

## Roadmap

| Phase | Feature | Status |
|---|---|---|
| 1 | Brand Page + Admin | 🔨 In Progress |
| 2 | Voice Farm Diary | ⏳ Planned |
| 3 | Automated Bookkeeping | ⏳ Planned |
| 4 | Direct Orders + Intelligence | ⏳ Planned |
