"use server";

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { EmailTemplate } from "@/components/email-template";

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

    const data = await resend.emails.send({
      from: "LeadVision Support <support@leadvision.bg>",
      to,
      subject: "Примерен имейл от erankup1",
      react: (
        <EmailTemplate
          headline="Здравейте!"
          intro="Това е примерен имейл, изпратен чрез Resend и React."
        >
          <p>Съобщение до {name || "потребител"}.</p>
          <p>
            Можете да използвате този endpoint, за да проверите дали Resend е
            конфигуриран правилно.
          </p>
        </EmailTemplate>
      ),
    });

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send email.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

