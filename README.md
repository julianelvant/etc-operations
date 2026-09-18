# ETC Operations

Hello world homepage for ETC Operations, set up with the same core stack as Gradeful.

## Stack

- [Next.js](https://nextjs.org/) (App Router, Turbopack)
- [Tailwind CSS](https://tailwindcss.com/)
- [Supabase](https://supabase.com/) (database and auth)
- [Vercel](https://vercel.com/) (hosting and deployments)

## Local development

1. Copy `.env.example` to `.env.local` and fill in your Supabase credentials.
2. Install dependencies:

```bash
npm install
```

3. Start the dev server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000).

## Health check

`GET /api/health` returns the app and Supabase connection status.
