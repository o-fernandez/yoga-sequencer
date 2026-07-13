"use client";

import { formatMinutes } from "@/lib/format";
import type {
  AuditAction,
  AuditSeverity,
  SequenceAuditReport,
} from "@/lib/sequence-audit";

const AUDIT_SEVERITY_STYLES: Record<AuditSeverity, {
  dot: string;
  label: string;
  panel: string;
  text: string;
}> = {
  critical: {
    dot: "bg-rose-400/70",
    label: "worth a look",
    panel: "border-rose-200/50 bg-rose-50/40",
    text: "text-rose-700/80",
  },
  warning: {
    dot: "bg-amber-400/70",
    label: "consider",
    panel: "border-amber-200/50 bg-amber-50/40",
    text: "text-amber-700/80",
  },
  note: {
    dot: "bg-stone-400/70",
    label: "note",
    panel: "border-stone-200/70 bg-stone-50/60",
    text: "text-stone-500",
  },
  good: {
    dot: "bg-emerald-400/60",
    label: "nice",
    panel: "border-emerald-200/50 bg-emerald-50/40",
    text: "text-emerald-700/80",
  },
};

export function SequenceAuditPanel({
  report,
  onAction,
}: {
  report: SequenceAuditReport;
  onAction: (action: AuditAction) => void;
}) {
  return (
    <section className="mb-5 rounded-2xl border border-stone-200 bg-white/80 p-4 ring-1 ring-stone-200/60">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <p className="font-display text-lg text-stone-700">Reading the flow</p>
        <p className="text-xs text-stone-400">
          {report.summary}
          <span className="ml-2 tabular-nums text-stone-300">{report.score}/100</span>
        </p>
      </div>

      <p className="mb-3 text-xs text-stone-400">
        {formatMinutes(report.totalMinutes)} total
        <span className="text-stone-300"> · </span>
        {formatMinutes(report.standingMinutes)} standing
        <span className="text-stone-300"> · </span>
        {formatMinutes(report.windDownMinutes)} wind-down
      </p>

      <div className="space-y-2">
        {report.issues.map((issue) => {
          const styles = AUDIT_SEVERITY_STYLES[issue.severity];
          return (
            <article
              key={issue.id}
              className={`rounded-xl border px-3.5 py-3 ${styles.panel}`}
            >
              <div className="flex items-start gap-3">
                <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${styles.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="text-sm font-medium text-stone-800">{issue.title}</p>
                    <span className={`text-[11px] italic ${styles.text}`}>
                      {styles.label} · {issue.category.toLowerCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-stone-600">{issue.detail}</p>
                </div>
                {issue.action && (
                  <button
                    type="button"
                    onClick={() => onAction(issue.action!)}
                    className="shrink-0 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50"
                  >
                    {issue.action.label}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
