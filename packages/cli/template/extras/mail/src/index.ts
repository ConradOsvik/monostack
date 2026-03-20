import { env } from "@{{projectName}}/env/server";
import { Resend } from "resend";

export const resend = new Resend(env.RESEND_API_KEY);

export function sendEmail(opts: {
  to: string | string[];
  subject: string;
  react: React.ReactElement;
}) {
  return resend.emails.send({
    from: "onboarding@resend.dev",
    ...opts,
  });
}
