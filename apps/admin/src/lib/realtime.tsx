"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";

export interface RealtimeEvent {
  type: string;
  payload: Record<string, unknown>;
  at: string;
  seq: number;
}

interface RealtimeValue {
  connected: boolean;
  lastEvent: RealtimeEvent | null;
  seq: number;
}

const RealtimeContext = createContext<RealtimeValue>({ connected: false, lastEvent: null, seq: 0 });

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [seq, setSeq] = useState(0);
  const seqRef = useRef(0);

  useEffect(() => {
    if (!user) return;
    let source: EventSource | null = null;
    try {
      source = new EventSource(`${API_BASE}/api/admin/stream`, { withCredentials: true });
    } catch {
      return;
    }

    source.addEventListener("ready", () => setConnected(true));
    source.addEventListener("ping", () => setConnected(true));
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);

    const types = [
      "enquiry:new",
      "enquiry:updated",
      "message:new",
      "thread:new",
      "thread:updated",
      "partner:new",
      "partner:updated",
      "venue:changed",
      "settings:changed",
      "media:changed",
    ];

    const handle = (type: string) => (event: MessageEvent) => {
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(event.data);
      } catch {
        payload = {};
      }
      seqRef.current += 1;
      setSeq(seqRef.current);
      setLastEvent({ type, payload, at: new Date().toISOString(), seq: seqRef.current });

      if (type === "enquiry:new") {
        const enquiry = payload.enquiry as { name?: string; city?: string; reference?: string } | undefined;
        toast("New enquiry received", {
          description: [enquiry?.name, enquiry?.city, enquiry?.reference].filter(Boolean).join(" · "),
          tone: "info",
        });
      }
      if (type === "message:new" && (payload as { direction?: string }).direction !== "admin") {
        const thread = payload.thread as { customerName?: string } | undefined;
        toast("New message", {
          description: thread?.customerName ? `From ${thread.customerName}` : "A visitor replied in live chat.",
          tone: "info",
        });
      }
      if (type === "thread:new") {
        const thread = payload.thread as { customerName?: string; city?: string } | undefined;
        toast("New conversation started", {
          description: [thread?.customerName, thread?.city].filter(Boolean).join(" · "),
          tone: "info",
        });
      }
      if (type === "partner:new") {
        const partner = payload as { venueName?: string; city?: string };
        toast("Partner application", {
          description: [partner.venueName, partner.city].filter(Boolean).join(" · "),
          tone: "info",
        });
      }
    };

    const listeners = types.map((type) => {
      const listener = handle(type);
      source?.addEventListener(type, listener as EventListener);
      return { type, listener };
    });

    return () => {
      for (const { type, listener } of listeners) {
        source?.removeEventListener(type, listener as EventListener);
      }
      source?.close();
      setConnected(false);
    };
  }, [user, toast]);

  const value = useMemo(() => ({ connected, lastEvent, seq }), [connected, lastEvent, seq]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
