import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_ANON_KEY
);

function getTimestamp() {
    const now = new Date();
    const datePart = now.toLocaleDateString("en-AU", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$2-$1");

    const timePart = now.toLocaleTimeString("en-AU", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });

    return `${datePart} at ${timePart}`;
}

const categories = {
    "Teaching Development Support": [
        "Consultation Request",
        "Hardware Request",
        "Software Request",
        "Cloud Services Request",
    ],
    "Teaching Lab Support": [
        "Consultation Request",
        "Hardware Request",
        "Software Request",
        "Cloud Services Request",
    ],
    "HDR Support": [
        "Consultation Request",
        "Hardware Request",
        "Software Request",
        "Cloud Services Request",
        "Maintenance Request",
        "Fabrication Support Request",
        "LAB Access Request",
    ],
    "Undergrad Students Support": [
        "Consultation Request",
        "Hardware Request",
        "Software Request",
        "Cloud Services Request",
        "LAB Access Request",
    ],
};

const defaultFormFields = [
    { label: "Description of Request", name: "description", type: "textarea" },
];

const capstoneLabAccessFields = [
    { label: "Submission Date", name: "submissionDate", type: "text", auto: true },
    {
        label: "Full Name",
        name: "fullName",
        type: "text",
        fixed: (email) => !email?.endsWith("@uni.canberra.edu.au")
    },
    { label: "University Email", name: "email", type: "email", fixed: true },
    { label: "Badge File", name: "badgeFile", type: "file" },
    { label: "Room No", name: "roomNo", type: "text", fixed: "6B39" },
];

const filterOptions = [
    { value: "all", label: "All Tickets" },
    { value: "backlog", label: "Backlog" },
    { value: "completed", label: "Completed" },
    { value: "rejected", label: "Rejected" },
];

function isValidUniEmail(email) {
    return (
        typeof email === "string" &&
        (email.endsWith("@canberra.edu.au") || email.endsWith("@uni.canberra.edu.au"))
    );
}

const isAdminUser = (email) => {
    return email === "scitech-technologysupport@canberra.edu.au";
};

