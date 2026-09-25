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
