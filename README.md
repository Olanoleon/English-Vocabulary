# VocabPath - English Vocabulary Practice

A mobile-optimized vocabulary practice app for Spanish speakers learning English. Built with Next.js 16, Prisma, and Neon PostgreSQL.

For AI/session quick bootstrap context, read `CURSOR_CONTEXT.md` first.

## Features

### Learner Interface
- **Learning Path**: Sequential sections with lock/active/completed states
- **Introduction Module**: Reading context with highlighted vocabulary, Spanish definitions, and text-to-speech
- **Practice Module**: Interactive exercises (multiple choice, fill-in-the-blank) with instant feedback
- **Unit Test**: Scored assessments with vocabulary + phonetics questions (80% to pass and unlock next section)
- **Stats Dashboard**: Progress tracking across all sections

### Admin Panel
- **Unit Management**: Create, edit, reorder, and delete vocabulary sections
- **Vocabulary Editor**: Add words with Spanish definitions, IPA transcription, stressed syllables, and example sentences
- **Question Builder**: Create multiple choice, fill-in-blank, and phonetics questions for practice and test modules
- **Introduction Content**: Write reading passages with `**highlighted**` vocabulary words
- **Learner Management**: Create and delete learner accounts

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Database**: Neon PostgreSQL with Prisma 7 ORM
- **Styling**: Tailwind CSS 4 (mobile-first)
- **Auth**: iron-session (encrypted cookie sessions)
- **Icons**: Lucide React
- **Audio**: Web Speech API (text-to-speech)

## Getting Started

### Prerequisites
- Node.js 20+
- A Neon PostgreSQL database

### Setup

1. Clone and install:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env`:
   ```
   DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
   SESSION_SECRET="your-secret-at-least-32-characters"
   ```

3. Push the database schema:
   ```bash
   npm run db:push
   ```

4. Seed with demo data:
   ```bash
   npm run db:seed
   ```

5. Start the dev server:
   ```bash
   npm run dev
   ```

### Demo Accounts

After seeding:
- **Admin**: `admin` / `admin123`
- **Learner**: `maria` / `learner123`

## Deployment (Railway)

1. Connect your repository to Railway
2. Set environment variables:
   - `DATABASE_URL` - Your Neon connection string
   - `SESSION_SECRET` - A random 32+ character secret
3. Railway will auto-detect Next.js and deploy

The `railway.toml` is pre-configured with build and start commands.

## Project Structure

```
src/
├── app/
│   ├── admin/           # Admin pages (units, learners, settings)
│   ├── learn/           # Learner pages (path, sections, modules)
│   ├── login/           # Login page
│   └── api/             # API routes (auth, admin CRUD, learner progress)
├── generated/prisma/    # Generated Prisma client
├── lib/
│   ├── auth.ts          # Session helpers
│   ├── db.ts            # Prisma client singleton
│   └── utils.ts         # Utility functions
└── proxy.ts             # Route protection (auth middleware)
```
