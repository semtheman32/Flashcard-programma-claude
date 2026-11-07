import { notFound } from "next/navigation";
import { NotFoundError, getDeck, listCards, listDecks, listSubjects, listTags } from "@/server";
import { DeckClient } from "./deck-client";

export default async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let deck;
  try {
    deck = await getDeck(id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const [cards, decks, subjects, tags] = await Promise.all([listCards({ deckId: id }), listDecks(), listSubjects(), listTags(id)]);
  return (
    <DeckClient
      deck={deck}
      cards={cards}
      decks={decks.filter((d) => d.id !== id).map((d) => ({ id: d.id, name: d.name }))}
      subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
      tags={tags.map((t) => t.tag)}
    />
  );
}
