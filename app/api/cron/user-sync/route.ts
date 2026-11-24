import { isScheduledRequest, syncOutcomeResponse } from "@/lib/sync/sync-run";
import { syncUsers } from "@/lib/users/user-sync";

// Called by whatever runs the schedule (cron, Task Scheduler, App Service…):
// curl -X POST -H "Authorization: Bearer $CRON_SECRET" <app>/api/cron/user-sync
export async function POST(request: Request) {
  if (!isScheduledRequest(request)) {
    return new Response("Unauthorized.", { status: 401 });
  }
  return syncOutcomeResponse(await syncUsers());
}
