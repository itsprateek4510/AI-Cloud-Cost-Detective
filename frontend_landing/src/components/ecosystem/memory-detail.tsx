"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { request } from "@/lib/api";
import type { Memory } from "@/lib/domain";
import { Heading, ErrorState } from "./common";
import { MemoryCard } from "./memory-center";

export function MemoryDetail({ id }: { id: string }) {
  const memory = useQuery({
    queryKey: ["memories", "detail", id],
    queryFn: () => request<Memory>(`/v1/memories/${id}`),
  });
  return (
    <>
      <Link href="/app/memory">← Stories Smriti remembers</Link>
      <div style={{ marginTop: 24 }}>
        <Heading
          title="A memory, with its source"
          description="Only the sources included in your share level are shown."
        />
      </div>
      <ErrorState error={memory.error} />
      {memory.isPending && <p>Opening memory…</p>}
      {!memory.error && memory.data && <MemoryCard memory={memory.data} />}
    </>
  );
}
