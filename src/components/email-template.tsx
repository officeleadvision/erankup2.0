import * as React from "react";

interface BaseTemplateProps {
  headline: string;
  intro: string;
  children?: React.ReactNode;
  footerNote?: string;
}

const baseWrapperStyle: React.CSSProperties = {
  backgroundColor: "#f3f4f6",
  padding: "32px",
  fontFamily: "'Inter', Arial, sans-serif",
  color: "#0f172a",
};

const cardStyle: React.CSSProperties = {
  maxWidth: "600px",
  margin: "0 auto",
  background: "#ffffff",
  borderRadius: "20px",
  overflow: "hidden",
  boxShadow: "0 25px 60px rgba(15, 23, 42, 0.15)",
};

const headerStyle: React.CSSProperties = {
  background: "linear-gradient(120deg,#312e81,#4c1d95)",
  padding: "32px 40px",
  color: "#ffffff",
};

const bodyStyle: React.CSSProperties = {
  padding: "32px 40px",
  lineHeight: 1.6,
  fontSize: "15px",
};

const footerStyle: React.CSSProperties = {
  background: "#f8fafc",
  padding: "18px 40px",
  textAlign: "center",
  color: "#94a3b8",
  fontSize: "12px",
};

const buttonStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "15px 36px",
  borderRadius: "999px",
  fontWeight: 600,
  textDecoration: "none",
  color: "#ffffff",
  boxShadow: "0 15px 35px rgba(79, 70, 229, 0.35)",
};

export function EmailTemplate({
  headline,
  intro,
  children,
  footerNote,
}: BaseTemplateProps) {
  return (
    <div style={baseWrapperStyle}>
      <table style={cardStyle} cellPadding={0} cellSpacing={0} role="presentation">
        <tbody>
          <tr>
            <td style={headerStyle}>
              <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 700 }}>
                {headline}
              </h1>
              <p style={{ margin: "10px 0 0", color: "#e0e7ff", fontSize: "15px" }}>
                {intro}
              </p>
            </td>
          </tr>
          <tr>
            <td style={bodyStyle}>{children}</td>
          </tr>
          <tr>
            <td style={footerStyle}>
              {footerNote || "© " + new Date().getFullYear() + " LeadVision. Всички права запазени."}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export interface NewUserTemplateProps {
  accountName: string;
  password: string;
  loginUrl: string;
}

export function NewUserEmailTemplate({
  accountName,
  password,
  loginUrl,
}: NewUserTemplateProps) {
  return (
    <EmailTemplate
      headline="Добре дошли в erankup1"
      intro="Акаунтът ви беше активиран успешно."
    >
      <p>Здравейте,</p>
      <p>
        Създадохме нов достъп за вас в платформата <strong>erankup1</strong>.
        Използвайте данните по-долу, за да влезете. Можете да смените паролата си
        след първото влизане от профилната страница.
      </p>

      <div
        style={{
          margin: "24px 0",
          padding: "18px",
          borderRadius: "16px",
          background: "#eef2ff",
          border: "1px dashed #c7d2fe",
        }}
      >
        <p style={{ margin: "0 0 8px", fontWeight: 600 }}>
          Акаунт: <span style={{ fontWeight: 400 }}>{accountName}</span>
        </p>
        <p style={{ margin: 0, fontWeight: 600 }}>
          Временна парола: <span style={{ fontWeight: 400 }}>{password}</span>
        </p>
      </div>

      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <a
          href={loginUrl}
          style={{
            ...buttonStyle,
            background: "#4f46e5",
          }}
        >
          Вход в erankup1
        </a>
      </div>

      <p style={{ fontSize: "13px", color: "#475569" }}>
        Ако не сте очаквали този имейл, моля свържете се със своя администратор.
      </p>
    </EmailTemplate>
  );
}

export interface PasswordResetTemplateProps {
  resetLink: string;
}

export function PasswordResetEmailTemplate({
  resetLink,
}: PasswordResetTemplateProps) {
  return (
    <EmailTemplate
      headline="Заявка за нова парола"
      intro="Получихме заявка за смяна на паролата ви."
    >
      <p>Здравейте,</p>
      <p>
        За да зададете нова парола, натиснете бутона по-долу. Връзката е активна
        60 минути. Ако не сте заявили смяна на парола, игнорирайте това съобщение.
      </p>

      <div style={{ textAlign: "center", margin: "28px 0" }}>
        <a
          href={resetLink}
          style={{
            ...buttonStyle,
            background: "#0ea5e9",
            boxShadow: "0 15px 35px rgba(14,165,233,0.35)",
          }}
        >
          Задай нова парола
        </a>
      </div>

      <p style={{ fontSize: "13px", color: "#475569" }}>
        Ако бутонът не работи, копирайте и отворете връзката в браузър:
      </p>
      <p
        style={{
          wordBreak: "break-all",
          background: "#f8fafc",
          padding: "12px",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          fontSize: "13px",
        }}
      >
        {resetLink}
      </p>
    </EmailTemplate>
  );
}

export interface SampleEmailTemplateProps {
  name?: string;
}

export function SampleEmailTemplate({ name }: SampleEmailTemplateProps) {
  const recipient = name || "потребител";
  return (
    <EmailTemplate
      headline="Здравейте!"
      intro="Това е примерен имейл, изпратен чрез Resend и React."
    >
      <p>Съобщение до {recipient}.</p>
      <p>
        Можете да използвате този endpoint, за да проверите дали Resend е
        конфигуриран правилно.
      </p>
    </EmailTemplate>
  );
}

