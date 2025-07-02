import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";


const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function RequestDetails() {
    const { ticketNo } = useParams();
    const [searchParams] = useSearchParams();
    const [request, setRequest] = useState(null);
    const [error, setError] = useState("");
    const [newComment, setNewComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [user, setUser] = useState(null);
    const [notification, setNotification] = useState(null);
    const [assignedTo, setAssignedTo] = useState(request?.assigned_to || "");
    const commentsEndRef = useRef(null);

    // Auto-scroll comments to bottom when they change
    useEffect(() => {
        if (commentsEndRef.current) {
            commentsEndRef.current.scrollTo({
                top: commentsEndRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [request?.comments]);

    // Handle authentication and email confirmation
    useEffect(() => {
        // Check for email confirmation in URL
        const type = searchParams.get('type');
        if (type === 'email') {
            setNotification({
                type: 'success',
                message: '🎉 Email confirmed successfully! You can now login.'
            });
            // Clean up the URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Check current user session
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUser(session.user);
            }
        };

        checkSession();

        // Set up auth state listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (event === 'SIGNED_IN') {
                    setUser(session.user);
                    if (searchParams.get('type') === 'email') {
                        setNotification({
                            type: 'success',
                            message: '🎉 Email confirmed! You are now logged in.'
                        });
                    }
                } else if (event === 'SIGNED_OUT') {
                    setUser(null);
                }
            }
        );

        return () => subscription?.unsubscribe();
    }, [searchParams]);

    useEffect(() => {
        async function fetchRequest() {
            if (!ticketNo) return;

            setError("");
            setRequest(null);
            try {
                const { data, error } = await supabase
                    .from("LAB Access Request for 6B39")
                    .select("*")
                    .eq("ticket_no", ticketNo.trim())
                    .maybeSingle();

                if (error) throw error;
                if (!data) throw new Error(`No data found for ticketNo: ${ticketNo.trim()}`);

                setRequest(data);
            } catch (err) {
                setError(err.message || "Request not found.");
            }
        }

        // Fetch initial data
        fetchRequest();

        // Set up real-time subscription
        const channel = supabase
            .channel('request-changes')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'LAB Access Request for 6B39',
                    filter: `ticket_no=eq.${ticketNo.trim()}`
                },
                (payload) => {
                    setRequest(payload.new);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [ticketNo]);

    async function updateStatus(newStatus) {
        setSubmitting(true);
        try {
            const now = new Date();
            // Format as YYYY-MM-DD only
            const dateOnly = now.toLocaleDateString('en-AU', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).replace(/\//g, '-'); // Convert DD/MM/YYYY to DD-MM-YYYY

            const { error } = await supabase
                .from("LAB Access Request for 6B39")
                .update({
                    Done: newStatus,
                    status_timestamp: dateOnly,  // Store just the date
                    assigned_to: null
                })
                .eq("ticket_no", ticketNo.trim());

            if (error) throw error;

            setRequest({
                ...request,
                Done: newStatus,
                status_timestamp: dateOnly,
                assigned_to: null
            });

            setNotification({
                type: 'success',
                message: `Status updated to ${newStatus ? 'Completed' : 'Rejected'}`
            });
        } catch (err) {
            setNotification({ type: 'error', message: `Failed to update status: ${err.message}` });
        } finally {
            setSubmitting(false);
        }
    }

async function handleAddComment(e) {
        e.preventDefault();
        // First refresh to get latest status
        const { data: currentRequest } = await supabase
            .from("LAB Access Request for 6B39")
            .select("*")
            .eq("ticket_no", ticketNo.trim())
            .maybeSingle();

        if (currentRequest?.Done === false) {
            alert("This request has been rejected. No further comments are allowed.");
            return;
        }

        if (!newComment.trim() || !user) return;

        setSubmitting(true);
        try {
            const username = user.email.split("@")[0];
            const now = new Date();
            const timestamp = now.toLocaleString('en-AU', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }).replace(/(\d+)\/(\d+)\/(\d+),?/, '$3-$2-$1');
            const commentToAdd = `${request.comments ? request.comments + "\n" : ""}[${timestamp}] @${username}: ${newComment}`;

            const { error } = await supabase
                .from("LAB Access Request for 6B39")
                .update({ comments: commentToAdd })
                .eq("ticket_no", ticketNo.trim());

            if (error) throw error;

            setRequest({ ...request, comments: commentToAdd });
            setNewComment("");

            // Send notification email
            fetch(`${process.env.REACT_APP_EMAIL_API}`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    type: "comment_notification",
                    recipient: request.university_email,
                    ticket_no: request.ticket_no,
                    comment: newComment,
                    ticket_url: window.location.href
                })
            }).catch(err => console.error("Email send error:", err));

            setNotification({ type: 'success', message: "Comment added successfully" });
        } catch (err) {
            setNotification({ type: 'error', message: `Failed to add comment: ${err.message}` });
        } finally {
            setSubmitting(false);
        }
    }   
    
    
    async function handleSignup(email, password) {
        // 1. Validate university email
        const allowed = email.endsWith("@uni.canberra.edu.au") || email.endsWith("@canberra.edu.au");
        if (!allowed) {
            setNotification({ 
                type: 'error', 
                message: "University email required (@uni.canberra.edu.au)" 
            });
            return;
        }

        try {
            // 2. Check if user exists using auth API (client-side approach)
            const { data: { user }, error: fetchError } = await supabase.auth.getUser();
            
            // Alternative check if getUser() doesn't work
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password: "temporary_wrong_password"
            });

            // If no error when trying to sign in, user exists
            if (!signInError) {
                setNotification({
                    type: 'info',
                    message: "Account already exists. Forgot password? Try resetting it."
                });
                return;
            }

            // 3. Proceed with signup if user doesn't exist
            const { data, error: signupError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: "https://ehsanamiritehrani.github.io/scitech-support-app/#/auth/confirm",
                    data: { 
                        full_name: email.split('@')[0].replace('.', ' ') 
                    }
                }
            });

            if (signupError) throw signupError;

            // 4. Handle response
            if (data.user?.confirmation_sent_at) {
                setNotification({
                    type: 'success',
                    message: `Verification email sent to ${email}. Please check your inbox.`
                });
            } else {
                setNotification({
                    type: 'warning',
                    message: "Account created but verification email not sent."
                });
            }

        } catch (error) {
            console.error("Signup error:", error);
            setNotification({
                type: 'error',
                message: error.message.includes("Invalid login credentials") 
                    ? "Account already exists. Please login instead."
                    : error.message || "Signup failed. Please try again."
            });
        }
    }

    async function handlePasswordLogin(email, password) {
        if (!email.endsWith("@uni.canberra.edu.au") && !email.endsWith("@canberra.edu.au")) {
            setNotification({ type: 'error', message: "University email required" });
            return;
        }

        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            window.location.reload();
        } catch (err) {
            setNotification({ type: 'error', message: "Login failed: " + err.message });
        }
    }

    async function handleAssignTicket(email) {
        if (email && !email.endsWith("@uni.canberra.edu.au") && !email.endsWith("@canberra.edu.au")) {
            setNotification({ type: 'error', message: "University email required" });
            return;
        }

        setSubmitting(true);
        try {
            const { error } = await supabase
                .from("LAB Access Request for 6B39")
                .update({ assigned_to: email || null })  // Set to null when clearing
                .eq("ticket_no", ticketNo.trim());

            if (error) throw error;

            // Update local state
            setRequest(prev => ({ ...prev, assigned_to: email || null }));
            setAssignedTo(email || "");

            // Only add comment if we're assigning (not clearing)
            if (email) {
                const username = user.email.split("@")[0];
                const now = new Date();
                const timestamp = now.toLocaleString('en-AU', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                }).replace(/(\d+)\/(\d+)\/(\d+),?/, '$3-$2-$1');

                const commentToAdd = `${request.comments ? request.comments + "\n" : ""}[${timestamp}]: Ticket is awaiting action from: ${email}`;

                await supabase
                    .from("LAB Access Request for 6B39")
                    .update({ comments: commentToAdd })
                    .eq("ticket_no", ticketNo.trim());

                setRequest(prev => ({ ...prev, comments: commentToAdd }));

                // Send email to assignee
                try {
                    const emailResponse = await fetch(process.env.REACT_APP_EMAIL_API, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            to: email,
                            subject: `Ticket ${request.ticket_no} is awaiting your action`,
                            text: `scitech-technologysupport@canberra.edu.au is waiting for your action on ticket ${request.ticket_no}.\n\nPlease view it at: ${window.location.origin}/request/${request.ticket_no}`
                        })
                    });
                    
                    if (!emailResponse.ok) {
                        console.error("Assignment email failed:", await emailResponse.text());
                    }
                } catch (emailErr) {
                    console.error("Email send error:", emailErr);
                }
            }

            setNotification({
                type: 'success',
                message: email ? `This ticket is awaiting action from ${email}` : 'Assignment cleared'
            });
        } catch (err) {
            setNotification({ type: 'error', message: `Failed to assign ticket: ${err.message}` });
        } finally {
            setSubmitting(false);
        }
    }

    async function handleLogout() {
        await supabase.auth.signOut();
        window.location.reload();
    }

    if (error) return <div className="error">{error}</div>;
    if (!request) return <div>Loading...</div>;

    const isTechSupport = user?.email === "scitech-technologysupport@canberra.edu.au";
    const commentsDisabled = request.Done === true || request.Done === false;

    return (
        <div className="request-container">
            {/* Notification system */}
            {notification && (
                <div className={`notification ${notification.type}`}>
                    <span>{notification.message}</span>
                    <button onClick={() => setNotification(null)}>×</button>
                </div>
            )}

            <h2>LAB Access Request for 6B39</h2>
            <div className="request-details">
                <p><b>Requestor:</b> {request.full_name}</p>
                <p><b>Email:</b> {request.university_email}</p>
                <p><b>Room:</b> {request.room_no}</p>
                <p><b>Submitted:</b> {request.submission_date}</p>
                <p><b>Ticket:</b> {request.ticket_no}</p>
                <p><b>Status:</b>
                    <span className={`status-badge ${request.Done === true ? 'completed' :
                        request.Done === false ? 'rejected' : 'pending'
                        }`}>
                        {request.Done === true ? `Completed on ${request.status_timestamp}` :
                            request.Done === false ? `Rejected on ${request.status_timestamp}` : 'Pending'}
                    </span>
                </p>
                <div className="comments-section">
                    <b>Comments:</b>
                    {request.assigned_to && (request.Done !== true && request.Done !== false) && (
                        <div className="assignment-notice">
                            This ticket is currently awaiting action from: {request.assigned_to}
                        </div>
                    )}
                    <div className="comments-container" ref={commentsEndRef}>
                        {request.comments ? (
                            <div className="comment-list">
                                {request.comments.split('\n').map((comment, index) => {
                                    // Check if this is an assignment notification
                                    const isAssignmentNotice = comment.includes("Ticket is awaiting action from:");

                                    // Split comment into parts to identify usernames (supports both @username and @username: formats)
                                    const parts = comment.split(/(@[\w.-]+:?)/g);

                                    return (
                                        <div key={index} className={`comment ${isAssignmentNotice ? 'assignment-notice-comment' : ''}`}>
                                            {isAssignmentNotice ? (
                                                <span className="assignment-text">{comment}</span>
                                            ) : (
                                                parts.map((part, i) => {
                                                    if (part.startsWith('@')) {
                                                        // Check if it's the tech support username
                                                        const isTechSupport = part.includes('@scitech-technologysupport');
                                                        return (
                                                            <span
                                                                key={i}
                                                                className={isTechSupport ? 'tech-support-username' : 'username'}
                                                            >
                                                                {part}
                                                            </span>
                                                        );
                                                    }
                                                    return <span key={i}>{part}</span>;
                                                })
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="no-comments">No comments yet</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="status-display">
                <span className="status-label"><b>Status:</b></span>
                <span className={`status-badge ${request.Done === true ? 'completed' :
                    request.Done === false ? 'rejected' : 'pending'
                    }`}>
                    {request.Done === true ? `Completed on ${request.status_timestamp}` :
                        request.Done === false ? `Rejected on ${request.status_timestamp}` : 'Pending'}
                </span>
            </div>

            {isTechSupport && (request.Done !== true && request.Done !== false) && (
                <div className="status-actions">
                    <button
                        onClick={() => updateStatus(true)}
                        disabled={submitting || request.Done === true}
                        className="complete-btn"
                    >
                        Mark as Completed
                    </button>
                    <button
                        onClick={() => updateStatus(false)}
                        disabled={submitting || request.Done === false}
                        className="reject-btn"
                    >
                        Mark as Rejected
                    </button>

                    <div className="assign-section">
                        <label>
                            Awaiting Action From:
                            {request.assigned_to ? (
                                <div className="assigned-info">
                                    <span>{request.assigned_to}</span>
                                    <button
                                        onClick={() => handleAssignTicket('')}
                                        disabled={submitting}
                                        className="clear-btn"
                                    >
                                        Clear
                                    </button>
                                    <button
                                        onClick={() => {
                                            const newAssignee = prompt("Enter new assignee email:", request.assigned_to);
                                            if (newAssignee) handleAssignTicket(newAssignee);
                                        }}
                                        disabled={submitting}
                                        className="reassign-btn"
                                    >
                                        Reassign
                                    </button>
                                </div>
                            ) : (
                                <div className="assign-input">
                                    <input
                                        type="email"
                                        value={assignedTo}
                                        onChange={(e) => setAssignedTo(e.target.value)}
                                        placeholder="assign@canberra.edu.au"
                                    />
                                    <button
                                        onClick={() => handleAssignTicket(assignedTo)}
                                        disabled={submitting || !assignedTo}
                                    >
                                        Assign
                                    </button>
                                </div>
                            )}
                        </label>
                    </div>
                </div>
            )}

            {user ? (
                <form onSubmit={handleAddComment} className="comment-form">
                    <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAddComment(e);
                            }
                        }}
                        placeholder="Add your comment..."
                        required
                        disabled={submitting || commentsDisabled}
                    />
                    <div className="form-actions">
                        <button type="submit" disabled={submitting || commentsDisabled}>
                            {submitting ? "Submitting..." : "Add Comment"}
                        </button>
                        <button type="button" onClick={handleLogout} className="logout-btn">
                            Logout
                        </button>
                    </div>
                </form>
            ) : (
                <div className="auth-forms" style={{ display: 'flex', gap: '2rem' }}>
                    {/* Login Form */}
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        handlePasswordLogin(e.target.email.value, e.target.password.value);
                    }} style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '1.25rem' }}>Login <span style={{ fontSize: '0.875rem', color: '#7f8c8d', marginLeft: '8px' }}>to add comments</span></h3>
                        <input name="email" type="email" placeholder="uni.canberra.edu.au" required />
                        <input name="password" type="password" placeholder="Password" required />
                        <button type="submit" style={{ marginTop: '1rem' }}>Login</button>
                        
                    </form>

                    
                    {/* Signup Section */}
                    <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '1.25rem' }}>New User?</h3>
                        <button onClick={() => {
                            const email = prompt("Enter your university email:");
                            const password = prompt("Enter your password\nBe sure to save it somewhere as this can be done one time only:");
                            if (email && password) handleSignup(email, password);
                        }} style={{ marginTop: '1rem' }}>
                            Sign Up
                        </button>
                    </div>
                </div>
            )}

            <style jsx>{`
                .request-container {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 15px;
                    color: white;
                    border-radius: 4px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    display: flex;
                    align-items: center;
                    z-index: 1000;
                }
                .notification.success {
                    background-color: #4CAF50;
                }
                .notification.error {
                    background-color: #f44336;
                }
                .request-details {
                    background: #f9f9f9;
                    padding: 20px;
                    border-radius: 5px;
                    margin-bottom: 20px;
                }
                .status-display {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 8px;
                }

                .status-label {
                    flex-shrink: 0;
                }

                .status-badge {
                    padding: 4px 8px;
                    border-radius: 4px;
                    color: white;
                    font-weight: bold;
                    white-space: nowrap;
                }

                .status-badge.completed {
                    background-color: #4CAF50;
                }
                .status-badge.rejected {
                    background-color: #f44336;
                }
                .status-badge.pending {
                    background-color: #FF9800;
                }
                .status-actions {
                    margin: 10px 0;
                    display: flex;
                    gap: 8px;
                }
                .status-actions button {
                    padding: 6px 12px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                .status-actions button:first-child {
                    background-color: #4CAF50;
                    color: white;
                }
                .status-actions button:last-child {
                    background-color: #f44336;
                    color: white;
                }
                .status-actions button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .comment-form textarea {
                    width: 100%;
                    min-height: 100px;
                    padding: 10px;
                    margin-bottom: 10px;
                }
                .form-actions {
                    display: flex;
                    gap: 10px;
                }
                .auth-forms {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                }
                .error {
                    color: #ffebee;
                    padding: 10px;
                    background: #f44336;
                    border-radius: 10px;
                }
                .comments-section {
                    margin-top: 20px;
                    background: #f9f9f9;
                    padding: 15px;
                    border-radius: 5px;
                }
                .comments-container {
                    max-height: 200px;
                    overflow-y: auto;
                    background: #f0f0f0;
                    padding: 10px;
                    border-radius: 4px;
                    margin-top: 5px;
                    border: 1px solid #ddd;
                }
                .comment-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                
                .comment {
                    padding: 8px;
                    background: white;
                    border-radius: 4px;
                    border-left: 3px solid #ddd;
                    margin-bottom: 8px;
                    white-space: pre-wrap;
                }

                .username {
                    font-weight: bold;
                    color: #2196F3;
                    margin-right: 4px;
                }

                .tech-support-username {
                    font-weight: bold;
                    color: #FF9800; /* Orange for tech support */
                }
                
                .no-comments {
                    color: #777;
                    font-style: italic;
                    padding: 8px;
                }

                .comments-container::-webkit-scrollbar {
                    width: 8px;
                }

                .comments-container::-webkit-scrollbar-track {
                    background: #f1f1f1;
                    border-radius: 4px;
                }

                .comments-container::-webkit-scrollbar-thumb {
                    background: #888;
                    border-radius: 4px;
                }

                .comments-container::-webkit-scrollbar-thumb:hover {
                    background: #555;
                }

                .comment:last-child {
                    margin-bottom: 0;
                    padding-bottom: 0;
                    border-bottom: none;
                }
                .assign-section {
                    margin-top: 10px;
                    padding-top: 10px;
                    border-top: 1px solid #eee;
                }

                .assign-section label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: bold;
                }

                .assigned-info {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-top: 5px;
                }

                .assigned-info span {
                    background: #f0f0f0;
                    padding: 5px 10px;
                    border-radius: 4px;
                }

                .assign-input {
                    display: flex;
                    gap: 5px;
                    margin-top: 5px;
                }

                .assign-input input {
                    flex: 1;
                    padding: 5px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }

                .assignment-notice {
                    background: #e3f2fd;
                    padding: 8px;
                    border-radius: 4px;
                    margin: 10px 0;
                    color: #1976d2;
                    font-size: 0.9em;
                }

                .assignment-notice-comment {
                    background-color: #fff3e0;
                    border-left-color: #2196F3;
                }
                
                .assignment-text {
                    font-weight: bold;
                    color: #000000;
                    display: inline-block;
                    width: 100%;
                }

                .clear-btn {
                    background-color: #f44336;
                    color: white;
                    border: none;
                    padding: 5px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                }

                .reassign-btn {
                    background-color: #2196F3;
                    color: white;
                    border: none;
                    padding: 5px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                }

                .clear-btn:hover {
                    background-color: #d32f2f;
                }

                .reassign-btn:hover {
                    background-color: #1976D2;
                }

                .status-actions {
                    display: flex;
                    gap: 10px;
                    margin: 20px 0;
                    flex-wrap: wrap;
                }
                
                .complete-btn {
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: background-color 0.3s;
                }
                
                .complete-btn:hover:not(:disabled) {
                    background-color: #388E3C;
                }
                
                .reject-btn {
                    background-color: #F44336;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: background-color 0.3s;
                }
                
                .reject-btn:hover:not(:disabled) {
                    background-color: #D32F2F;
                }
                
                .assign-controls {
                    display: flex;
                    gap: 10px;
                    margin-left: auto;
                }
                
                .clear-btn {
                    background-color: #FF9800;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: background-color 0.3s;
                }
                
                .clear-btn:hover:not(:disabled) {
                    background-color: #F57C00;
                }
                
                .reassign-btn {
                    background-color: #2196F3;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: background-color 0.3s;
                }
                
                .reassign-btn:hover:not(:disabled) {
                    background-color: #1976D2;
                }
                
                button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    );
}





