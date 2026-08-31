export type PersonaKey =
  | "linda_chambers"
  | "becca_rose"
  | "brooke_swift"
  | "claire_donovan"
  | "rebecca_lang";

export type PostStatus =
  | "pending"
  | "approved"
  | "denied"
  | "changes_requested";

export type PostType = "lifestyle" | "product";

export type Brand = "Montana Tallow" | "Lumerval";

export type InboxItem = {
  id: string;
  createdAt: string;
  updatedAt: string;
  persona: string;
  personaKey: PersonaKey;
  caption: string;
  comment: string;
  status: PostStatus;
  imageUrl: string;
  mediaId: string;
  postType: PostType;
  weekdayName: string;
  runDate: string;
  brand: Brand;
  reviewedByEmail?: string;
  reviewedAt?: string;
  reapprovalRequired?: boolean;
  source?: "seed" | "n8n";
};

export type IngestPayload = {
  persona: string;
  personaKey: PersonaKey;
  caption: string;
  imageUrl: string;
  mediaId: string;
  postType?: PostType;
  runDate?: string;
  weekdayName?: string;
};

export type ReviewAction = "approve" | "deny" | "changes_requested";

export type N8nWebhookBody = {
  action: ReviewAction;
  persona: string;
  personaKey: PersonaKey;
  caption: string;
  imageUrl: string;
  mediaId: string;
  comment: string;
  reviewedAt: string;
  reviewedByEmail?: string;
  postType: PostType;
  runDate: string;
  brand: Brand;
  id: string;
};
