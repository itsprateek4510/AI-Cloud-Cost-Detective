import { MemoryDetail } from "@/components/ecosystem/memory-detail";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MemoryDetail id={id} />;
}
