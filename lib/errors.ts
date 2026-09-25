export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const DB_NOT_CONNECTED =
  "The database isn't connected. In Vercel → Settings → Environment Variables add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then redeploy. Open /status to check.";

export const DB_URL_INVALID =
  "NEXT_PUBLIC_SUPABASE_URL isn't a valid address. It should look like https://abcdefgh.supabase.co (Supabase → Project Settings → Data API). Fix it in Vercel, then redeploy. Open /status to check.";

export const DB_SECRET_KEY =
  "NEXT_PUBLIC_SUPABASE_ANON_KEY holds your SECRET key. Replace it with the publishable key (sb_publishable_…) from Supabase → Project Settings → API Keys, then redeploy. Open /status to check.";
