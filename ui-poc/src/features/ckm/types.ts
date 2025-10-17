export type CkmWorkspaceSummary = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  defaultRole: string;
  isPrivate: boolean;
  roomCount: number;
  memberCount: number;
};

export type CkmChatRoomSummary = {
  id: string;
  title: string;
  topic?: string | null;
  roomType: string;
  isPrivate: boolean;
  memberCount: number;
};

export type CkmWorkspaceDetail = CkmWorkspaceSummary & {
  rooms: CkmChatRoomSummary[];
};

export type CkmMessage = {
  id: string;
  roomId: string;
  threadId?: string | null;
  parentMessageId?: string | null;
  authorId: string;
  messageType: string;
  priority: number;
  body: string;
  bodyRich?: string | null;
  mentions?: string[] | null;
  metadataJson?: string | null;
  postedAt: string;
  deletedAt?: string | null;
};

export type PostMessageInput = {
  workspaceCode: string;
  roomId: string;
  body: string;
  threadId?: string;
  parentMessageId?: string;
  messageType?: string;
  priority?: number;
  mentions?: string[];
  metadataJson?: string;
};
