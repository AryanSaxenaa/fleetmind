import { getGeotabCredentials } from "@/lib/geotab";

interface AceMessageGroup {
  messages?: Record<string, any>;
  status?: { status: string; code?: number; message?: string };
}

interface AceCallResult {
  message_group?: AceMessageGroup;
  chat_id?: string;
  apiResult?: { results?: any[]; errors?: any[] };
  errors?: any[];
}

export interface AceResponse {
  answer: string;
  preview?: any[];
  signedUrls?: string[];
  raw?: any;
}

async function callAce(functionName: string, functionParameters: Record<string, any>) {
  const { credentials, server } = await getGeotabCredentials();
  const res = await fetch(`https://${server}/apiv1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "GetAceResults",
      params: {
        serviceName: "dna-planet-orchestration",
        functionName,
        customerData: true,
        functionParameters,
        credentials: {
          database: credentials.database,
          userName: credentials.userName,
          sessionId: credentials.sessionId,
        },
      },
    }),
  });

  const data = (await res.json()) as { result?: AceCallResult; error?: any };
  if (data.error) throw new Error(data.error?.message || "Ace API error");
  return data.result as AceCallResult;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function queryAce(prompt: string): Promise<AceResponse> {
  // 1) create chat
  const chatResp = await callAce("create-chat", {});
  const chatId = chatResp?.apiResult?.results?.[0]?.chat_id;
  if (!chatId) {
    return { answer: "Ace create-chat failed: no chat_id returned", raw: chatResp };
  }

  // 2) send prompt
  const sendResp = await callAce("send-prompt", { chat_id: chatId, prompt });
  const messageGroupId = sendResp?.apiResult?.results?.[0]?.message_group?.id;
  if (!messageGroupId) {
    return { answer: "Ace send-prompt failed: no message_group id returned", raw: sendResp };
  }

  // 3) poll get-message-group until DONE or failure
  let answer = "Processing...";
  let preview: any[] | undefined;
  let signedUrls: string[] | undefined;
  const maxPolls = 15;
  for (let i = 0; i < maxPolls; i++) {
    await sleep(1000);
    const mgResp = await callAce("get-message-group", {
      chat_id: chatId,
      message_group_id: messageGroupId,
    });
    const mg = mgResp?.apiResult?.results?.[0]?.message_group as AceMessageGroup | undefined;
    if (!mg) continue;

    const status = mg.status?.status;
    const messages = mg.messages || {};
    const sorted = Object.values(messages).sort(
      (a: any, b: any) => (a.creation_date_unix_milli || 0) - (b.creation_date_unix_milli || 0)
    );

    const assistant = sorted.find((m: any) => m.type === "AssistantMessage");
    const dataRef = sorted.find((m: any) => m.type === "UserDataReference");

    if (assistant?.content) {
      answer = assistant.content;
    }
    if (dataRef) {
      answer = dataRef.reasoning || dataRef.output || answer;
      preview = dataRef.preview_array;
      signedUrls = dataRef.signed_urls;
    }

    if (status === "DONE") {
      return { answer, preview, signedUrls, raw: mgResp };
    }
    if (status === "FAILED") {
      return { answer: mg.status?.message || "Ace message failed", raw: mgResp };
    }
  }

  return { answer: answer || "Ace timed out without a response", preview, signedUrls };
}
