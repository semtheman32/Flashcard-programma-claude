"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { FolderTree, Pencil, Trash2 } from "lucide-react";
import { createSubjectAction, deleteSubjectAction, updateSubjectAction } from "@/app/actions";
import { Button, EmptyState, Input, Panel, Progress } from "@/components/ui";
import { DECK_COLORS } from "@/components/colors";
import { cn } from "@/lib/cn";

type Subject = { id: string; name: string; description: string | null; color: string; deckCount: number; cardCount: number; progress: number };

export function SubjectsClient({ subjects }: { subjects: Subject[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [color, setColor] = useState(DECK_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Fout");
      else {
        setError(null);
        router.refresh();
      }
    });

  return (
    <div className="space-y-6">
      <Panel className="p-5">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            run(async () => {
              const r = await createSubjectAction({ name, color });
              if (r.ok) setName("");
              return r;
            });
          }}
        >
          <Input placeholder="Nieuw vak, bv. Organische chemie" value={name} onChange={(e) => setName(e.target.value)} className="sm:max-w-sm" />
          <div className="flex gap-1.5">
            {DECK_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                aria-label={`Kleur ${c}`}
                className={cn("h-6 w-6 rounded-full ring-offset-2 dark:ring-offset-zinc-900", color === c && "ring-2 ring-zinc-400")}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <Button disabled={pending || !name.trim()}>Vak toevoegen</Button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </Panel>

      {subjects.length === 0 ? (
        <EmptyState icon={<FolderTree size={28} />} title="Nog geen vakken" description="Vakken groeperen je decks, zodat je per vak je voortgang ziet." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s) => (
            <Panel key={s.id} className="p-5">
              <div className="flex items-start justify-between gap-2">
                {editing === s.id ? (
                  <form
                    className="flex flex-1 gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(async () => {
                        const r = await updateSubjectAction(s.id, { name: editName });
                        if (r.ok) setEditing(null);
                        return r;
                      });
                    }}
                  >
                    <Input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} />
                    <Button size="sm">Opslaan</Button>
                  </form>
                ) : (
                  <Link href={`/library?subject=${s.id}`} className="flex items-center gap-2 font-medium hover:underline">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.name}
                  </Link>
                )}
                {editing !== s.id && (
                  <div className="flex">
                    <Button variant="ghost" size="sm" aria-label="Hernoemen" onClick={() => { setEditing(s.id); setEditName(s.name); }}>
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Verwijderen"
                      onClick={() => {
                        if (confirm(`Vak "${s.name}" verwijderen? De decks blijven bestaan, zonder vak.`)) run(() => deleteSubjectAction(s.id));
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )}
              </div>
              <p className="mt-2 text-sm text-zinc-500">
                {s.deckCount} decks · {s.cardCount} kaarten
              </p>
              <div className="mt-4 flex items-center gap-3">
                <Progress value={s.progress} color={s.color} />
                <span className="text-xs tabular-nums text-zinc-500">{s.progress}%</span>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
