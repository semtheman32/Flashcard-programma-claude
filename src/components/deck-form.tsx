"use client";

import { useState, useTransition } from "react";
import { createDeckAction, updateDeckAction } from "@/app/actions";
import type { DeckSummary } from "@/server/mappers";
import { cn } from "@/lib/cn";
import { DECK_COLORS } from "./colors";
import { Button, Input, Label, Select, Textarea } from "./ui";

export function DeckForm({
  deck,
  subjects,
  defaultSubjectId,
  onSaved,
  onCancel,
}: {
  deck?: DeckSummary;
  subjects: { id: string; name: string }[];
  defaultSubjectId?: string;
  onSaved: (deck: DeckSummary) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(deck?.name ?? "");
  const [description, setDescription] = useState(deck?.description ?? "");
  const [subjectId, setSubjectId] = useState(deck?.subjectId ?? defaultSubjectId ?? "");
  const [newSubject, setNewSubject] = useState("");
  const [color, setColor] = useState(deck?.color ?? DECK_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const data = {
            name,
            description: description || null,
            color,
            ...(subjectId === "__new" ? { subjectName: newSubject } : { subjectId: subjectId || null }),
          };
          const r = deck ? await updateDeckAction(deck.id, data) : await createDeckAction(data);
          if (!r.ok) return setError(r.error);
          onSaved(r.data);
        });
      }}
    >
      <div>
        <Label htmlFor="deck-name">Naam</Label>
        <Input id="deck-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="bv. IR-spectroscopie" autoFocus required />
      </div>
      <div>
        <Label htmlFor="deck-desc">Beschrijving</Label>
        <Textarea id="deck-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="deck-subject">Vak</Label>
          <Select id="deck-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">Geen vak</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value="__new">+ Nieuw vak…</option>
          </Select>
        </div>
        {subjectId === "__new" && (
          <div>
            <Label htmlFor="deck-newsubject">Naam nieuw vak</Label>
            <Input id="deck-newsubject" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} required />
          </div>
        )}
      </div>
      <div>
        <Label>Kleur</Label>
        <div className="flex gap-2">
          {DECK_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setColor(c)}
              aria-label={`Kleur ${c}`}
              className={cn("h-7 w-7 rounded-full ring-offset-2 dark:ring-offset-zinc-900", color === c && "ring-2 ring-zinc-400")}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button disabled={pending || !name.trim()}>{deck ? "Opslaan" : "Deck aanmaken"}</Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Annuleren
          </Button>
        )}
      </div>
    </form>
  );
}
