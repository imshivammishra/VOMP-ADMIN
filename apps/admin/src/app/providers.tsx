"use client";

import { SWRConfig } from "swr";
import { AuthProvider } from "@/lib/auth";
import { RealtimeProvider } from "@/lib/realtime";
import { ToastProvider } from "@/lib/toast";
import { fetcher } from "@/lib/api";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <RealtimeProvider>
          <SWRConfig
            value={{
              fetcher,
              revalidateOnFocus: false,
              dedupingInterval: 4000,
              keepPreviousData: true,
              shouldRetryOnError: false,
            }}
          >
            {children}
          </SWRConfig>
        </RealtimeProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
