import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { nowFor } from "./clock";
import { housekeeping, load } from "./service";
import { store } from "./store";
import { buildView } from "./view";

export async function baseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Load a trip for a page: run on-load housekeeping, then build the view. */
export async function tripPage(slug: string, opts: { admin?: boolean } = {}) {
  const first = await store.getBundle(slug);
  if (!first) notFound();
  const now = await nowFor(first.trip);
  await housekeeping(slug, now);
  const bundle = await load(slug);
  return { bundle, now, view: buildView(bundle, now, opts), tripUrl: `${await baseUrl()}/t/${slug}` };
}
