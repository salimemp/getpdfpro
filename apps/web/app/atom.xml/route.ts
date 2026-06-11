import { atomXml } from "@/lib/feeds";

export const dynamic = "force-static";
export const revalidate = 3600;

export function GET(): Response {
  const xml = atomXml();
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
