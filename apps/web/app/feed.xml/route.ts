import { atomXml } from "@/lib/feeds";

export const dynamic = "force-static";
export const revalidate = 3600;

export function GET(): Response {
  // Identical content to /atom.xml — provided for tools/users that
  // hardcode /feed.xml as their feed URL. Same body, different path.
  const xml = atomXml();
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
