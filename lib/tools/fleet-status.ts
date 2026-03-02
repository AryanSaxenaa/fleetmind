import { geotabMultiCall } from "@/lib/geotab";

export interface FleetStatusResult {
  active: number;
  stopped: number;
  idling: number;
  offline: number;
  total: number;
  timestamp: string;
}

export async function getFleetStatus(): Promise<FleetStatusResult> {
  const [devices, statuses] = await geotabMultiCall<any>([
    { method: "Get", params: { typeName: "Device", resultsLimit: 200 } },
    { method: "Get", params: { typeName: "DeviceStatusInfo", resultsLimit: 200 } },
  ]);

  const now = Date.now();
  const FIVE_MIN = 5 * 60 * 1000;
  const THIRTY_MIN = 30 * 60 * 1000;

  let active = 0,
    stopped = 0,
    idling = 0,
    offline = 0;

  for (const s of statuses) {
    const lastComm = new Date(s.dateTime).getTime();
    const age = now - lastComm;

    if (age > THIRTY_MIN || !s.isDeviceCommunicating) {
      offline++;
    } else if (s.speed > 0 && s.isDriving) {
      active++;
    } else if (s.isDriving && s.speed === 0) {
      idling++;
    } else {
      stopped++;
    }
  }

  return {
    active,
    stopped,
    idling,
    offline,
    total: devices.length,
    timestamp: new Date().toISOString(),
  };
}
