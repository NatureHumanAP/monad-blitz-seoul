"use client";

import { ReactNode } from "react";
import { clsx } from "clsx";

type Props = {
  title: string;
  description?: string;
  disabled?: boolean;
  children: ReactNode;
  action?: ReactNode;
};

export function SectionCard({
  title,
  description,
  disabled,
  children,
  action,
}: Props) {
  return (
    <section
      className={clsx(
        "w-full rounded-2xl border border-zinc-200 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60",
        disabled && "opacity-60"
      )}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {title}
          </h2>
          {description ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
