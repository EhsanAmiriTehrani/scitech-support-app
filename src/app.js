import { useEffect } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import SupportRequestApp from './SupportRequestApp';
import RequestDetails from "./RequestDetails";
import { supabase } from './supabaseClient';
import ResetPassword from './ResetPassword';
import AuthConfirm from './AuthConfirm';

console.log("Supabase URL:", process.env.REACT_APP_SUPABASE_URL);


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
        <HashRouter>
            <Routes>
                <Route path="/" element={<SupportRequestApp />} />
                <Route path="/support-app" element={<SupportRequestApp />} />
                <Route path="/request/:ticketNo" element={<RequestDetails />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/auth/confirm" element={<AuthConfirm />} />

            </Routes>
        </HashRouter>
    );
}
console.log("Supabase URL:", process.env.REACT_APP_SUPABASE_URL);
console.log("Supabase Key:", process.env.REACT_APP_SUPABASE_ANON_KEY);
export default App;
