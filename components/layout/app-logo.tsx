import Image from "next/image";
import Link from "next/link";
import logo from "@/public/brand/logo.png";
import logoDark from "@/public/brand/logo-dark.png";
import { cn } from "@/lib/utils";

const LOGO_ALT = "Asset Management System";

// Logo linking home. Both images are rendered and CSS shows the one for the
// current theme, so there is no flash while the theme is resolved.
export function AppLogo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center", className)}>
      <Image
        src={logo}
        alt={LOGO_ALT}
        loading="eager"
        className="h-8 w-auto dark:hidden"
      />
      <Image
        src={logoDark}
        alt={LOGO_ALT}
        loading="eager"
        className="hidden h-8 w-auto dark:block"
      />
    </Link>
  );
}
