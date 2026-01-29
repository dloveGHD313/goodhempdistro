This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Release Notes

**Fix(posts): display name and avatar persist in feed**

Root cause: /api/posts was sometimes running with an anonymous Supabase client and lacked an RLS policy to allow profile reads, causing display names/avatars to come back empty after a refresh (the feed fell back to "Member <id>" placeholders).

Fix:
- Use a viewer-aware Supabase client (authenticated vs anon) in the posts API route to fetch profile data reliably.
- Enforce dynamic "no-store" caching on both server (API route) and client (newsfeed fetch) to prevent stale or missing profile info.
- Standardize the PostDTO structure to always include identity fields (display name, avatar) for consistency.
- Add a SELECT policy on public.profiles to allow reading identity fields in anonymous context while RLS remains enabled (only identity fields, no sensitive data).

Verified:
- In incognito (anonymous) and logged-in sessions, refreshing the newsfeed multiple times shows correct display names and avatars for all posts (no fallback to "Member <id>").
- Creating a new post shows the author's display name and avatar immediately, and they persist after a refresh.
- No user email addresses are ever exposed in the feed (only display names and avatars).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
