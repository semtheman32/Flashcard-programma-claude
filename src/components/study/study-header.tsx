import Link from "next/link";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Progress } from "../ui";

export function StudyHeader({
  title,
  backHref,
  progress,
  label,
  right,
}: {
  title: string;
  backHref: string;
  progress: number;
  label: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={backHref} aria-label="Stoppen" className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
            <X size={18} />
          </Link>
          <h1 className="truncate font-medium">{title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-sm text-zinc-500">
          {right}
          <span className="tabular-nums">{label}</span>
        </div>
      </div>
      <Progress value={progress} />
    </div>
  );
}
