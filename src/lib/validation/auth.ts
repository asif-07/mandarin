import { z } from "zod";

export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter your username")
    .regex(/^[a-z0-9._-]+$/, "Username can only contain letters, numbers, dots and dashes"),
  password: z.string().min(1, "Enter your password"),
});

export type LoginInput = z.infer<typeof loginSchema>;
