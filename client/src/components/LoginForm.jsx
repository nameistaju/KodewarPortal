import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, EyeIcon, EyeOffIcon, Loader2Icon, MailIcon, LockIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { getErrorMessage } from '../api/helpers'
import styled from 'styled-components'

const LoginForm = ({ role }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const user = await login(email, password, role)
      navigate(user?.mustChangePassword || user?.forcePasswordChange ? '/change-password' : '/dashboard')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const isAdmin = role === 'admin'

  return (
    <BackgroundContainer>
      <GlassCard className="animate-fade-in text-left">
        <BackLink to="/login">
          <ArrowLeftIcon size={14} /> Back to portals
        </BackLink>

        <CardHeader>
          <LogoWrapper>
            <img
              src={isAdmin ? '/adminLOGO.png' : '/EmployeeLOGO.png'}
              alt="SharpKode Logo"
              className="logo-img"
            />
          </LogoWrapper>
          <WelcomeTitle>{isAdmin ? 'Admin Portal' : 'Welcome Back'}</WelcomeTitle>
          <WelcomeSubTitle>
            {isAdmin ? 'Sign in to manage organization' : 'Sign in to access your employee account'}
          </WelcomeSubTitle>
        </CardHeader>

        <FormContainer onSubmit={handleSubmit}>
          <FieldGroup>
            <Label htmlFor="login-email">Email Address</Label>
            <NeumorphicInputWrapper>
              <IconContainer>
                <MailIcon size={18} />
              </IconContainer>
              <StyledInput
                id="login-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder={isAdmin ? 'admin@sharpkode.com' : 'employee@sharpkode.com'}
              />
            </NeumorphicInputWrapper>
          </FieldGroup>

          <FieldGroup>
            <Label htmlFor="login-password">Password</Label>
            <NeumorphicInputWrapper>
              <IconContainer>
                <LockIcon size={18} />
              </IconContainer>
              <StyledInput
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••••••"
              />
              <EyeButton
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
              </EyeButton>
            </NeumorphicInputWrapper>
          </FieldGroup>

          <SubmitButton type="submit" disabled={loading}>
            {loading ? (
              <Loader2Icon className="animate-spin h-5 w-5 mr-2" />
            ) : null}
            <span>Sign In</span>
          </SubmitButton>
        </FormContainer>
      </GlassCard>
    </BackgroundContainer>
  )
}

const BackgroundContainer = styled.div`
  height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-image: url('/bgforLogin_mobile.png');
  overflow: hidden;

  @media (min-width: 768px) {
    background-image: url('/bgforLogin_desktop.png');
    background-position: right center;
    justify-content: flex-start;
    padding-left: 8%;
    padding: 24px;
  }
`

const GlassCard = styled.div`
  width: 100%;
  max-width: 420px;
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 28px;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.15);
  padding: 24px 20px;
  box-sizing: border-box;
  color: #ffffff;

  @media (min-width: 768px) {
    max-width: 440px;
    padding: 32px 28px;
  }
`

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.7);
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  margin-bottom: 12px;
  transition: color 0.2s ease;

  &:hover {
    color: #2ea8ff;
  }
`

const CardHeader = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 20px;
`

const LogoWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;

  .logo-img {
    height: 75px;
    width: auto;
    object-fit: contain;
    mix-blend-mode: screen;
    transition: all 0.3s ease;

    @media (min-width: 768px) {
      height: 95px;
    }
  }
`

const WelcomeTitle = styled.h1`
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 22px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  letter-spacing: -0.02em;

  @media (min-width: 768px) {
    font-size: 26px;
  }
`

const WelcomeSubTitle = styled.p`
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 4px;
  margin-bottom: 0;
`

const FormContainer = styled.form`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const Label = styled.label`
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 600;
  color: #2ea8ff;
  text-transform: uppercase;
  letter-spacing: 0.1em;
`

const NeumorphicInputWrapper = styled.div`
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  background: rgba(10, 15, 29, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: inset 2px 2px 6px rgba(0, 0, 0, 0.6), inset -2px -2px 6px rgba(255, 255, 255, 0.03);
  transition: all 0.25s ease;

  &:focus-within {
    border-color: #2ea8ff;
    box-shadow: inset 2px 2px 6px rgba(0, 0, 0, 0.5), 0 0 0 3px rgba(46, 168, 255, 0.25);
    background: rgba(10, 15, 29, 0.85);
  }

  &:hover:not(:focus-within) {
    border-color: rgba(255, 255, 255, 0.2);
  }
`

const IconContainer = styled.div`
  padding-left: 14px;
  color: rgba(255, 255, 255, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
`

const StyledInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  background: transparent;
  border: none;
  color: #ffffff;
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 500;

  &::placeholder {
    color: rgba(255, 255, 255, 0.35);
  }

  &:focus {
    outline: none;
  }
`

const EyeButton = styled.button`
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease;

  &:hover {
    color: #2ea8ff;
  }
`

const SubmitButton = styled.button`
  width: 100%;
  padding: 13px;
  margin-top: 8px;
  background: linear-gradient(135deg, #2ea8ff, #1f7ae0);
  border: none;
  border-radius: 16px;
  color: #ffffff;
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 4px 20px rgba(46, 168, 255, 0.3);

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #3bb0ff, #1d72d6);
    box-shadow: 0 8px 25px rgba(46, 168, 255, 0.45);
  }

  &:active:not(:disabled) {
    transform: scale(0.98);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    box-shadow: none;
  }
`

export default LoginForm
