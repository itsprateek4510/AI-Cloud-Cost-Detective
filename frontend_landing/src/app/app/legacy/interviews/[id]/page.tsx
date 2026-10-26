import { LegacyInterview } from "@/components/ecosystem/legacy/legacy-interviews";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LegacyInterview id={id} />;
}
