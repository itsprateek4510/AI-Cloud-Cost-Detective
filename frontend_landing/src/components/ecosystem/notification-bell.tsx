"use client";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/lib/api";

type Notification = {
  id: string;
  type: string;
  payload: { recording_id?: string; conversation_id?: string };
  read_at: string | null;
};
export function NotificationBell() {
  const client = useQueryClient();
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => request<Notification[]>("/v1/notifications"),
  });
  const read = useMutation({
    mutationFn: (id: string) => request(`/v1/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const unread = notifications.data?.filter((n) => !n.read_at).length ?? 0;
  return (
    <details className="eco-notifications">
      <summary aria-label={`Notifications, ${unread} unread`}>
        <Bell size={18} />
        {unread > 0 && <span>{unread}</span>}
      </summary>
      <div className="eco-card">
        {notifications.error ? (
          <p role="alert">Could not load notifications.</p>
        ) : notifications.data?.length ? (
          notifications.data.slice(0, 10).map((n) => (
            <Link
              key={n.id}
              onClick={() => read.mutate(n.id)}
              href={
                n.payload.recording_id
                  ? `/app/recordings/${n.payload.recording_id}`
                  : n.payload.conversation_id
                    ? `/app/shared/conversation/${n.payload.conversation_id}`
                    : "/app/prompts"
              }
            >
              {n.type === "recording_ready"
                ? "Your recording and memory suggestions are ready."
                : n.type === "mention"
                  ? "Someone mentioned you in a conversation."
                  : "A new question is waiting, whenever you’re ready."}
              {!n.read_at && " · New"}
            </Link>
          ))
        ) : (
          <p>No notifications yet.</p>
        )}
      </div>
    </details>
  );
}
