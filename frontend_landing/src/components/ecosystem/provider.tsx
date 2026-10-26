"use client";
import { createContext, useContext, useEffect, useState, useRef } from "react";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { me, request, type AuthUser } from "@/lib/api";
import type { Space, Family } from "@/lib/domain";

type State = {
  user: AuthUser;
  spaces: Space[];
  families: Family[];
  space: Space | undefined;
  setSpace: (id: string) => void;
  family: Family | undefined;
  setFamily: (id: string) => void;
};
const Context = createContext<State | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 10000, refetchOnWindowFocus: true } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <Session>{children}</Session>
    </QueryClientProvider>
  );
}

function Session({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const client = useQueryClient();
  const account = useQuery({ queryKey: ["me"], queryFn: me });
  const spaces = useQuery({
    queryKey: ["spaces"],
    queryFn: () => request<Space[]>("/v1/spaces"),
    enabled: !!account.data,
  });
  const families = useQuery({
    queryKey: ["families"],
    queryFn: () => request<Family[]>("/v1/families"),
    enabled: !!account.data,
  });
  const [selected, setSelected] = useState("");
  const [selectedFamily, setSelectedFamily] = useState("");
  const [workspaceOwner, setWorkspaceOwner] = useState("");
  const [accessEpoch, setAccessEpoch] = useState(0);
  const identity = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (account.data && identity.current && identity.current !== account.data.id) {
      client.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
      setSelected("");
      setSelectedFamily("");
      setAccessEpoch((epoch) => epoch + 1);
      void client.invalidateQueries();
    }
    identity.current = account.data?.id;
  }, [account.data, client]);
  useEffect(() => {
    const owner = account.data?.id;
    if (!owner) return;
    let restored: { spaceId?: string; familyId?: string } = {};
    try {
      restored = JSON.parse(localStorage.getItem(`smriti-workspace:${owner}`) ?? "{}");
    } catch {
      // A blocked or corrupt preference must never prevent opening the app.
    }
    setSelected(restored?.spaceId ?? "");
    setSelectedFamily(restored?.familyId ?? "");
    setWorkspaceOwner(owner);
  }, [account.data?.id]);
  useEffect(() => {
    if (account.isSuccess && !account.data) {
      client.clear();
      router.replace("/login");
    }
  }, [account.isSuccess, account.data, client, router]);
  useEffect(() => {
    if (!account.data) return;
    const events = new EventSource("/v1/events");
    let previousAccess: string | null = null;
    const refresh = (event?: Event) => {
      if (event instanceof MessageEvent) {
        const access = JSON.stringify(JSON.parse(event.data).access);
        if (previousAccess !== null && previousAccess !== access) {
          client.removeQueries({
            predicate: (q) => !["me", "spaces", "families"].includes(String(q.queryKey[0])),
          });
          setAccessEpoch((epoch) => epoch + 1);
          void client.invalidateQueries();
        }
        previousAccess = access;
      }
      void client.invalidateQueries({ queryKey: ["memories"] });
      void client.invalidateQueries({ queryKey: ["recordings"] });
      void client.invalidateQueries({ queryKey: ["notifications"] });
    };
    events.addEventListener("state.changed", refresh);
    events.onopen = refresh;
    return () => events.close();
  }, [account.data, client]);
  const error = account.error || spaces.error || families.error;
  if (error)
    return (
      <main id="main" className="eco-loading">
        <h1>Couldn’t open your space</h1>
        <p role="alert">{error.message}</p>
        <button onClick={() => void client.invalidateQueries()}>Try again</button>
      </main>
    );
  if (!account.data || !spaces.data || !families.data || workspaceOwner !== account.data.id)
    return (
      <main id="main" className="eco-loading" aria-busy="true">
        Opening your space…
      </main>
    );
  // Start in the private workspace. Adding or loading a family must never
  // silently switch what "Current space" means just because the list reordered.
  const defaultSpace = spaces.data.find((s) => s.type === "personal") ?? spaces.data[0];
  const space = spaces.data.find((s) => s.id === selected) ?? defaultSpace;
  const family =
    families.data.find((f) => f.id === selectedFamily) ??
    families.data.find((f) => f.id === space?.family_id) ??
    families.data[0];
  function saveWorkspace(spaceId: string, familyId: string) {
    setSelected(spaceId);
    setSelectedFamily(familyId);
    try {
      localStorage.setItem(
        `smriti-workspace:${account.data!.id}`,
        JSON.stringify({ spaceId, familyId }),
      );
    } catch {
      // Preferences are optional; in-memory navigation still works.
    }
  }
  return (
    <Context.Provider
      key={accessEpoch}
      value={{
        user: account.data,
        spaces: spaces.data,
        families: families.data,
        space,
        family,
        setFamily: (id) => {
          const target = spaces.data.find((s) => s.family_id === id && s.type === "family");
          if (target) saveWorkspace(target.id, id);
        },
        setSpace: (id) => {
          const target = spaces.data.find((s) => s.id === id);
          if (target) saveWorkspace(id, target.family_id ?? family?.id ?? "");
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("AppProvider required");
  return value;
}
