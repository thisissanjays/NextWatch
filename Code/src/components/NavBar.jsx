import { Link } from "react-router-dom";
import "../css/Navbar.css"
import Logo from "../assets/NextWatch.svg"
import { useAuthContext } from "../contexts/useAuthContext"

function NavBar() {
    const { isAuthenticated, user, profile } = useAuthContext()

    const displayName = profile?.display_name ||
                       user?.user_metadata?.display_name ||
                       user?.email?.split('@')[0]

    const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url

    return <nav className="navbar">
        <div className="navbar-brand">
            <Link to="/">
                <img src={Logo} alt="NextWatch Logo" className="logo"/>
            </Link>
        </div>
        <div className="navbar-links">
            <Link to="/" className="nav-link">Home</Link>
            <Link to="/favorites" className="nav-link">Favorites</Link>

            {isAuthenticated ? (
                <Link to="/profile" className="nav-link nav-user">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="nav-avatar" />
                    ) : (
                        <span className="nav-avatar-placeholder">
                            {displayName?.charAt(0)?.toUpperCase()}
                        </span>
                    )}
                    <span className="nav-username">{displayName}</span>
                </Link>
            ) : (
                <Link to="/login" className="nav-link nav-login">Sign In</Link>
            )}
        </div>
    </nav>
}

export default NavBar
