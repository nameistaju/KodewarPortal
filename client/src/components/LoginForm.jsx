import React, { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { EyeIcon, EyeOffIcon, Loader2Icon, MailIcon, LockIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { getErrorMessage } from '../api/helpers'
import styled from 'styled-components'
import Loading from './Loading'

const LoginForm = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [targetPath, setTargetPath] = useState(null)
  const { user, login } = useAuth()
  const navigate = useNavigate()

  // If already logged in, redirect based on verified user role
  if (user) {
    const target = (user.mustChangePassword || user.forcePasswordChange)
      ? '/change-password'
      : (user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard')
    return <Navigate to={target} replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const authUser = await login(email, password)
      const mustChange = authUser?.mustChangePassword || authUser?.forcePasswordChange
      const path = mustChange
        ? '/change-password'
        : (authUser?.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard')
      setTargetPath(path)
      setIsLoggingIn(true)
    } catch (error) {
      toast.error(getErrorMessage(error) || 'Invalid email or password.')
      setLoading(false)
    }
  }

  const handleForgotPassword = (e) => {
    e.preventDefault()
    toast.info('Please contact your system administrator to reset your password.')
  }

  if (isLoggingIn) {
    return <Loading onComplete={() => navigate(targetPath || '/dashboard')} />
  }

  return (
    <BackgroundContainer>
      <CardWrapper className="animate-fade-in">
        <GlassCard className="text-left">
          <CardHeader>
            <LogoImage
              src="/whiteLogo.png"
              alt="KODEWAR Logo"
            />
            <WelcomeTitle>Sign In</WelcomeTitle>
            <WelcomeSubTitle>Enter your credentials to access your account</WelcomeSubTitle>
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
                  placeholder="name@company.com"
                  disabled={loading}
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
                  disabled={loading}
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

            <ForgotPasswordRow>
              <ForgotPasswordButton type="button" onClick={handleForgotPassword}>
                Forgot password?
              </ForgotPasswordButton>
            </ForgotPasswordRow>

            <SubmitButton type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2Icon className="animate-spin h-5 w-5 mr-2 text-black" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </SubmitButton>
          </FormContainer>
        </GlassCard>
      </CardWrapper>
    </BackgroundContainer>
  )
}

const BackgroundContainer = styled.div`
  min-height: 100vh;
  width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
  background-image: url('/bgforLogin_mobile.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  overflow-x: hidden;
  overflow-y: auto;

  @media (min-width: 768px) {
    background-image: url('/bgforLogin_desktop.png');
    background-position: center;
    justify-content: flex-start;
    padding-left: 7%;
    padding-right: 24px;
  }
`

const CardWrapper = styled.div`
  position: relative;
  width: min(92%, 420px);
  margin: 0 auto;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;

  @media (min-width: 768px) {
    width: 100%;
    max-width: 440px;
    margin: 0;
  }
`

const GlassCard = styled.div`
  position: relative;
  z-index: 1;
  width: 100%;
  background: rgba(10, 10, 10, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 24px;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6);
  padding: 28px 24px;
  box-sizing: border-box;
  color: #ffffff;

  @media (min-width: 768px) {
    padding: 36px 30px;
  }
`

const CardHeader = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 24px;
`

const LogoImage = styled.img`
  height: 44px;
  width: auto;
  object-fit: contain;
  margin-bottom: 12px;
  mix-blend-mode: screen;

  @media (min-width: 768px) {
    height: 52px;
  }
`

const BrandTitleContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 12px;
`

const BrandWordmark = styled.span`
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 24px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 0.18em;
  line-height: 1;
`

const ProductSubtitle = styled.span`
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 10px;
  font-weight: 600;
  color: #999999;
  letter-spacing: 0.28em;
  margin-top: 4px;
  text-transform: uppercase;
`

const WelcomeTitle = styled.h1`
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 20px;
  font-weight: 700;
  color: #ffffff;
  margin: 4px 0 0;
  letter-spacing: -0.01em;

  @media (min-width: 768px) {
    font-size: 22px;
  }
`

const WelcomeSubTitle = styled.p`
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 12px;
  color: #a3a3a3;
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
  color: #cccccc;
  text-transform: uppercase;
  letter-spacing: 0.08em;
`

const NeumorphicInputWrapper = styled.div`
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  background: #141414;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  transition: all 0.2s ease;

  &:focus-within {
    border-color: rgba(255, 255, 255, 0.4);
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
    background: #1a1a1a;
  }

  &:hover:not(:focus-within) {
    border-color: rgba(255, 255, 255, 0.25);
  }
`

const IconContainer = styled.div`
  padding-left: 14px;
  color: #888888;
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
    color: #666666;
  }

  &:focus {
    outline: none;
  }
`

const EyeButton = styled.button`
  background: none;
  border: none;
  color: #888888;
  cursor: pointer;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease;

  &:hover {
    color: #ffffff;
  }
`

const ForgotPasswordRow = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: -6px;
`

const ForgotPasswordButton = styled.button`
  background: none;
  border: none;
  color: #999999;
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  padding: 0;
  transition: color 0.2s ease;

  &:hover {
    color: #ffffff;
    text-decoration: underline;
  }
`

const SubmitButton = styled.button`
  width: 100%;
  padding: 13px;
  margin-top: 4px;
  background: #ffffff;
  border: none;
  border-radius: 14px;
  color: #000000;
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 0 4px 15px rgba(255, 255, 255, 0.12);

  &:hover:not(:disabled) {
    background: #e5e5e5;
    color: #000000;
    box-shadow: 0 6px 20px rgba(255, 255, 255, 0.2);
  }

  &:active:not(:disabled) {
    background: #cccccc;
    transform: scale(0.98);
  }

  &:disabled {
    background: #333333;
    color: #777777;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }
`

export default LoginForm
