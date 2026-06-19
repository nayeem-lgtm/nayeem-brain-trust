export const DEPARTMENTS = [
  { value: "bdm", label: "Business Dev", color: "var(--color-dept-bdm)" },
  { value: "affiliate", label: "Affiliate", color: "var(--color-dept-affiliate)" },
  { value: "operations", label: "Operations", color: "var(--color-dept-operations)" },
  { value: "ceo_support", label: "CEO Support", color: "var(--color-dept-ceo_support)" },
  { value: "compliance", label: "Compliance", color: "var(--color-dept-compliance)" },
  { value: "marketing", label: "Marketing", color: "var(--color-dept-marketing)" },
  { value: "finance", label: "Finance", color: "var(--color-dept-finance)" },
  { value: "personal", label: "Personal", color: "var(--color-dept-personal)" },
  { value: "other", label: "Other", color: "var(--color-dept-other)" },
] as const;

export type Department = (typeof DEPARTMENTS)[number]["value"];
export type Priority = "critical" | "high" | "medium" | "low";
export type TaskStatus = "pending" | "upcoming" | "ongoing" | "on_hold" | "completed" | "cancelled";
export type Recurrence = "none" | "daily" | "weekly" | "monthly";

export const STATUSES: { value: TaskStatus; label: string; className: string; dot: string }[] = [
  { value: "pending",   label: "Pending",   className: "text-muted-foreground border-border bg-muted/40",                dot: "bg-muted-foreground" },
  { value: "upcoming",  label: "Upcoming",  className: "text-accent border-accent/40 bg-accent/10",                       dot: "bg-accent" },
  { value: "ongoing",   label: "Ongoing",   className: "text-primary border-primary/40 bg-primary/10",                    dot: "bg-primary" },
  { value: "on_hold",   label: "On Hold",   className: "text-warning border-warning/40 bg-warning/10",                    dot: "bg-warning" },
  { value: "completed", label: "Completed", className: "text-success border-success/40 bg-success/10",                    dot: "bg-success" },
  { value: "cancelled", label: "Cancelled", className: "text-muted-foreground border-border bg-muted/30 line-through",    dot: "bg-muted-foreground" },
];

export const PRIORITIES: { value: Priority; label: string; className: string }[] = [
  { value: "critical", label: "Critical", className: "text-destructive border-destructive/40 bg-destructive/10" },
  { value: "high",     label: "High",     className: "text-warning border-warning/40 bg-warning/10" },
  { value: "medium",   label: "Medium",   className: "text-accent border-accent/40 bg-accent/10" },
  { value: "low",      label: "Low",      className: "text-muted-foreground border-border bg-muted/30" },
];

export const RECURRENCES: { value: Recurrence; label: string }[] = [
  { value: "none",    label: "Does not repeat" },
  { value: "daily",   label: "Daily" },
  { value: "weekly",  label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export function deptLabel(d: Department) {
  return DEPARTMENTS.find((x) => x.value === d)?.label ?? d;
}
export function deptColor(d: Department) {
  return DEPARTMENTS.find((x) => x.value === d)?.color ?? "var(--color-dept-other)";
}
export function statusMeta(s: TaskStatus) {
  return STATUSES.find((x) => x.value === s) ?? STATUSES[0];
}
