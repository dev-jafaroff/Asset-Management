import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const EXPORT_HINT = "Download as an Excel file";

// Downloads a list as it is shown: `href` is the list's export route with
// the list's params (tab, search, filters).
export function ExportButton({ href }: { href: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      nativeButton={false}
      // A plain link: the browser downloads the file and stays on the page.
      render={<a href={href} download title={EXPORT_HINT} />}
    >
      <Download aria-hidden />
      Export
    </Button>
  );
}

type ExportSelectedButtonProps = {
  // The export route, which takes the ids as a form.
  action: string;
  // Form field the ids go in, once per row.
  field: string;
  ids: number[];
};

// Downloads the selected rows. They are posted as a form, since a long
// selection would not fit in a link.
export function ExportSelectedButton({
  action,
  field,
  ids,
}: ExportSelectedButtonProps) {
  return (
    <form method="post" action={action} className="contents">
      {ids.map((id) => (
        <input key={id} type="hidden" name={field} value={id} />
      ))}
      <Button type="submit" variant="outline" size="sm" title={EXPORT_HINT}>
        <Download aria-hidden />
        Export
      </Button>
    </form>
  );
}
