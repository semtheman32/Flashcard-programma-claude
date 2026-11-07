"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Eye, Pencil, X } from "lucide-react";
import { createCardAction, updateCardAction } from "@/app/actions";
import { CARD_TYPES, CARD_TYPE_LABELS, clozeAnswers, studyPair, type CardType } from "@/lib/cards";
import type { CardDTO } from "@/server/mappers";
import { Button, Input, Kbd, Label, Select, Textarea } from "./ui";
import { CardFace } from "./card-face";

interface Props {
  deckId: string;
  card?: CardDTO;
  /** Remember the last used type between quick-adds. */
  defaultType?: CardType;
  onSaved?: (card: CardDTO, keepOpen: boolean) => void;
  onCancel?: () => void;
}

export function CardEditor({ deckId, card, defaultType = "term", onSaved, onCancel }: Props) {
  const [type, setType] = useState<CardType>((card?.type as CardType) ?? defaultType);
  const [front, setFront] = useState(card?.front ?? "");
  const [back, setBack] = useState(card?.back ?? "");
  const [description, setDescription] = useState(card?.description ?? "");
  const [hints, setHints] = useState((card?.hints ?? []).join("\n"));
  const [tags, setTags] = useState<string[]>(card?.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [difficulty, setDifficulty] = useState(card?.difficulty ?? 3);
  const [imageUrl, setImageUrl] = useState(card?.imageUrl ?? "");
  const [showMore, setShowMore] = useState(Boolean(card?.description || card?.hints.length || card?.imageUrl));
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const frontRef = useRef<HTMLTextAreaElement>(null);
  const labels = CARD_TYPE_LABELS[type];

  useEffect(() => frontRef.current?.focus(), []);

  const addTag = (raw: string) => {
    const t = raw.trim().toLowerCase().replace(/,$/, "");
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagDraft("");
  };

  const save = (keepOpen: boolean) => {
    setError(null);
    if (type === "cloze" && clozeAnswers(front).length === 0) {
      setError("Een cloze-kaart heeft minstens één {{woord}} tussen dubbele accolades nodig.");
      return;
    }
    const data = {
      type,
      front,
      back,
      description: description || null,
      hints: hints.split("\n").map((h) => h.trim()).filter(Boolean),
      tags: tagDraft.trim() ? [...tags, tagDraft.trim().toLowerCase()] : tags,
      difficulty,
      imageUrl: imageUrl || null,
    };
    start(async () => {
      const r = card ? await updateCardAction(card.id, data) : await createCardAction({ ...data, deckId });
      if (!r.ok) return setError(r.error);
      if (keepOpen && !card) {
        setFront("");
        setBack("");
        setDescription("");
        setHints("");
        setImageUrl("");
        setTagDraft("");
        frontRef.current?.focus();
      }
      onSaved?.(r.data, keepOpen);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      save(!card);
    } else if (e.key === "Escape" && onCancel) {
      e.preventDefault();
      onCancel();
    }
  };

  const pair = studyPair({ type, front, back });

  return (
    <div onKeyDown={onKeyDown} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={type} onChange={(e) => setType(e.target.value as CardType)} className="w-auto" aria-label="Kaarttype">
          {CARD_TYPES.map((t) => (
            <option key={t} value={t}>
              {CARD_TYPE_LABELS[t].label}
            </option>
          ))}
        </Select>
        <Button type="button" variant="ghost" size="sm" onClick={() => setPreview(!preview)}>
          {preview ? <Pencil size={14} /> : <Eye size={14} />} {preview ? "Bewerken" : "Voorbeeld"}
        </Button>
      </div>

      {preview ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <CardFace label="Voorkant" text={pair.prompt || "—"} imageUrl={imageUrl || undefined} small />
          <CardFace label="Achterkant" text={pair.answer || "—"} extra={pair.extra ?? (description || undefined)} small />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="front">{labels.front}</Label>
            <Textarea id="front" ref={frontRef} value={front} onChange={(e) => setFront(e.target.value)} rows={3} placeholder={type === "cloze" ? "De C=O-strekking ligt rond {{1700}} cm⁻¹" : ""} />
          </div>
          <div>
            <Label htmlFor="back">{labels.back}</Label>
            <Textarea id="back" value={back} onChange={(e) => setBack(e.target.value)} rows={3} />
          </div>
        </div>
      )}

      <div>
        <Label>Tags</Label>
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-950">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
              {t}
              <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Tag ${t} verwijderen`}>
                <X size={12} />
              </button>
            </span>
          ))}
          <input
            value={tagDraft}
            onChange={(e) => (e.target.value.endsWith(",") ? addTag(e.target.value) : setTagDraft(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && tagDraft.trim()) {
                e.preventDefault();
                addTag(tagDraft);
              } else if (e.key === "Backspace" && !tagDraft && tags.length) setTags(tags.slice(0, -1));
            }}
            placeholder={tags.length ? "" : "Typ een tag en druk op Enter"}
            className="min-w-24 flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-zinc-400"
          />
        </div>
      </div>

      {showMore ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="desc">Toelichting (zichtbaar na omdraaien)</Label>
            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div>
            <Label htmlFor="hints">Hints (één per regel)</Label>
            <Textarea id="hints" value={hints} onChange={(e) => setHints(e.target.value)} rows={2} />
          </div>
          <div>
            <Label htmlFor="img">Afbeelding-URL (optioneel)</Label>
            <Input id="img" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://… of /images/…" />
          </div>
          <div>
            <Label htmlFor="diff">Moeilijkheid</Label>
            <Select id="diff" value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>
                  {d} {d === 1 ? "(makkelijk)" : d === 5 ? "(moeilijk)" : ""}
                </option>
              ))}
            </Select>
          </div>
        </div>
      ) : (
        <button type="button" className="text-sm text-accent hover:underline" onClick={() => setShowMore(true)}>
          + Toelichting, hints, afbeelding en moeilijkheid
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-zinc-500">
          <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd> {card ? "opslaan" : "opslaan en volgende"}
          {onCancel && <> · <Kbd>Esc</Kbd> annuleren</>}
        </span>
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="secondary" onClick={onCancel}>
              Annuleren
            </Button>
          )}
          {!card && (
            <Button type="button" variant="secondary" disabled={pending || !front.trim()} onClick={() => save(false)}>
              Opslaan
            </Button>
          )}
          <Button type="button" disabled={pending || !front.trim()} onClick={() => save(!card)}>
            {card ? "Opslaan" : "Opslaan en volgende"}
          </Button>
        </div>
      </div>
    </div>
  );
}
