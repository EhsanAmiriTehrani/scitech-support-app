import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import SupportRequestApp from './SupportRequestApp';
import RequestDetails from "./RequestDetails";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client (reuse your existing URL and key)
const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_ANON_KEY
);

function App() {
    useEffect(() => {
        // This runs on every page, including "/"
        supabase.auth.getUser().then(({ data: { user } }) => {
            const lastPage = localStorage.getItem("lastRequestPage");
            if (user && lastPage && window.location.pathname !== lastPage) {
                localStorage.removeItem("lastRequestPage");
                window.location.pathname = lastPage;
            }
        });
    }, []);

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<SupportRequestApp />} />
                <Route path="/request/:ticketNo" element={<RequestDetails />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;