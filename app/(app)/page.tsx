import { PageHeader } from "@/components/layout/page-header";

export default function HomePage() {
  return (
    <>
      <PageHeader title="Home" description="Overview of your IT assets." />

      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Dashboard widgets will appear here.
      </div>
    </>
  );
}
