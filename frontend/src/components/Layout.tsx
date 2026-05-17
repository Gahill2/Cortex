import { Link, NavLink, Outlet } from "react-router-dom";
import { CortexBrand } from "./brand/CortexBrand";
import { useAuth } from "../context/AuthContext";

export const Layout = () => {
  const { user, logout } = useAuth();

  return (
    <div className="container">
      <header className="header">
        <Link to="/" className="brand">
          <CortexBrand variant="sidebar" />
        </Link>
        <nav>
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/projects">Projects</NavLink>
          <NavLink to="/tasks">Tasks</NavLink>
        </nav>
        <div className="user-meta">
          <span>{user?.fullName}</span>
          <button onClick={logout}>Log out</button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
};
