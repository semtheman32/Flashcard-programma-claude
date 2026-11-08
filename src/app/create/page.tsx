import { listDecks, listSubjects } from "@/server";
import { PageHeader } from "@/components/ui";
import { CreateClient } from "./create-client";

export default async function CreatePage({ searchParams }: { searchParams: Promise<{ deck?: string }> }) {
  const { deck } = await searchParams;
  const [decks, subjects] = await Promise.all([listDecks(), listSubjects()]);
  return (
    <>
      <PageHeader title="Maken" description="Maak een deck en voeg kaarten toe: los, door te plakken of via JSON." />
      <CreateClient
        decks={decks.map((d) => ({ id: d.id, name: d.name }))}
        subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
        initialDeckId={deck}
      />
    </>
  );
}
