import ServerPanel from "@/components/ServerPanel";

export const metadata = {
  title: "Jadi Server — Artier Connect",
};

export default function ServerPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <ServerPanel />
    </div>
  );
}
