import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as postmark from "https://esm.sh/postmark@3.0.0";

console.log('Function "send-email" initialized');

serve(async (req: Request) => {
  try {
    // Create a Supabase client with the Auth context of the function
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    // Verify JWT from request
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Authorization token required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Get the user from the JWT
    const { data: { user }, error: jwtError } = await supabaseClient.auth
      .getUser(token);
    if (jwtError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization token" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Parse request body
    const requestData = await req.json();
    console.log("Request data:", requestData);

    // Validate required fields based on email type
    if (!requestData.type) {
      return new Response(JSON.stringify({ error: "Email type is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle different email types
    switch (requestData.type) {
      case "comment_notification":
        if (
          !requestData.recipient || !requestData.ticket_no ||
          !requestData.comment || !requestData.ticket_url
        ) {
          return new Response(
            JSON.stringify({
              error: "Missing required fields for comment notification",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        await sendCommentNotification(
          requestData.recipient,
          requestData.ticket_no,
          requestData.comment,
          requestData.ticket_url,
          user.email ?? "",
        );
        break;

      case "welcome_email":
        if (!requestData.to) {
          return new Response(
            JSON.stringify({ error: "Recipient email is required" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        await sendWelcomeEmail(requestData.to, requestData.full_name);
        break;

      case "password_reset":
        if (!requestData.to || !requestData.reset_link) {
          return new Response(
            JSON.stringify({
              error: "Missing required fields for password reset",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        await sendPasswordResetEmail(requestData.to, requestData.reset_link);
        break;

      default:
        return new Response(JSON.stringify({ error: "Invalid email type" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in send-email function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});

async function sendCommentNotification(
  recipient: string,
  ticketNo: string,
  comment: string,
  ticketUrl: string,
  commenterEmail: string,
) {
  const commenterName = commenterEmail.split("@")[0];
  const subject = `New comment on your support ticket #${ticketNo}`;
  const text =
    `Hello,\n\n${commenterName} has added a new comment to your support ticket #${ticketNo}:\n\n"${comment}"\n\nView and respond to this ticket here: ${ticketUrl}\n\nBest regards,\nSciTech Support Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">New comment on your support ticket #${ticketNo}</h2>
      <p>Hello,</p>
      <p><strong>${commenterName}</strong> has added a new comment to your support ticket:</p>
      <div style="background: #f5f5f5; padding: 15px; border-left: 4px solid #2196F3; margin: 15px 0;">
        ${comment}
      </div>
      <p>View and respond to this ticket here: <a href="${ticketUrl}">${ticketUrl}</a></p>
      <p>Best regards,<br>SciTech Support Team</p>
    </div>
  `;

  await sendEmail(recipient, subject, text, html);
}

async function sendWelcomeEmail(recipient: string, fullName: string) {
  const subject = "Welcome to SciTech Support";
  const text =
    `Hi ${fullName},\n\nYour account has been created successfully!\n\nYou can now log in to track your support requests.\n\nIf you forgot your password, you can reset it from the login page.\n\nBest regards,\nSciTech Support Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Welcome to SciTech Support</h2>
      <p>Hi ${fullName},</p>
      <p>Your account has been created successfully!</p>
      <p>You can now log in to track your support requests.</p>
      <p>If you forgot your password, you can reset it from the login page.</p>
      <p>Best regards,<br>SciTech Support Team</p>
    </div>
  `;

  await sendEmail(recipient, subject, text, html);
}

async function sendPasswordResetEmail(recipient: string, resetLink: string) {
  const subject = "Password Reset Request";
  const text =
    `We received a password reset request for your SciTech Support account.\n\nIf you didn't request this, please ignore this email.\n\nOtherwise, use this link to reset your password:\n${resetLink}\n\nThis link expires in 24 hours.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Password Reset Request</h2>
      <p>We received a password reset request for your SciTech Support account.</p>
      <p>If you didn't request this, please ignore this email.</p>
      <p>Otherwise, use the button below to reset your password:</p>
      <a href="${resetLink}" style="display: inline-block; background: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin: 15px 0;">Reset Password</a>
      <p>This link expires in 24 hours.</p>
    </div>
  `;

  await sendEmail(recipient, subject, text, html);
}

async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html: string,
) {
  try {
    // Using Resend SMTP (configured in your .env.local)
    const transporter = new postmark.ServerClient(
      Deno.env.get("RESEND_API_KEY") || "",
    );

    const response = await transporter.sendEmail({
      From: Deno.env.get("SUPABASE_SMTP_SENDER") || "no-reply@scitech.support",
      To: to,
      Subject: subject,
      TextBody: text,
      HtmlBody: html,
      MessageStream: "outbound",
    });

    console.log("Email sent:", response);
    return response;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}
