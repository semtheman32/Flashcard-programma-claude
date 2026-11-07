import { notFound } from "next/navigation";
import { NotFoundError, countDueLaterToday, getDeck, getDueCards, getSettings, listCards } from "@/server";
import { EmptyState, LinkButton } from "@/components/ui";
import { FlashcardsSession } from "@/components/study/flashcards-session";
import { LearnSession } from "@/components/study/learn-session";
import { ReviewSession } from "@/components/study/review-session";

export default async function StudyModePage({
  params,
  searchParams,
}: {
  params: Promise<{ deckId: string; mode: string }>;
  searchParams: Promise<{ tag?: string; status?: string }>;
}) {
  const { deckId, mode } = await params;
  const { tag, status } = await searchParams;
  const all = deckId === "all";

  if (mode === "review") {
    let deckName = "Alle decks";
    if (!all) {
      try {
        deckName = (await getDeck(deckId)).name;
      } catch (e) {
        if (e instanceof NotFoundError) notFound();
        throw e;
      }
    }
    const [due, later] = await Promise.all([getDueCards(all ? undefined : deckId), countDueLaterToday(all ? undefined : deckId)]);
    return (
      <ReviewSession
        key={due.cards.map((c) => c.id).join()}
        cards={due.cards}
        deckId={all ? null : deckId}
        title={`${deckName} · Herhalen`}
        backHref={all ? "/study" : `/decks/${deckId}`}
        newCount={due.new.length}
        dueLaterToday={later}
      />
    );
  }

  if (all || !["flashcards", "learn"].includes(mode)) notFound();
  let deck;
  try {
    deck = await getDeck(deckId);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const cards = await listCards({ deckId, tag, status: status as "new" | undefined });
  if (!cards.length) {
    return (
      <EmptyState
        title="Geen kaarten om te studeren"
        description="Voeg eerst kaarten toe aan dit deck."
        action={<LinkButton href={`/decks/${deckId}`}>Naar deck</LinkButton>}
      />
    );
  }
  if (mode === "flashcards") return <FlashcardsSession cards={cards} deckId={deckId} deckName={deck.name} />;
  const settings = await getSettings();
  return <LearnSession cards={cards} deckId={deckId} deckName={deck.name} allowTypos={settings.allowTypos} />;
}
