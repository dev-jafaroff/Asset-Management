import { syncIntune } from "@/lib/intune/intune-sync";
import { isScheduledRequest, syncOutcomeResponse } from "@/lib/sync/sync-run";

// Called by whatever runs the schedule (cron, Task Scheduler, App Service…),
// e.g. every hour:
// curl -X POST -H "Authorization: Bearer $CRON_SECRET" <app>/api/cron/intune-sync
export async function POST(request: Request) {
  if (!isScheduledRequest(request)) {
    return new Response("Unauthorized.", { status: 401 });
  }
  return syncOutcomeResponse(await syncIntune());
}
