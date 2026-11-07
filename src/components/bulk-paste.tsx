"use client";

import { useMemo, useState, useTransition } from "react";
import { bulkCreateCardsAction } from "@/app/actions";
import { CARD_TYPES, CARD_TYPE_LABELS, type CardType } from "@/lib/cards";
import { Button, Label, Select, Textarea } from "./ui";

const SEPARATORS: { value: string; label: string }[] = [
  { value: "auto", label: "Automatisch (tab, ' - ', ' = ', ';' of ':')" },
  { value: "\t", label: "Tab (plakken uit Excel/Word-tabel)" },
  { value: " - ", label: "Streepje ( - )" },
  { value: ";", label: "Puntkomma (;)" },
  { value: ":", label: "Dubbele punt (:)" },
  { value: "=", label: "Is-teken (=)" },
];

function parse(text: string, sep: string) {
  const seps = sep === "auto" ? ["\t", " - ", " = ", " — ", ";", ":"] : [sep];
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      for (const s of seps) {
        const i = line.indexOf(s);
        if (i > 0) return { front: line.slice(0, i).trim(), back: line.slice(i + s.length).trim() };
      }
      return { front: line, back: "" };
    });
}

export function BulkPaste({ deckId, onDone }: { deckId: string; onDone?: (count: number) => void }) {
  const [text, setText] = useState("");
  const [sep, setSep] = useState("auto");
  const [type, setType] = useState<CardType>("term");
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const pairs = useMemo(() => parse(text, sep), [text, sep]);
  const missing = pairs.filter((p) => !p.back && type !== "cloze").length;

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="bulk">Plak je kaarten, één per regel</Label>
        <Textarea
          id="bulk"
          rows={10}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setDone(null);
          }}
          placeholder={"vraag - antwoord\nbegrip\tdefinitie (tab uit Excel)\nnog een vraag ; nog een antwoord"}
          className="font-mono text-[13px]"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label>Scheidingsteken</Label>
          <Select value={sep} onChange={(e) => setSep(e.target.value)}>
            {SEPARATORS.map((s) => (
              <option key={s.label} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Kaarttype</Label>
          <Select value={type} onChange={(e) => setType(e.target.value as CardType)}>
            {CARD_TYPES.map((t) => (
              <option key={t} value={t}>
                {CARD_TYPE_LABELS[t].label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Tags voor alle kaarten</Label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="bv. hoofdstuk-3, ir"
            className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          />
        </div>
      </div>

      {pairs.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <div className="flex justify-between bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-900">
            <span>Voorbeeld: {pairs.length} kaarten</span>
            {missing > 0 && <span className="text-amber-600">{missing} zonder antwoord</span>}
          </div>
          <div className="max-h-64 divide-y divide-zinc-100 overflow-y-auto text-sm dark:divide-zinc-800">
            {pairs.slice(0, 200).map((p, i) => (
              <div key={i} className="grid grid-cols-2 gap-4 px-3 py-1.5">
                <span className="truncate">{p.front}</span>
                <span className={p.back ? "truncate text-zinc-600 dark:text-zinc-400" : "italic text-amber-600"}>{p.back || "geen antwoord"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {done !== null && <p className="text-sm text-emerald-600">{done} kaarten toegevoegd.</p>}

      <Button
        disabled={pending || pairs.length === 0}
        onClick={() =>
          start(async () => {
            setError(null);
            const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
            const r = await bulkCreateCardsAction(pairs.map((p) => ({ ...p, deckId, type, tags: tagList })));
            if (!r.ok) return setError(r.error);
            setDone(r.data.length);
            setText("");
            onDone?.(r.data.length);
          })
        }
      >
        {pairs.length ? `${pairs.length} kaarten toevoegen` : "Kaarten toevoegen"}
      </Button>
    </div>
  );
}
