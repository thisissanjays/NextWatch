import { useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useAuthContext } from "../contexts/useAuthContext"
import { updateUserProfile, uploadAvatar } from "../services/profile"
import { signOut } from "../services/auth"
import "../css/Profile.css"

function Profile() {
  const { user, profile, refreshProfile } = useAuthContext()
  const [displayName, setDisplayName] = useState(
    profile?.display_name || user?.user_metadata?.display_name || ""
  )
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [loading, setLoading] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const fileInputRef = useRef(null)
  const navigate = useNavigate()

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    if (loading) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      await updateUserProfile(user.id, { display_name: displayName })
      await refreshProfile()
      setSuccess("Profile updated successfully!")
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be less than 2MB')
      return
    }

    setAvatarLoading(true)
    setError(null)

    try {
      const avatarUrl = await uploadAvatar(user.id, file)
      await updateUserProfile(user.id, { avatar_url: avatarUrl })
      await refreshProfile()
      setSuccess("Avatar updated!")
    } catch (err) {
      setError(err.message)
    } finally {
      setAvatarLoading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/')
    } catch (err) {
      setError(err.message)
    }
  }

  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url

  return (
    <div className="profile-page">
      <div className="profile-container">
        <h2>Your Profile</h2>

        {error && <div className="profile-error">{error}</div>}
        {success && <div className="profile-success">{success}</div>}

        <div className="avatar-section">
          <div className="avatar-wrapper">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="avatar-image" />
            ) : (
              <div className="avatar-placeholder">
                {displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase()}
              </div>
            )}
            {avatarLoading && <div className="avatar-loading">Uploading...</div>}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="avatar-button"
            disabled={avatarLoading}
            type="button"
          >
            Change Avatar
          </button>
        </div>

        <form onSubmit={handleUpdateProfile} className="profile-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={user?.email || ""}
              disabled
              className="input-disabled"
            />
          </div>

          <div className="form-group">
            <label htmlFor="displayName">Display Name</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name"
            />
          </div>

          <button type="submit" className="profile-button" disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </form>

        <div className="profile-actions">
          <button onClick={handleSignOut} className="signout-button" type="button">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}

export default Profile
