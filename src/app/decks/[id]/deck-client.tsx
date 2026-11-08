"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowRightLeft,
  BookOpenCheck,
  ClipboardPaste,
  Copy,
  Download,
  GitMerge,
  GraduationCap,
  Layers,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Trash2,
  Zap,
} from "lucide-react";
import {
  deleteCardAction,
  deleteDeckAction,
  duplicateDeckAction,
  mergeDecksAction,
  moveCardAction,
  resetCardProgressAction,
} from "@/app/actions";
import { BulkPaste } from "@/components/bulk-paste";
import { CardEditor } from "@/components/card-editor";
import { DeckForm } from "@/components/deck-form";
import { Badge, Button, EmptyState, Input, LinkButton, Panel, Progress, Select, buttonClass } from "@/components/ui";
import { CARD_TYPE_LABELS, STATUSES, STATUS_LABELS, clozePrompt, type CardType } from "@/lib/cards";
import { formatDate, relativeDue } from "@/lib/format";
import type { CardDTO, DeckSummary } from "@/server/mappers";

const STATUS_COLORS: Record<string, string> = {
  new: "#64748b",
  learning: "#f59e0b",
  review: "#0ea5e9",
  mastered: "#10b981",
};

type PanelKind = null | "add" | "bulk" | "settings" | "merge";

