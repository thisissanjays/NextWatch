import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import "../css/Auth.css"

function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/')
    }, 1000)

    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-loading">
          <p>Completing sign in...</p>
        </div>
      </div>
    </div>
  )
}

export default AuthCallback
