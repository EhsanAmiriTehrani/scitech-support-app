const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const ngrok = require("ngrok");

const app = express();
app.use(cors());
app.use(express.json());

// Configure Gmail SMTP credentials
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "ehsan.uni.canberra@gmail.com",
        pass: "uvle fbld swff jvvx" // Use your Gmail app password here
    }
});

// Endpoint to send a generic email (to admin by default, or to user if "to" is provided)
app.post("/send-email", async (req, res) => {
    const { subject, text, to } = req.body;
    const recipient = to || "scitech-technologysupport@canberra.edu.au";
    try {
        await transporter.sendMail({
            from: "<ehsan.uni.canberra@gmail.com>",
            to: recipient,
            subject,
            text
        });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Webhook endpoint for Supabase "Done" column update
app.post("/done-webhook", async (req, res) => {
    console.log("Webhook called with body:\n", JSON.stringify(req.body, null, 2));
    const { record, old_record } = req.body;

    const wasDone = old_record ? old_record.Done : null;
    const isDone = record.Done;
    const universityEmail = record.university_email;
    const ticketNo = record.ticket_no;
    const requestLink = `http://localhost:3000/request/${ticketNo}`;

    console.log("wasDone:", wasDone, "isDone:", isDone);

    // If Done changed from false/null to true, send approval email
    if ((wasDone === false || wasDone === null) && isDone === true) {
        try {
            await transporter.sendMail({
                from: "<ehsan.uni.canberra@gmail.com>",
                to: universityEmail,
                subject: "LAB Access Request Update",
                text: "Hi,\nYour request is sent to security. You may need to wait for 10 business days for your access to be activated."
            });
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, error: err.message });
        }
    }
    // If Done changed from true/null to false, send rejection email
    else if ((wasDone === true || wasDone === null) && isDone === false) {
        try {
            await transporter.sendMail({
                from: "<ehsan.uni.canberra@gmail.com>",
                to: universityEmail,
                subject: "LAB Access Request Rejected",
                text: `Hi,\nYour request has been rejected. You can view the details here: ${requestLink}`
            });
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, error: err.message });
        }
    } else {
        res.json({ success: false, message: "No relevant update." });
    }
});

// Webhook endpoint for comments update
app.post("/comment-update-webhook", async (req, res) => {
    console.log("Comment update webhook called with body:\n", JSON.stringify(req.body, null, 2));
    const { table, record, old_record } = req.body;
    const ticketNo = record.ticket_no || "";
    const requestLink = `http://localhost:3000/request/${ticketNo}`;

    // Only send email if comments changed
    if (record && old_record && record.comments !== old_record.comments) {
        const universityEmail = record.university_email;
        const fullName = record.full_name || "User";
        const tableName = table || "your request";

        // Compute only the new comment part
        let newComment = record.comments;
        if (old_record.comments && record.comments.startsWith(old_record.comments)) {
            newComment = record.comments.slice(old_record.comments.length).trim();
        }

        // Remove timestamp if present at the start of the new comment
        newComment = newComment.replace(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]\s*/, "");

        try {
            await transporter.sendMail({
                from: "<ehsan.uni.canberra@gmail.com>",
                to: universityEmail,
                subject: `Your request (${ticketNo})_"${tableName}" got an update!`,
                text: `Hi ${fullName}\n\nView your request and comments here: ${requestLink}\n\nBest regards,\nSciTech Technology Support Team`
            });
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, error: err.message });
        }
    } else {
        res.json({ success: false, message: "No comment update detected." });
    }
});

const PORT = 5001;
app.listen(PORT, async () => {
    console.log(`Email server running on port ${PORT}`);

    // Start ngrok tunnel
    // try {
    //     const url = await ngrok.connect({
    //         addr: PORT,
    //         authtoken: '2x4Wubox6hGJE2vIqYP15PJKk7a_3aCDGdVtnwgoDHuP7tm3e', // <-- Replace with your ngrok authtoken
    //     });
    //     console.log(`ngrok tunnel started: ${url}/done-webhook`);
    //     console.log('Use this URL for your Supabase webhook.');
    // } catch (err) {
    //     console.error('Error starting ngrok:', err);
    // }
});
