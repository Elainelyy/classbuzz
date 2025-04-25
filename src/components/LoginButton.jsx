import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';

export default function LoginButton() {
    const { loginWithRedirect, logout, isAuthenticated, user, isLoading } = useAuth0();

    if (isLoading) {
        return <div className="loading-button">Loading...</div>;
    }

    if (isAuthenticated) {
        return (
            <div className="auth-container">
                <span className="user-info">
                    {user.name}
                </span>
                <button
                    className="logout-button"
                    onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                >
                    Log Out
                </button>
            </div >
        );
    }

    return (
        <button
            className="login-button"
            onClick={() => loginWithRedirect()}
        >
            Log In
        </button>
    );
} 