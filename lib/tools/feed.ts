import { geotabGetFeed } from "@/lib/geotab";

export interface FeedResult<T> {
  data: T[];
  toVersion?: string;
}

export async function getExceptionFeed(fromVersion?: string): Promise<FeedResult<any>> {
  const result = await geotabGetFeed<any>("ExceptionEvent", fromVersion, {}, 500);
  return { data: result.data || result || [], toVersion: result.toVersion };
}

export async function getDeviceStatusFeed(fromVersion?: string): Promise<FeedResult<any>> {
  const result = await geotabGetFeed<any>("DeviceStatusInfo", fromVersion, {}, 500);
  return { data: result.data || result || [], toVersion: result.toVersion };
}
