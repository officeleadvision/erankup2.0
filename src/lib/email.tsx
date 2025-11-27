import * as React from "react";
import { Resend } from "resend";
import { render } from "@react-email/render";
import {
  NewUserEmailTemplate,
  PasswordResetEmailTemplate,
} from "@/components/email-template";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = "Lead Me Support <support@leadme.bg>";

const resendClient = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

type SendEmailProps = {
  to: string;
  subject: string;
  react: React.ReactElement;
};

const sendEmail = async ({ to, subject, react }: SendEmailProps) => {
  if (!resendClient) {
    console.warn("RESEND_API_KEY is not configured. Email not sent.");
    return false;
  }

  try {
    const html = await render(react);

    await resendClient.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error("Resend request failed:", error);
    return false;
  }
};

type NewUserEmailProps = {
  to: string;
  accountName: string;
  password: string;
  loginUrl: string;
};

export const sendNewUserEmail = async ({
  to,
  accountName,
  password,
  loginUrl,
}: NewUserEmailProps) => {
  const resolvedAccountName =
    typeof accountName === "string" && accountName.trim().length > 0
      ? to
      : accountName.trim();

  const react = React.createElement(NewUserEmailTemplate, {
    email: to,
    accountName: resolvedAccountName,
    password,
    loginUrl,
  });

  return sendEmail({
    to,
    subject: "Вашият достъп до eRankUp",
    react,
  });
};

type ResetEmailProps = {
  to: string;
  resetLink: string;
};

export const sendPasswordResetEmail = async ({
  to,
  resetLink,
}: ResetEmailProps) => {
  const react = React.createElement(PasswordResetEmailTemplate, {
    resetLink,
  });

  return sendEmail({
    to,
    subject: "Връзка за смяна на парола в eRankUp",
    react,
  });
};
