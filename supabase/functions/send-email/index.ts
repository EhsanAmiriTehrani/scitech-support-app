// ...existing code...
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

console.log("Hello from Functions!");

serve(async (req) => {
  if (req.method === "POST" && req.headers.get("content-type")?.includes("application/json")) {
    try {
      const body = await req.json();

      // If the request is for sending email
      if (body.subject && body.text) {
        const { subject, text, to } = body;
        const recipient = to || "scitech-technologysupport@canberra.edu.au";
        const apiKey = Deno.env.get("RESEND_API_KEY");

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "SciTech <noreply@yourdomain.com>",
            to: recipient,
            subject,
            text,
          }),
        });

        return new Response(JSON.stringify({ success: res.ok }), {
          headers: { "Content-Type": "application/json" },
          status: res.ok ? 200 : 500,
        });
      }

      // Default hello handler
      const { name } = body;
      const data = {
        message: `Hello ${name || "World"}!`,
      };

      return new Response(
        JSON.stringify(data),
        { headers: { "Content-Type": "application/json" } },
      );
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid request" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  return new Response("Not found", { status: 404 });
});
// ...existing code...