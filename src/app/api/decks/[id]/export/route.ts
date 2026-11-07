import { exportDeck } from "@/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const data = await exportDeck(id);
    const filename = `${data.name.replace(/[^\p{L}\p{N}_-]+/gu, "-").toLowerCase() || "deck"}.json`;
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Deck niet gevonden" }), { status: 404 });
  }
}