export default function SupportRequestApp() {
    const [selectedCategory, setSelectedCategory] = useState("");
    const [selectedSubcategory, setSelectedSubcategory] = useState("");
    const [formData, setFormData] = useState({ roomNo: "6B39" });
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogError, setDialogError] = useState("");
    const [formKey, setFormKey] = useState(0);
    const [user, setUser] = useState(null);
    const [notification, setNotification] = useState(null);
    const [userTickets, setUserTickets] = useState([]);
    const [assignedTickets, setAssignedTickets] = useState([]);
    const [showAuthForm, setShowAuthForm] = useState(false);
    const [authMode, setAuthMode] = useState("login");
    const [createdFilter, setCreatedFilter] = useState("all");
    const [assignedFilter, setAssignedFilter] = useState("all");
    const [isAdmin, setIsAdmin] = useState(false);
    const [allTickets, setAllTickets] = useState([]);
    const [adminFilter, setAdminFilter] = useState("all");

    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUser(session.user);
                setIsAdmin(isAdminUser(session.user.email));
                fetchUserTickets(session.user.email);
                if (isAdminUser(session.user.email)) {
                    fetchAllTickets();
                }
                // Set user data in form
                setFormData(prev => ({
                    ...prev,
                    fullName: (session.user.email.endsWith("@uni.canberra.edu.au"))
                        ? prev.fullName || ""
                        : session.user.user_metadata?.full_name || session.user.email.split('@')[0].replace('.', ' '),
                    email: session.user.email
                }));
            }
        };

        checkSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (event === "SIGNED_IN") {
                    setUser(session.user);
                    setIsAdmin(isAdminUser(session.user.email));
                    fetchUserTickets(session.user.email);
                    if (isAdminUser(session.user.email)) {
                        fetchAllTickets();
                    }
                    setNotification({
                        type: "success",
                        message: "Successfully logged in",
                    });
                    // Set user data in form
                    setFormData(prev => ({
                        ...prev,
                        fullName: (session.user.email.endsWith("@uni.canberra.edu.au"))
                            ? prev.fullName || ""
                            : session.user.user_metadata?.full_name || session.user.email.split('@')[0].replace('.', ' '),
                        email: session.user.email
                    }));
                } else if (event === "SIGNED_OUT") {
                    setUser(null);
                    setIsAdmin(false);
                    setUserTickets([]);
                    setAssignedTickets([]);
                    setAllTickets([]);
                    setFormData({ roomNo: "6B39" });
                }
            }
        );

        return () => subscription?.unsubscribe();
    }, []);

    const fetchAllTickets = async () => {
        try {
            const { data } = await supabase
                .from("LAB Access Request for 6B39")
                .select("*");
            setAllTickets(data || []);
            setNotification({
                type: "success",
                message: "All tickets refreshed",
            });
        } catch (error) {
            console.error("Error fetching all tickets:", error);
            setNotification({
                type: "error",
                message: "Failed to refresh tickets",
            });
        }
    };

    const fetchUserTickets = async (email) => {
        try {
            const { data: createdTickets } = await supabase
                .from("LAB Access Request for 6B39")
                .select("*")
                .eq("university_email", email);

            const { data: assignedTickets } = await supabase
                .from("LAB Access Request for 6B39")
                .select("*")
                .eq("assigned_to", email);

            setUserTickets(createdTickets || []);
            setAssignedTickets(assignedTickets || []);
        } catch (error) {
            console.error("Error fetching tickets:", error);
        }
    };

    const filterTickets = (tickets, filter) => {
        if (filter === "all") return tickets;
        return tickets.filter((ticket) => {
            if (filter === "backlog") return ticket.Done === null && !ticket.assigned_to;
            if (filter === "completed") return ticket.Done === true;
            if (filter === "rejected") return ticket.Done === false;
            return true;
        });
    };

    const handleSignup = async (email, password, fullName) => {
        if (!isValidUniEmail(email)) {
            setNotification({ type: "error", message: "University email required" });
            return;
        }

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: "https://ehsanamiritehrani.github.io/scitech-support-app/#/auth/confirm",
                    data: {
                        full_name: fullName
                    }
                },
            });

            if (error) throw error;

            setNotification({
                type: "success",
                message: `Confirmation email sent to ${email}. Please check your inbox.`,
            });
            setAuthMode("login");
        } catch (err) {
            setNotification({ type: "error", message: err.message });
        }
    };

    const handleLogin = async (email, password) => {
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;
            setShowAuthForm(false);
        } catch (err) {
            setNotification({ type: "error", message: "Login failed: " + err.message });
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    const areAllFieldsFilled = () => {
        const fields = capstoneLabAccessFields.filter((f) => !f.fixed && !f.auto);
        return fields.every(
            (field) =>
                formData[field.name] &&
                (field.type !== "file" || formData[field.name] instanceof File)
        );
    };

    const handleInputChange = (e) => {
        const { name, type, value, files } = e.target;
        setFormData({
            ...formData,
            [name]: type === "file" ? files[0] : value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user) {
            setNotification({
                type: "error",
                message: "Please login to submit a request",
            });
            setShowAuthForm(true);
            return;
        }

        if (
            selectedCategory === "Undergrad Students Support" &&
            selectedSubcategory === "LAB Access Request"
        ) {
            if (!areAllFieldsFilled()) {
                setDialogError("You need to fill all the fields.");
                setDialogOpen(true);
                return;
            }

            let badgeUrl = null;
            if (formData.badgeFile) {
                const { data, error: uploadError } = await supabase.storage
                    .from("6b39-badge-upload")
                    .upload(`badges/${Date.now()}_${formData.badgeFile.name}`, formData.badgeFile);

                if (uploadError) {
                    setDialogError(`Upload failed: ${uploadError.message}`);
                    setDialogOpen(true);
                    return;
                }

                badgeUrl = data.path;
            }

            const submissionDate = getTimestamp();
            const ticketNo = `${formData.fullName.replace(/[^a-zA-Z0-9]/g, "")}_${Date.now()}`;

            const { error } = await supabase.from("LAB Access Request for 6B39").insert({
                full_name: formData.fullName,
                university_email: formData.email,
                badge_url: badgeUrl,
                room_no: formData.roomNo,
                submission_date: submissionDate,
                ticket_no: ticketNo,
                category: selectedCategory,
                subcategory: selectedSubcategory,
            });

            if (error) {
                setDialogError(`Submission failed: ${error.message}`);
            } else {
                setDialogError("");
                setFormData({
                    roomNo: "6B39",
                    fullName: user.email.endsWith("@uni.canberra.edu.au")
                        ? ""
                        : user.user_metadata?.full_name || user.email.split('@')[0].replace('.', ' '),
                    email: user.email
                });
                setFormKey((prev) => prev + 1);
                fetchUserTickets(user.email);
                if (isAdmin) {
                    fetchAllTickets();
                }

                /*
                fetch(process.env.REACT_APP_EMAIL_API, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        subject: "6B39 Request Access Submitted",
                        text: `${formData.email} has submitted a new request.\n\nView and add comments on: http://localhost:3000/request/${ticketNo}`,
                    }),
                });

                fetch(process.env.REACT_APP_EMAIL_API, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        subject: "6B39 LAB Access Request Submitted",
                        text: `Your request has been successfully submitted! View on: http://localhost:3000/request/${ticketNo}`,
                        to: formData.email,
                    }),
                });
                */
            }
            setDialogOpen(true);
        } else {
            const categoryKey = selectedCategory.replace(/[ ,]/g, "_").toLowerCase();
            const subcategoryKey = selectedSubcategory.replace(/[ ,]/g, "_").toLowerCase();
            console.log("Saving to table:", `${categoryKey}_${subcategoryKey}`, formData);
            setFormData({ roomNo: "6B39", fullName: user.user_metadata?.full_name || user.email.split('@')[0].replace('.', ' '), email: user.email });
            setFormKey((prev) => prev + 1);
            setDialogError("");
            setDialogOpen(true);
        }
    };

    const getFormFields = () => {
        if (
            selectedCategory === "Undergrad Students Support" &&
            selectedSubcategory === "LAB Access Request"
        ) {
            return capstoneLabAccessFields;
        }
        return defaultFormFields;
    };

    return (
        <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
            {notification && (
                <div
                    style={{
                        position: "fixed",
                        top: 20,
                        right: 20,
                        padding: 15,
                        backgroundColor:
                            notification.type === "success" ? "#4CAF50" : "#f44336",
                        color: "white",
                        borderRadius: 4,
                        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
                        display: "flex",
                        alignItems: "center",
                        zIndex: 1000,
                    }}
                >
                    <span>{notification.message}</span>
                    <button
                        onClick={() => setNotification(null)}
                        style={{
                            marginLeft: 10,
                            background: "none",
                            border: "none",
                            color: "white",
                            cursor: "pointer",
                        }}
                    >
                        ×
                    </button>
                </div>
            )}

            {user ? (
                <>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 16,
                        }}
                    >
                        <h1>Technology Support Request System</h1>
                        <div>
                            <span style={{ marginRight: 16 }}>Logged in as: {user.email}</span>
                            <button onClick={handleLogout}>Logout</button>
                        </div>
                    </div>

                    {(userTickets.length > 0 || assignedTickets.length > 0) && (
                        <div style={{ marginBottom: 24 }}>
                            <h2>Your Tickets</h2>
                            <div
                                style={{
                                    display: "flex",
                                    gap: 24,
                                    alignItems: "flex-start",
                                }}
                            >
                                {userTickets.length > 0 && (
                                    <div
                                        style={{
                                            flex: 1,
                                            border: "1px solid #ddd",
                                            borderRadius: 8,
                                            padding: 16,
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                marginBottom: 16,
                                            }}
                                        >
                                            <h3>Created By You</h3>
                                            <select
                                                value={createdFilter}
                                                onChange={(e) => setCreatedFilter(e.target.value)}
                                                style={{ padding: "6px 12px", borderRadius: 4 }}
                                            >
                                                {filterOptions.map((option) => (
                                                    <option key={`created-${option.value}`} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                                                gap: 16,
                                            }}
                                        >
                                            {filterTickets(userTickets, createdFilter).map((ticket) => (
                                                <div
                                                    key={ticket.ticket_no}
                                                    style={{
                                                        border: "1px solid #eee",
                                                        borderRadius: 8,
                                                        padding: 16,
                                                        backgroundColor: "#f9f9f9",
                                                    }}
                                                >
                                                    <h4 style={{ marginTop: 0 }}>
                                                        {ticket.category} / {ticket.subcategory}
                                                    </h4>
                                                    <p>
                                                        <strong>Ticket:</strong> {ticket.ticket_no}
                                                    </p>
                                                    <p>
                                                        <strong>Status:</strong>
                                                        <span
                                                            style={{
                                                                padding: "4px 8px",
                                                                borderRadius: 4,
                                                                color: "white",
                                                                backgroundColor:
                                                                    ticket.Done === true
                                                                        ? "#4CAF50"
                                                                        : ticket.Done === false
                                                                            ? "#f44336"
                                                                            : "#FF9800",
                                                                marginLeft: 8,
                                                            }}
                                                        >
                                                            {ticket.Done === true
                                                                ? "Completed"
                                                                : ticket.Done === false
                                                                    ? "Rejected"
                                                                    : "Pending"}
                                                        </span>
                                                    </p>
                                                    <p>
                                                        <strong>Submitted:</strong> {ticket.submission_date}
                                                    </p>
                                                    <a
                                                        href={`/scitech-support-app/#/request/${ticket.ticket_no}`}
                                                        style={{
                                                            color: "#2196F3",
                                                            textDecoration: "none",
                                                            fontWeight: "bold",
                                                        }}
                                                    >
                                                        → View Details
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {assignedTickets.length > 0 && (
                                    <div
                                        style={{
                                            flex: 1,
                                            border: "1px solid #ddd",
                                            borderRadius: 8,
                                            padding: 16,
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                marginBottom: 16,
                                            }}
                                        >
                                            <h3>Awaiting Action From You</h3>
                                            <select
                                                value={assignedFilter}
                                                onChange={(e) => setAssignedFilter(e.target.value)}
                                                style={{ padding: "6px 12px", borderRadius: 4 }}
                                            >
                                                {filterOptions.map((option) => (
                                                    <option key={`assigned-${option.value}`} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                                                gap: 16,
                                            }}
                                        >
                                            {filterTickets(assignedTickets, assignedFilter).map((ticket) => (
                                                <div
                                                    key={ticket.ticket_no}
                                                    style={{
                                                        border: "1px solid #eee",
                                                        borderRadius: 8,
                                                        padding: 16,
                                                        backgroundColor: "#f9f9f9",
                                                    }}
                                                >
                                                    <h4 style={{ marginTop: 0 }}>
                                                        {ticket.category} / {ticket.subcategory}
                                                    </h4>
                                                    <p>
                                                        <strong>Ticket:</strong> {ticket.ticket_no}
                                                    </p>
                                                    <p>
                                                        <strong>Requestor:</strong> {ticket.full_name}
                                                    </p>
                                                    <p>
                                                        <strong>Status:</strong>
                                                        <span
                                                            style={{
                                                                padding: "4px 8px",
                                                                borderRadius: 4,
                                                                color: "white",
                                                                backgroundColor:
                                                                    ticket.Done === true
                                                                        ? "#4CAF50"
                                                                        : ticket.Done === false
                                                                            ? "#f44336"
                                                                            : "#FF9800",
                                                                marginLeft: 8,
                                                            }}
                                                        >
                                                            {ticket.Done === true
                                                                ? "Completed"
                                                                : ticket.Done === false
                                                                    ? "Rejected"
                                                                    : "Pending"}
                                                        </span>
                                                    </p>
                                                    <a
                                                        href={`/scitech-support-app/#/request/${ticket.ticket_no}`}
                                                        style={{
                                                            color: "#2196F3",
                                                            textDecoration: "none",
                                                            fontWeight: "bold",
                                                        }}
                                                    >
                                                        → View Details
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {isAdmin && (
                        <div style={{ marginBottom: 24 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                <h2>Admin Dashboard</h2>
                                <button
                                    onClick={fetchAllTickets}
                                    style={{
                                        padding: "8px 16px",
                                        backgroundColor: "#2196F3",
                                        color: "white",
                                        border: "none",
                                        borderRadius: 4,
                                        cursor: "pointer",
                                    }}
                                >
                                    Refresh All Tickets
                                </button>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                                <h3>All Tickets</h3>
                                <select
                                    value={adminFilter}
                                    onChange={(e) => setAdminFilter(e.target.value)}
                                    style={{ padding: "6px 12px", borderRadius: 4 }}
                                >
                                    {filterOptions.map((option) => (
                                        <option key={`admin-${option.value}`} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                                gap: 16,
                            }}>
                                {filterTickets(allTickets, adminFilter).map((ticket) => (
                                    <div
                                        key={ticket.ticket_no}
                                        style={{
                                            border: "1px solid #eee",
                                            borderRadius: 8,
                                            padding: 16,
                                            backgroundColor: "#f9f9f9",
                                        }}
                                    >
                                        <h4 style={{ marginTop: 0 }}>
                                            {ticket.category} / {ticket.subcategory}
                                        </h4>
                                        <p><strong>Requestor:</strong> {ticket.full_name}</p>
                                        <p><strong>Email:</strong> {ticket.university_email}</p>
                                        <p><strong>Awaiting Action From:</strong> {ticket.assigned_to || "Unassigned"}</p>
                                        <p>
                                            <strong>Status:</strong>
                                            <span
                                                style={{
                                                    padding: "4px 8px",
                                                    borderRadius: 4,
                                                    color: "white",
                                                    backgroundColor:
                                                        ticket.Done === true
                                                            ? "#4CAF50"
                                                            : ticket.Done === false
                                                                ? "#f44336"
                                                                : ticket.assigned_to
                                                                    ? "#FF9800"
                                                                    : "#9E9E9E",
                                                    marginLeft: 8,
                                                }}
                                            >
                                                {ticket.Done === true
                                                    ? "Completed"
                                                    : ticket.Done === false
                                                        ? "Rejected"
                                                        : ticket.assigned_to
                                                            ? "Assigned"
                                                            : "Backlog"}
                                            </span>
                                        </p>
                                        <p><strong>Submitted:</strong> {ticket.submission_date}</p>
                                        <a
                                            href={`/scitech-support-app/#/request/${ticket.ticket_no}`}
                                            style={{
                                                color: "#2196F3",
                                                textDecoration: "none",
                                                fontWeight: "bold",
                                            }}
                                        >
                                            → View Details
                                        </a>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div
                        style={{
                            border: "1px solid #ccc",
                            borderRadius: 8,
                            marginBottom: 16,
                            padding: 16,
                        }}
                    >
                        <h2>New Support Request</h2>
                        <select
                            value={selectedCategory}
                            onChange={(e) => {
                                setSelectedCategory(e.target.value);
                                setSelectedSubcategory("");
                            }}
                            style={{ width: "100%", padding: 8, marginBottom: 8 }}
                        >
                            <option value="">Select Category</option>
                            {Object.keys(categories).map((category) => (
                                <option key={category} value={category}>
                                    {category}
                                </option>
                            ))}
                        </select>
                        {selectedCategory && (
                            <select
                                style={{ width: "100%", padding: 8 }}
                                value={selectedSubcategory}
                                onChange={(e) => setSelectedSubcategory(e.target.value)}
                            >
                                <option value="">Select Subcategory</option>
                                {categories[selectedCategory].map((sub) => (
                                    <option key={sub} value={sub}>
                                        {sub}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {selectedSubcategory && (
                        <form
                            key={formKey}
                            onSubmit={handleSubmit}
                            style={{
                                border: "1px solid #ccc",
                                borderRadius: 8,
                                padding: 16,
                            }}
                        >
                            <h3>Request Details</h3>
                            {getFormFields().map((field) => (
                                <div key={field.name} style={{ marginBottom: 12 }}>
                                    <label style={{ display: "block", marginBottom: 4 }}>
                                        {field.label}
                                    </label>
                                    {field.fixed === true || (typeof field.fixed === 'function' && field.fixed(formData.email)) ? (
                                        <input
                                            name={field.name}
                                            value={
                                                field.name === "fullName" ? formData.fullName || "" :
                                                    field.name === "email" ? formData.email || "" :
                                                        field.fixed === true ? field.fixed : ""
                                            }
                                            readOnly
                                            style={{ width: "100%", padding: 8 }}
                                        />
                                    ) : field.auto ? (
                                        <input
                                            name={field.name}
                                            type="text"
                                            value={
                                                field.name === "submissionDate"
                                                    ? getTimestamp()
                                                    : formData[field.name] || ""
                                            }
                                            readOnly
                                            style={{ width: "100%", padding: 8 }}
                                        />
                                    ) : field.type === "textarea" ? (
                                        <textarea
                                            name={field.name}
                                            placeholder={field.label}
                                            onChange={handleInputChange}
                                            value={formData[field.name] || ""}
                                            style={{ width: "100%", padding: 8, minHeight: 100 }}
                                        />
                                    ) : field.type === "file" ? (
                                        <input
                                            type={field.type}
                                            name={field.name}
                                            onChange={handleInputChange}
                                            style={{ width: "100%", padding: 8 }}
                                        />
                                    ) : (
                                        <input
                                            type={field.type}
                                            name={field.name}
                                            placeholder={field.label}
                                            onChange={handleInputChange}
                                            value={formData[field.name] || ""}
                                            style={{ width: "100%", padding: 8 }}
                                        />
                                    )}
                                </div>
                            ))}
                            <button
                                type="submit"
                                style={{
                                    backgroundColor: "#4CAF50",
                                    color: "white",
                                    border: "none",
                                    padding: "10px 20px",
                                    borderRadius: 4,
                                    cursor: "pointer",
                                }}
                            >
                                Submit Request
                            </button>
                        </form>
                    )}
                </>
            ) : (
                <div style={{ textAlign: "center", padding: 40 }}>
                    <h1>Support Request System</h1>
                    <p>Please login to access the support request system</p>

                    {showAuthForm ? (
                        <div
                            style={{
                                maxWidth: 400,
                                margin: "0 auto",
                                border: "1px solid #ddd",
                                borderRadius: 8,
                                padding: 20,
                            }}
                        >
                            <h2>{authMode === "login" ? "Login" : "Sign Up"}</h2>

                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    const formData = new FormData(e.target);
                                    const email = formData.get("email");
                                    const password = formData.get("password");
                                    const fullName = formData.get("fullName");

                                    if (authMode === "login") {
                                        handleLogin(email, password);
                                    } else {
                                        handleSignup(email, password, fullName);
                                    }
                                }}
                            >
                                {authMode === "signup" && (
                                    <div style={{ marginBottom: 16 }}>
                                        <label style={{ display: "block", marginBottom: 4 }}>
                                            Full Name
                                        </label>
                                        <input
                                            type="text"
                                            name="fullName"
                                            required
                                            style={{ width: "100%", padding: 8 }}
                                            placeholder="Your full name"
                                        />
                                    </div>
                                )}
                                <div style={{ marginBottom: 16 }}>
                                    <label style={{ display: "block", marginBottom: 4 }}>
                                        University Email
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        required
                                        style={{ width: "100%", padding: 8 }}
                                        placeholder="your@uni.canberra.edu.au"
                                    />
                                </div>

                                <div style={{ marginBottom: 16 }}>
                                    <label style={{ display: "block", marginBottom: 4 }}>
                                        Password
                                    </label>
                                    <input
                                        type="password"
                                        name="password"
                                        required
                                        style={{ width: "100%", padding: 8 }}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    style={{
                                        width: "100%",
                                        padding: 10,
                                        backgroundColor: "#2196F3",
                                        color: "white",
                                        border: "none",
                                        borderRadius: 4,
                                        cursor: "pointer",
                                        marginBottom: 16,
                                    }}
                                >
                                    {authMode === "login" ? "Login" : "Sign Up"}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}
                                    style={{
                                        width: "100%",
                                        padding: 10,
                                        backgroundColor: "transparent",
                                        color: "#2196F3",
                                        border: "1px solid #2196F3",
                                        borderRadius: 4,
                                        cursor: "pointer",
                                    }}
                                >
                                    {authMode === "login"
                                        ? "Need an account? Sign Up"
                                        : "Already have an account? Login"}
                                </button>
                            </form>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowAuthForm(true)}
                            style={{
                                padding: "10px 20px",
                                backgroundColor: "#2196F3",
                                color: "white",
                                border: "none",
                                borderRadius: 4,
                                cursor: "pointer",
                                fontSize: 16,
                            }}
                        >
                            Login / Sign Up
                        </button>
                    )}
                </div>
            )}

            {dialogOpen && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        background: "rgba(0,0,0,0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                    }}
                >
                    <div
                        style={{
                            background: "#fff",
                            padding: 24,
                            borderRadius: 8,
                            maxWidth: 400,
                        }}
                    >
                        <h4>{dialogError ? "Submission Failed" : "Submission Successful"}</h4>
                        <p>
                            {dialogError ? dialogError : "Your request has been submitted successfully."}
                        </p>
                        <button
                            onClick={() => setDialogOpen(false)}
                            style={{
                                padding: "8px 16px",
                                backgroundColor: "#2196F3",
                                color: "white",
                                border: "none",
                                borderRadius: 4,
                                cursor: "pointer",
                                marginTop: 16,
                            }}
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}