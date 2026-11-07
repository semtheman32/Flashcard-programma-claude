"use client";

import { useEffect, useState, useTransition } from "react";
import { updateSettingsAction } from "@/app/actions";
import { applyTheme, readTheme, type Theme } from "@/components/theme-toggle";
import { Button, Input, Label, Panel, Select } from "@/components/ui";
import type { Settings } from "@/server/settings";

export function SettingsClient({ settings }: { settings: Settings }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [s, setS] = useState(settings);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => setTheme(readTheme()), []);

  return (
    <div className="max-w-2xl space-y-6">
      <Panel className="p-5">
        <h2 className="mb-4 font-medium">Weergave</h2>
        <Label htmlFor="theme">Thema</Label>
        <Select
          id="theme"
          value={theme}
          onChange={(e) => {
            const t = e.target.value as Theme;
            setTheme(t);
            applyTheme(t);
          }}
          className="sm:w-60"
        >
          <option value="system">Systeem</option>
          <option value="light">Licht</option>
          <option value="dark">Donker</option>
        </Select>
      </Panel>

      <Panel className="p-5">
        <h2 className="mb-4 font-medium">Studeren</h2>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await updateSettingsAction(s);
              setSaved(r.ok ? "Opgeslagen." : `Fout: ${r.error}`);
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="new">Nieuwe kaarten per dag (herhalen)</Label>
              <Input id="new" type="number" min={0} max={1000} value={s.newCardsPerDay} onChange={(e) => setS({ ...s, newCardsPerDay: Number(e.target.value) })} />
              <p className="mt-1 text-xs text-zinc-500">Voor een tentamen binnenkort mag dit hoog, bv. 100.</p>
            </div>
            <div>
              <Label htmlFor="max">Max. kaarten per herhaalsessie</Label>
              <Input id="max" type="number" min={1} max={2000} value={s.maxReviewsPerSession} onChange={(e) => setS({ ...s, maxReviewsPerSession: Number(e.target.value) })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s.allowTypos} onChange={(e) => setS({ ...s, allowTypos: e.target.checked })} />
            Kleine typfouten goedrekenen in Leren
          </label>
          <div className="flex items-center gap-3">
            <Button disabled={pending}>Opslaan</Button>
            {saved && <span className="text-sm text-zinc-500">{saved}</span>}
          </div>
        </form>
      </Panel>

      <Panel className="p-5 text-sm text-zinc-600 dark:text-zinc-400">
        <h2 className="mb-2 font-medium text-zinc-900 dark:text-zinc-100">Gegevens</h2>
        <p>
          Alles staat lokaal in <code className="text-xs">prisma/dev.db</code> (SQLite). Maak een back-up door dat bestand te kopiëren, of exporteer decks als JSON
          vanaf de deckpagina. Claude Code beheert de inhoud via <code className="text-xs">npm run agent</code> (zie <code className="text-xs">agent/README.md</code>).
        </p>
      </Panel>
    </div>
  );
}
