"use client";

import { Suspense } from "react";
import { AppFrame } from "@/components/AppFrame";
import { CheckInView } from "@/components/CheckInView";

export default function Page() {
  return (
    <AppFrame>
      <Suspense
        fallback={
          <main className="min-h-screen grid place-items-center">
            <p className="kicker">Choosing this week&apos;s questions</p>
          </main>
        }
      >
        <CheckInView />
      </Suspense>
    </AppFrame>
  );
}
