import { apiRequest, graphqlRequest } from '@/lib/api-client';
import type { CkmWorkspaceDetail, CkmWorkspaceSummary, CkmMessage, PostMessageInput } from './types';

const DEFAULT_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001';

const WORKSPACE_SUMMARIES_QUERY = /* GraphQL */ `
  query CkmWorkspaceSummaries {
    ckmWorkspaces {
      id
      code
      name
      description
      defaultRole
      isPrivate
      roomCount
      memberCount
    }
  }
`;

const WORKSPACE_DETAIL_QUERY = /* GraphQL */ `
  query CkmWorkspaceDetail($code: String!) {
    ckmWorkspace(code: $code) {
      id
      code
      name
      description
      defaultRole
      isPrivate
      roomCount
      memberCount
      rooms {
        id
        title
        topic
        roomType
        isPrivate
        memberCount
      }
    }
  }
`;

const ROOM_MESSAGES_QUERY = /* GraphQL */ `
  query CkmRoomMessages($workspaceCode: String!, $roomId: String!, $keyword: String) {
    ckmMessageSearch(workspaceCode: $workspaceCode, roomId: $roomId, keyword: $keyword) {
      id
      roomId
      threadId
      parentMessageId
      authorId
      messageType
      priority
      body
      bodyRich
      mentions
      metadataJson
      postedAt
      deletedAt
    }
  }
`;

export async function listCkmWorkspaces(): Promise<CkmWorkspaceSummary[]> {
  const data = await graphqlRequest<{ ckmWorkspaces: CkmWorkspaceSummary[] }>({
    query: WORKSPACE_SUMMARIES_QUERY,
  });
  return data.ckmWorkspaces;
}

export async function getCkmWorkspaceDetail(code: string): Promise<CkmWorkspaceDetail> {
  const data = await graphqlRequest<{ ckmWorkspace: CkmWorkspaceDetail }>({
    query: WORKSPACE_DETAIL_QUERY,
    variables: { code },
  });
  return data.ckmWorkspace;
}

export async function getCkmRoomMessages(workspaceCode: string, roomId: string, keyword?: string): Promise<CkmMessage[]> {
  const data = await graphqlRequest<{
    ckmMessageSearch: CkmMessage[];
  }>({
    query: ROOM_MESSAGES_QUERY,
    variables: { workspaceCode, roomId, keyword },
  });
  return data.ckmMessageSearch;
}

export async function postCkmMessage(input: PostMessageInput): Promise<CkmMessage> {
  return apiRequest<CkmMessage>({
    path: '/api/v1/ckm/messages',
    method: 'POST',
    baseUrl: DEFAULT_BASE,
    body: JSON.stringify(input),
  });
}
