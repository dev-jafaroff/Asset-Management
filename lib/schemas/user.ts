import { z } from "zod";

// A person's record id, e.g. bound to an action on their page.
export const userIdSchema = z.number().int().positive();
