import { z } from "zod";
import { graphGetAll, graphPostAction } from "@/lib/graph/client";

// Devices managed by Intune, read from Graph with the app's own token
// (DeviceManagementManagedDevices.Read.All, admin consent in each tenant).
// EIG and Waverity each have their own Intune.
//
// INTUNE_TENANT_IDS="<tenant id>,…" (GUIDs, as Entra shows them)

// The Intune tenants, and what is wrong with the setting, if anything.
export function getIntuneTenantIds(): {
  tenantIds: string[];
  errors: string[];
} {
  const entries = (process.env.INTUNE_TENANT_IDS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (entries.length === 0) {
    return { tenantIds: [], errors: ["INTUNE_TENANT_IDS is not set."] };
  }

  const tenantIds: string[] = [];
  const errors: string[] = [];
  entries.forEach((entry, index) => {
    if (z.uuid().safeParse(entry).success) tenantIds.push(entry);
    else errors.push(`INTUNE_TENANT_IDS entry ${index + 1} is not a GUID.`);
  });
  return { tenantIds, errors };
}

const deviceFields = [
  "id",
  "deviceName",
  "serialNumber",
  "operatingSystem",
  "osVersion",
  "manufacturer",
  "model",
  "userPrincipalName",
  "managedDeviceOwnerType",
  "enrolledDateTime",
  "lastSyncDateTime",
] as const;

// Graph sends "" (not null) for most fields it does not know.
const textSchema = z
  .string()
  .nullish()
  .transform((value) => value?.trim() || null);

const deviceSchema = z.object({
  id: z.string(),
  deviceName: textSchema,
  serialNumber: textSchema,
  // "Windows", "macOS", "iOS", "Android"…
  operatingSystem: textSchema,
  osVersion: textSchema,
  manufacturer: textSchema,
  model: textSchema,
  // The primary user; empty for shared devices.
  userPrincipalName: textSchema,
  // "company", "personal" or "unknown"
  managedDeviceOwnerType: textSchema,
  enrolledDateTime: z.coerce.date().nullish(),
  lastSyncDateTime: z.coerce.date().nullish(),
});

export type IntuneDevice = z.infer<typeof deviceSchema> & { tenantId: string };

// Every device of one tenant's Intune. Rows that do not parse are counted,
// not fatal.
export async function listIntuneDevices(
  tenantId: string,
): Promise<{ devices: IntuneDevice[]; invalid: number }> {
  const rows = await graphGetAll(
    tenantId,
    `/deviceManagement/managedDevices?$select=${deviceFields.join(",")}`,
  );
  const devices: IntuneDevice[] = [];
  let invalid = 0;
  for (const row of rows) {
    const device = deviceSchema.safeParse(row);
    if (device.success) devices.push({ ...device.data, tenantId });
    else invalid++;
  }
  return { devices, invalid };
}

// Asks the device to check in with Intune now, as "Sync" in the Intune admin
// center does (DeviceManagementManagedDevices.PrivilegedOperations.All). It
// does so when it is next online, usually within minutes.
export async function requestDeviceCheckIn(
  tenantId: string,
  deviceId: string,
): Promise<void> {
  await graphPostAction(
    tenantId,
    `/deviceManagement/managedDevices/${encodeURIComponent(deviceId)}/syncDevice`,
  );
}

// e.g. "PC-00049 (Windows, serial 5CD311KCYM, HP Pavilion)", for messages.
export function describeDevice(device: IntuneDevice): string {
  const details = [
    device.operatingSystem,
    device.serialNumber && `serial ${device.serialNumber}`,
    [device.manufacturer, device.model].filter(Boolean).join(" "),
  ].filter(Boolean);
  return `${device.deviceName ?? "A device"} (${details.join(", ")})`;
}
