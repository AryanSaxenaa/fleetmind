import { queryAce, AceResponse } from "@/lib/ace";

export type AceQueryResult = AceResponse;

export async function getAceInsight(prompt: string): Promise<AceQueryResult> {
  return queryAce(prompt);
}
