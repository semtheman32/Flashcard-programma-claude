import { cn } from "@/lib/cn";

/** One side of a card, used in previews, flashcards and review. */
export function CardFace({
  label,
  text,
  extra,
  hint,
  imageUrl,
  small,
  className,
}: {
  label?: string;
  text: string;
  extra?: string;
  hint?: string;
  imageUrl?: string;
  small?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900",
        small ? "min-h-40" : "min-h-72 sm:p-10",
        className,
      )}
    >
      {label && <div className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-400">{label}</div>}
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="mb-4 max-h-48 max-w-full rounded-lg object-contain" />
      )}
      <div className={cn("card-text font-medium leading-relaxed", small ? "text-base" : "text-xl sm:text-2xl")}>{text}</div>
      {extra && <div className="card-text mt-4 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">{extra}</div>}
      {hint && <div className="mt-4 text-sm italic text-amber-600 dark:text-amber-400">Hint: {hint}</div>}
    </div>
  );
}
