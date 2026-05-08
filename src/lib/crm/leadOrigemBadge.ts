export function leadOrigemBadge(origem: string | null | undefined) {
  const o = origem ?? "website";
  if (o === "website") return { label: "Site", className: "bg-sky-100 text-sky-900" };
  if (o === "prospeccao") return { label: "Prospeção", className: "bg-violet-100 text-violet-900" };
  return { label: o, className: "bg-brand-border/40 text-brand-midnight" };
}
