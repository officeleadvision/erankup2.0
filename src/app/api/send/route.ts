"use server";

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { SampleEmailTemplate } from "@/components/email-template";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function POST(request: NextRequest) {
  try {
    if (!resend) {
      return NextResponse.json(
        {
          success: false,
          message: "RESEND_API_KEY is not configured.",
        },
        { status: 500 }
      );
    }

    const { to, name } = await request.json();
    if (!to) {
      return NextResponse.json(
        { success: false, message: "Destination email is required." },
        { status: 400 }
      );
    }

    const emailContent = SampleEmailTemplate({ name });

    const data = await resend.emails.send({
      from: "Lead Me Support <support@leadme.bg>",
      to,
      subject: "Примерен имейл от eRankUp",
      react: emailContent,
    });

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send email.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
