import { z } from "zod";

const email = z.email("ایمیل را کامل بنویس، مثل name@example.com");

const password = z
  .string()
  .min(8, "رمز باید دست‌کم ۸ نویسه باشد")
  .max(72, "رمز طولانی‌تر از حد مجاز است");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "رمز را وارد کن"),
});

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, "نامت را بنویس").max(80),
  email,
  password,
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({ password });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
