import { isPortalEnabled } from "@/lib/availability";
import { PortalUnavailable } from "@/components/portal-unavailable";

export const dynamic = "force-dynamic";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return isPortalEnabled() ? children : <PortalUnavailable />;
}
