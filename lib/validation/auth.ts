import { z } from "zod";
import { faNumber } from "@/lib/format";

/**
 * The floor, in one place, because it was written out in six — the schema, two
 * error strings and the hint under three separate password fields — and a
 * number repeated six times is a number that goes stale in five of them.
 *
 * Twelve rather than eight: length is what actually resists guessing, far more
 * than the mixture of character classes people are usually nagged about. This
 * app holds someone's whole financial picture.
 *
 * It must be >= whatever Supabase enforces server-side, or the form accepts a
 * password the server then rejects and the user is told a length that is no
 * longer true. Stricter here than there is safe; looser is the bug.
 */
export const PASSWORD_MIN_LENGTH = 12;

/** Ready to drop into a sentence, with Persian digits like the rest of the UI. */
export const PASSWORD_MIN_LENGTH_FA = faNumber(PASSWORD_MIN_LENGTH);

const email = z.email("ایمیل را کامل بنویس، مثل name@example.com");

const password = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `رمز باید دست‌کم ${PASSWORD_MIN_LENGTH_FA} نویسه باشد`,
  )
  // Not ours: bcrypt ignores anything past 72 bytes, so a longer one would be
  // silently truncated rather than stored.
  .max(72, "رمز طولانی‌تر از حد مجاز است");

// Deliberately not `password`: someone who signed up under the old floor still
// has a shorter one, and refusing to let them type it would lock them out of
// their own account rather than protect it.
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