export function DeckClient({
  deck,
  cards,
  decks,
  subjects,
  tags,
}: {
  deck: DeckSummary;
  cards: CardDTO[];
  decks: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  tags: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [panel, setPanel] = useState<PanelKind>(cards.length === 0 ? "bulk" : null);
  const [editing, setEditing] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("position");
  const [mergeSources, setMergeSources] = useState<string[]>([]);
  const [lastType, setLastType] = useState<CardType>("term");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = cards.filter(
      (c) =>
        (!needle || c.front.toLowerCase().includes(needle) || c.back.toLowerCase().includes(needle)) &&
        (!tag || c.tags.includes(tag)) &&
        (!status || c.status === status),
    );
    if (sort === "front") list = [...list].sort((a, b) => a.front.localeCompare(b.front));
    if (sort === "updated") list = [...list].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    if (sort === "due")
      list = [...list].sort((a, b) => (a.dueAt ? +new Date(a.dueAt) : Infinity) - (b.dueAt ? +new Date(b.dueAt) : Infinity));
    if (sort === "difficulty") list = [...list].sort((a, b) => b.difficulty - a.difficulty || b.lapses - a.lapses);
    return list;
  }, [cards, q, tag, status, sort]);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) alert(r.error);
      else {
        after?.();
        router.refresh();
      }
    });

  const counts = deck.statusCounts;

  return (
    <>
      <div className="mb-2 text-sm text-zinc-500">
        <Link href="/library" className="hover:underline">Bibliotheek</Link>
        {deck.subject && <> / <Link href={`/library?subject=${deck.subject.id}`} className="hover:underline">{deck.subject.name}</Link></>}
      </div>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${deck.color}1f`, color: deck.color }}>
            <Layers size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{deck.name}</h1>
            {deck.description && <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">{deck.description}</p>}
            <p className="mt-1 text-xs text-zinc-400">
              {deck.cardCount} kaarten · aangemaakt {formatDate(deck.createdAt)} · laatst gestudeerd {formatDate(deck.lastStudiedAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/study/${deck.id}/flashcards`} variant="secondary" aria-disabled={!cards.length}>
            <BookOpenCheck size={16} /> Flashcards
          </LinkButton>
          <LinkButton href={`/study/${deck.id}/learn`} variant="secondary">
            <Zap size={16} /> Leren
          </LinkButton>
          <LinkButton href={`/study/${deck.id}/review`}>
            <GraduationCap size={16} /> Herhalen{deck.dueCount ? ` (${deck.dueCount})` : ""}
          </LinkButton>
        </div>
      </div>

      <Panel className="mb-6 p-5">
        <div className="mb-3 flex items-center gap-3">
          <Progress value={deck.progress} color={deck.color} className="h-2" />
          <span className="text-sm font-medium tabular-nums">{deck.progress}%</span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setStatus(status === s ? "" : s)} className="flex items-center gap-2 hover:underline">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
              {STATUS_LABELS[s]} <span className="tabular-nums text-zinc-500">{counts[s]}</span>
            </button>
          ))}
          <span className="flex items-center gap-2 text-orange-600">Nu te herhalen <span className="tabular-nums">{deck.dueCount}</span></span>
        </div>
      </Panel>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button onClick={() => setPanel(panel === "add" ? null : "add")} variant={panel === "add" ? "primary" : "secondary"} size="sm">
          <Plus size={15} /> Kaart toevoegen
        </Button>
        <Button onClick={() => setPanel(panel === "bulk" ? null : "bulk")} variant={panel === "bulk" ? "primary" : "secondary"} size="sm">
          <ClipboardPaste size={15} /> Plakken
        </Button>
        <Button onClick={() => setPanel(panel === "settings" ? null : "settings")} variant="ghost" size="sm">
          <Settings2 size={15} /> Deck bewerken
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => act(async () => {
          const r = await duplicateDeckAction(deck.id);
          if (r.ok) router.push(`/decks/${r.data.id}`);
          return r;
        })}>
          <Copy size={15} /> Dupliceren
        </Button>
        {decks.length > 0 && (
          <Button onClick={() => setPanel(panel === "merge" ? null : "merge")} variant="ghost" size="sm">
            <GitMerge size={15} /> Samenvoegen
          </Button>
        )}
        <a href={`/api/decks/${deck.id}/export`} className={buttonClass("ghost", "sm")}>
          <Download size={15} /> Exporteren (JSON)
        </a>
        <Button
          variant="ghost"
          size="sm"
          className="text-red-600 hover:text-red-700"
          onClick={() => {
            if (confirm(`Deck "${deck.name}" met ${deck.cardCount} kaarten en alle voortgang definitief verwijderen?`))
              act(() => deleteDeckAction(deck.id), () => router.push("/library"));
          }}
        >
          <Trash2 size={15} /> Verwijderen
        </Button>
      </div>

      {panel && (
        <Panel className="mb-6 p-5">
          {panel === "add" && (
            <CardEditor
              deckId={deck.id}
              defaultType={lastType}
              onSaved={(c, keep) => {
                setLastType(c.type as CardType);
                if (!keep) setPanel(null);
                router.refresh();
              }}
              onCancel={() => setPanel(null)}
            />
          )}
          {panel === "bulk" && <BulkPaste deckId={deck.id} onDone={() => router.refresh()} />}
          {panel === "settings" && (
            <DeckForm deck={deck} subjects={subjects} onSaved={() => { setPanel(null); router.refresh(); }} onCancel={() => setPanel(null)} />
          )}
          {panel === "merge" && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-500">
                Kies decks om in <strong>{deck.name}</strong> samen te voegen. Hun kaarten (met voortgang) worden hierheen verplaatst en de lege decks worden verwijderd.
              </p>
              <div className="grid gap-1 sm:grid-cols-2">
                {decks.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={mergeSources.includes(d.id)}
                      onChange={(e) => setMergeSources(e.target.checked ? [...mergeSources, d.id] : mergeSources.filter((x) => x !== d.id))}
                    />
                    {d.name}
                  </label>
                ))}
              </div>
              <Button
                disabled={!mergeSources.length || pending}
                onClick={() => {
                  if (confirm(`${mergeSources.length} deck(s) samenvoegen in "${deck.name}"?`))
                    act(() => mergeDecksAction(deck.id, mergeSources), () => { setMergeSources([]); setPanel(null); });
                }}
              >
                Samenvoegen
              </Button>
            </div>
          )}
        </Panel>
      )}

      {cards.length === 0 ? (
        <EmptyState icon={<Layers size={28} />} title="Dit deck is nog leeg" description="Voeg kaarten toe via de knoppen hierboven, of laat Claude Code het deck vullen." />
      ) : (
        <>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek in dit deck…" className="pl-9" />
            </div>
            <Select value={tag} onChange={(e) => setTag(e.target.value)} className="sm:w-40" aria-label="Filter op tag">
              <option value="">Alle tags</option>
              {tags.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-40" aria-label="Filter op status">
              <option value="">Alle statussen</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </Select>
            <Select value={sort} onChange={(e) => setSort(e.target.value)} className="sm:w-44" aria-label="Sorteren">
              <option value="position">Volgorde</option>
              <option value="front">Alfabetisch</option>
              <option value="updated">Laatst bewerkt</option>
              <option value="due">Eerst due</option>
              <option value="difficulty">Moeilijkste eerst</option>
            </Select>
          </div>
          <p className="mb-2 text-xs text-zinc-500">{filtered.length} van {cards.length} kaarten</p>
          <div className="space-y-2">
            {filtered.map((c) =>
              editing === c.id ? (
                <Panel key={c.id} className="p-5">
                  <CardEditor deckId={deck.id} card={c} onSaved={() => { setEditing(null); router.refresh(); }} onCancel={() => setEditing(null)} />
                </Panel>
              ) : (
                <Panel key={c.id} className="group p-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <div className="card-text text-sm font-medium">{c.type === "cloze" ? clozePrompt(c.front) : c.front}</div>
                    <div className="card-text text-sm text-zinc-600 dark:text-zinc-400">{c.type === "cloze" ? c.front.replace(/\{\{(.+?)\}\}/g, "[$1]") : c.back}</div>
                    <div className="flex items-start gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                      <Button variant="ghost" size="sm" aria-label="Bewerken" onClick={() => setEditing(c.id)}><Pencil size={14} /></Button>
                      <Button variant="ghost" size="sm" aria-label="Verplaatsen" onClick={() => setMoving(moving === c.id ? null : c.id)}><ArrowRightLeft size={14} /></Button>
                      <Button variant="ghost" size="sm" aria-label="Voortgang resetten" title="Voortgang resetten" onClick={() => {
                        if (confirm("Leervoortgang van deze kaart resetten?")) act(() => resetCardProgressAction(c.id));
                      }}><RotateCcw size={14} /></Button>
                      <Button variant="ghost" size="sm" aria-label="Verwijderen" onClick={() => {
                        if (confirm("Kaart verwijderen?")) act(() => deleteCardAction(c.id));
                      }}><Trash2 size={14} /></Button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    <Badge color={STATUS_COLORS[c.status]}>{STATUS_LABELS[c.status as keyof typeof STATUS_LABELS]}</Badge>
                    {c.type !== "term" && <Badge>{CARD_TYPE_LABELS[c.type as CardType]?.label ?? c.type}</Badge>}
                    {c.tags.map((t) => (
                      <button key={t} onClick={() => setTag(t)}><Badge>#{t}</Badge></button>
                    ))}
                    {c.status !== "new" && <span className="text-zinc-400">volgende herhaling {relativeDue(c.dueAt)} · interval {c.interval} d · ease {c.easeFactor.toFixed(2)}{c.lapses ? ` · ${c.lapses}× vergeten` : ""}</span>}
                  </div>
                  {moving === c.id && (
                    <div className="mt-3 flex gap-2">
                      <Select defaultValue="" onChange={(e) => e.target.value && act(() => moveCardAction(c.id, e.target.value), () => setMoving(null))} className="sm:w-64">
                        <option value="" disabled>Verplaats naar deck…</option>
                        {decks.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </Select>
                    </div>
                  )}
                </Panel>
              ),
            )}
          </div>
        </>
      )}
    </>
  );
}
