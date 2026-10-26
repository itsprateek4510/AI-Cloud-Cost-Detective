import { BookStudio } from "@/components/ecosystem/legacy/book-studio";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BookStudio id={id} />;
}
