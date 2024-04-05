import { z } from "zod";

export const ChatMemberData = z.object({
  uuid: z.string(),
  wokaName: z.string().optional(),
  email: z.string().optional(),
  chatId: z.string().optional(),
});

export type ChatMemberData = z.infer<typeof ChatMemberData>;
