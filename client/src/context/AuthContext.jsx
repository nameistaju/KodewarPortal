/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/axios";
import { unwrap } from "../api/helpers";


const AuthContext = createContext(null)

export function AuthProvider({children}){
    const [user, setUser] = useState(null)
    const [token, setToken] = useState(localStorage.getItem("token"))
    const [loading, setLoading] = useState(true)

    const refreshSession = async () => {
        const storedToken = localStorage.getItem("token")
        const storedRefreshToken = localStorage.getItem("refreshToken")

        const finish = (userVal = null, tokenVal = null) => {
            setUser(userVal)
            if (tokenVal !== undefined) setToken(tokenVal)
            setLoading(false)
        }

        if(!storedToken && !storedRefreshToken){
            finish(null, null);
            return;
        }
        try {
            const data = unwrap(await api.get("/auth/me"))
            finish(data.user, storedToken)
        } catch {
            // Token is invalid, clear it
            localStorage.removeItem("token")
            localStorage.removeItem("refreshToken")
            finish(null, null)
        }
    }

    useEffect(() => {
        refreshSession()

        const handleStorageChange = (e) => {
            if (e.key === "token" && !e.newValue) {
                setUser(null)
                setToken(null)
            }
        }
        window.addEventListener("storage", handleStorageChange)
        return () => window.removeEventListener("storage", handleStorageChange)
    }, [])

    const login = async (email, password) => {
        const data = unwrap(await api.post("/auth/login", { email, password }))
        localStorage.setItem("token", data.accessToken || data.token)
        localStorage.setItem("refreshToken", data.refreshToken)
        setToken(data.accessToken || data.token);
        setUser(data.user);
        setLoading(false);
        return data.user;
    }

    const logout = async () => {
        const refreshToken = localStorage.getItem("refreshToken");
        const accessToken = localStorage.getItem("token");

        try {
            if (accessToken) {
                await api.post("/auth/logout", { refreshToken }, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
            }
        } catch (error) {
            console.error("Server session revocation could not be confirmed during logout", error);
        } finally {
            localStorage.removeItem("token")
            localStorage.removeItem("refreshToken")
            localStorage.removeItem("userRole")
            setToken(null);
            setUser(null);
            setLoading(false);
        }

        window.location.assign("/login");
    }
    const value = {user, token, loading, login, logout, refreshSession, setUser}

    return <AuthContext.Provider value={value}>
        {children}
    </AuthContext.Provider>
}

export function useAuth(){
    const ctx = useContext(AuthContext);
    if(!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
