import { Suspense } from "react";
import ClientPanel from "@/components/ClientPanel";

export const metadata = {
  title: "Jadi Client — Artier Connect",
};

export default function ClientPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <Suspense fallback={<p className="text-sm text-zinc-400">Memuat…</p>}>
        <ClientPanel />
      </Suspense>
    </div>
  );
}
