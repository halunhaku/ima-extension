export interface ImaCredentials {
  clientId: string;
  apiKey: string;
}

export interface ImaKnowledgeBaseOption {
  id: string;
  name: string;
}

interface ImaApiResponse<T> {
  code: number;
  msg?: string;
  data?: T;
}

type FetchLike = typeof fetch;

const IMA_BASE_URL = "https://ima.qq.com";

async function postImaOpenApi<T>(
  path: string,
  body: unknown,
  credentials: ImaCredentials,
  fetchImpl: FetchLike = fetch
): Promise<T> {
  const apiPath = path.replace(/^\/+/, "");
  const response = await fetchImpl(`${IMA_BASE_URL}/${apiPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ima-openapi-apikey": credentials.apiKey,
      "ima-openapi-clientid": credentials.clientId
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`ima request failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as ImaApiResponse<T>;
  if (payload.code !== 0) {
    throw new Error(payload.msg || `ima request failed with code ${payload.code}.`);
  }

  return payload.data as T;
}

export async function importImaMarkdownNote(
  markdown: string,
  credentials: ImaCredentials,
  fetchImpl?: FetchLike
): Promise<{ noteId: string }> {
  const data = await postImaOpenApi<{ note_id: string }>(
    "openapi/note/v1/import_doc",
    {
      content_format: 1,
      content: markdown
    },
    credentials,
    fetchImpl
  );

  return { noteId: data.note_id };
}

export async function addNoteToKnowledgeBase(
  params: {
    noteId: string;
    knowledgeBaseId: string;
    title: string;
  },
  credentials: ImaCredentials,
  fetchImpl?: FetchLike
): Promise<{ mediaId: string }> {
  const data = await postImaOpenApi<{ media_id: string }>(
    "openapi/wiki/v1/add_knowledge",
    {
      media_type: 11,
      note_info: { content_id: params.noteId },
      knowledge_base_id: params.knowledgeBaseId,
      title: params.title
    },
    credentials,
    fetchImpl
  );

  return { mediaId: data.media_id };
}

export async function listAddableKnowledgeBases(
  credentials: ImaCredentials,
  fetchImpl?: FetchLike
): Promise<ImaKnowledgeBaseOption[]> {
  const data = await postImaOpenApi<{
    addable_knowledge_base_list?: ImaKnowledgeBaseOption[];
  }>(
    "openapi/wiki/v1/get_addable_knowledge_base_list",
    {
      cursor: "",
      limit: 20
    },
    credentials,
    fetchImpl
  );

  return data.addable_knowledge_base_list ?? [];
}
