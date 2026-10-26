import { SharedItem } from "@/components/ecosystem/shared-item";
export default async function Page({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params;
  return <SharedItem type={type} id={id} />;
}
