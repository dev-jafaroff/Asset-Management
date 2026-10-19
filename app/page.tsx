import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Asset Management</h1>
      <p className="text-muted-foreground">The system is being set up.</p>
      <Button>Sign in</Button>
    </main>
  );
}
