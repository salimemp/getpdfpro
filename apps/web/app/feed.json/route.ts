import { jsonFeed } from "@/lib/feeds";

export const dynamic = "force-static";
export const revalidate = 3600;

export function GET(): Response {
  const json = jsonFeed();
  return new Response(json, {
    status: 200,
    headers: {
      "Content-Type": "application/feed+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
