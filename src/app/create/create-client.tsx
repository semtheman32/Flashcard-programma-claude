"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ClipboardPaste, FileJson, PenLine } from "lucide-react";
import { importJsonAction } from "@/app/actions";
import { BulkPaste } from "@/components/bulk-paste";
import { CardEditor } from "@/components/card-editor";
import { DeckForm } from "@/components/deck-form";
import { Button, Label, Panel, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";

type Tab = "single" | "bulk" | "json";

export function CreateClient({
  decks,
  subjects,
  initialDeckId,
}: {
  decks: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  initialDeckId?: string;
}) {
  const router = useRouter();
  const [deckId, setDeckId] = useState(initialDeckId ?? decks[0]?.id ?? "");
  const [creatingDeck, setCreatingDeck] = useState(decks.length === 0);
  const [tab, setTab] = useState<Tab>("bulk");
  const [added, setAdded] = useState(0);
  const [json, setJson] = useState("");
  const [jsonResult, setJsonResult] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "bulk", label: "Plakken", icon: <ClipboardPaste size={15} /> },
    { id: "single", label: "Eén voor één", icon: <PenLine size={15} /> },
    { id: "json", label: "JSON importeren", icon: <FileJson size={15} /> },
  ];

  return (
    <div className="space-y-6">
      <Panel className="p-5">
        <h2 className="mb-4 font-medium">1. Kies een deck</h2>
        {creatingDeck ? (
          <DeckForm
            subjects={subjects}
            onSaved={(d) => {
              setCreatingDeck(false);
              setDeckId(d.id);
              router.refresh();
            }}
            onCancel={decks.length ? () => setCreatingDeck(false) : undefined}
          />
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select value={deckId} onChange={(e) => setDeckId(e.target.value)} className="sm:max-w-sm" aria-label="Deck">
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <Button variant="secondary" onClick={() => setCreatingDeck(true)}>
              + Nieuw deck
            </Button>
            {deckId && (
              <Button variant="ghost" onClick={() => router.push(`/decks/${deckId}`)}>
                Naar deck
              </Button>
            )}
          </div>
        )}
      </Panel>

      <Panel className={cn("p-5", (!deckId || creatingDeck) && tab !== "json" && "pointer-events-none opacity-50")}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-medium">2. Voeg kaarten toe</h2>
          {added > 0 && <span className="text-sm text-emerald-600">{added} toegevoegd in deze sessie</span>}
        </div>
        <div className="mb-5 flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800/60">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm",
                tab === t.id ? "bg-white font-medium shadow-sm dark:bg-zinc-900" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100",
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
        {tab === "single" && deckId && (
          <CardEditor key={deckId} deckId={deckId} onSaved={() => setAdded((n) => n + 1)} />
        )}
        {tab === "bulk" && deckId && <BulkPaste deckId={deckId} onDone={(n) => setAdded((x) => x + n)} />}
        {tab === "json" && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-500">
              Plak een deck in het JSON-formaat (zie <code className="text-xs">agent/IMPORT_FORMAT.md</code>). Het deck wordt aangemaakt op basis van de
              naam in het bestand; bestaande kaarten met dezelfde voorkant worden overgeslagen.
            </p>
            <div>
              <Label>Of kies een bestand</Label>
              <input
                type="file"
                accept="application/json,.json"
                className="text-sm"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setJson(await f.text());
                }}
              />
            </div>
            <Textarea rows={10} value={json} onChange={(e) => setJson(e.target.value)} className="font-mono text-[13px]" placeholder='{"name": "Mijn deck", "cards": [{"front": "…", "back": "…"}]}' />
            {jsonResult && <p className="text-sm">{jsonResult}</p>}
            <Button
              disabled={pending || !json.trim()}
              onClick={() =>
                start(async () => {
                  let r;
                  try {
                    JSON.parse(json);
                    r = await importJsonAction(json, {});
                  } catch {
                    return setJsonResult("Ongeldige JSON.");
                  }
                  if (!r.ok) return setJsonResult(`Fout: ${r.error}`);
                  setJsonResult(
                    r.data.decks
                      .map((d) => `${d.name}: ${d.cardsCreated} nieuw, ${d.cardsSkipped} overgeslagen (${d.action === "created" ? "nieuw deck" : "bestaand deck"})`)
                      .join(" · "),
                  );
                  setJson("");
                  router.refresh();
                })
              }
            >
              Importeren
            </Button>
          </div>
        )}
      </Panel>
    </div>
  );
}
