type Person = { id: string; birth_year?: number | null };
type Edge = {
  from_person_id: string;
  to_person_id: string;
  type: string;
  status: string;
  kinship_label?: string | null;
};
export function kinshipLabel(
  viewer: Person | undefined,
  target: Person,
  graph: { persons: Person[]; relationships: Edge[] },
): string {
  if (!viewer) return "Family";
  if (viewer.id === target.id) return "You";
  const edges = graph.relationships.filter((e) => e.status === "confirmed");
  const gender = (id: string) =>
    edges.find(
      (e) => e.from_person_id === id && ["Mother", "Father"].includes(e.kinship_label ?? ""),
    )?.kinship_label;
  const parents = (id: string) =>
    edges.filter((e) => e.type === "parent_of" && e.to_person_id === id);
  const sibling = () => {
    const g = gender(target.id);
    if (!g) return "Sibling";
    const older = !!(
      target.birth_year &&
      viewer.birth_year &&
      target.birth_year < viewer.birth_year
    );
    return g === "Mother" ? (older ? "Didi" : "Sister") : older ? "Bhaiya" : "Brother";
  };
  const direct = edges.find(
    (e) =>
      [e.from_person_id, e.to_person_id].includes(viewer.id) &&
      [e.from_person_id, e.to_person_id].includes(target.id),
  );
  if (direct) {
    if (direct.type === "parent_of")
      return direct.from_person_id === target.id ? (gender(target.id) ?? "Parent") : "Child";
    if (direct.type === "sibling_of") return sibling();
    return (
      (
        {
          spouse_of: "Spouse",
          sibling_of: "Sibling",
          grandparent_of: direct.from_person_id === target.id ? "Grandparent" : "Grandchild",
          aunt_uncle_of: direct.from_person_id === target.id ? "Uncle/Aunt" : "Niece/Nephew",
          cousin_of: "Cousin",
        } as Record<string, string>
      )[direct.type] ?? "Relative"
    );
  }
  if (
    parents(viewer.id).some((p) =>
      parents(target.id).some((t) => t.from_person_id === p.from_person_id),
    )
  )
    return sibling();
  for (const parent of parents(viewer.id)) {
    const maternal = gender(parent.from_person_id) === "Mother";
    const paternal = gender(parent.from_person_id) === "Father";
    if (parents(parent.from_person_id).some((e) => e.from_person_id === target.id)) {
      const g = gender(target.id);
      if (maternal && g) return g === "Mother" ? "Nani" : "Nana";
      if (paternal && g) return g === "Mother" ? "Dadi" : "Dada";
      return "Grandparent";
    }
    if (
      edges.some(
        (e) =>
          e.type === "sibling_of" &&
          [e.from_person_id, e.to_person_id].includes(parent.from_person_id) &&
          [e.from_person_id, e.to_person_id].includes(target.id),
      )
    ) {
      const g = gender(target.id);
      if (maternal && g) return g === "Mother" ? "Mausi" : "Mama";
      if (paternal && g) return g === "Mother" ? "Bua" : "Chacha";
      return "Uncle/Aunt";
    }
  }
  return "Relative";
}
