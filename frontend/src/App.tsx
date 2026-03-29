import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PrivateRoute from "@/components/PrivateRoute";
import LoadingSkeleton from "@/components/LoadingSkeleton";

const Dashboard = lazy(() => import("@/components/Dashboard"));
const SectorDetail = lazy(() => import("@/components/SectorDetail"));
const IdeaReport = lazy(() => import("@/components/IdeaReport"));
const IdeaGenerator = lazy(() => import("@/components/IdeaGenerator"));
const VisaCompliance = lazy(() => import("@/components/VisaCompliance"));
const FundingTracker = lazy(() => import("@/components/FundingTracker"));
const UserDashboard = lazy(() => import("@/components/UserDashboard"));
const VisaResources = lazy(() => import("@/components/VisaResources"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));

function PageLoader() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <LoadingSkeleton variant="card" count={3} />
    </div>
  );
}

export default function App() {
  const { loadUser, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) loadUser();
  }, [isAuthenticated, loadUser]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/sectors/:id" element={<SectorDetail />} />
            <Route path="/ideas/:id" element={<IdeaReport />} />
            <Route path="/funding" element={<FundingTracker />} />
            <Route path="/visa-resources" element={<VisaResources />} />
            <Route path="/generate" element={<PrivateRoute><IdeaGenerator /></PrivateRoute>} />
            <Route path="/visa-check" element={<PrivateRoute><VisaCompliance /></PrivateRoute>} />
            <Route path="/dashboard" element={<PrivateRoute><UserDashboard /></PrivateRoute>} />
            <Route path="*" element={
              <div className="mx-auto max-w-7xl px-4 py-24 text-center">
                <h1 className="text-4xl font-bold text-foreground">404</h1>
                <p className="mt-2 text-muted-foreground">Page not found</p>
                <Link to="/" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Back to dashboard</Link>
              </div>
            } />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
