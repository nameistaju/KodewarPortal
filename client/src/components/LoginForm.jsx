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
      <CardWrapper className="animate-fade-in">
        <GlassCard className="text-left">
          <BackLink to="/login">
            <ArrowLeftIcon size={14} /> Back to portals
          </BackLink>

          <CardHeader>
            <BrandTitleContainer>
              <BrandWordmark>KODEWAR</BrandWordmark>
              <ProductSubtitle>WORKFORCE</ProductSubtitle>
            </BrandTitleContainer>

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
                <Loader2Icon className="animate-spin h-5 w-5 mr-2 text-black" />
              ) : null}
              <span>Sign In</span>
            </SubmitButton>
          </FormContainer>
        </GlassCard>
      </CardWrapper>
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
  background-image: linear-gradient(rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0.75)), url('/bgforLogin_mobile.png');
  filter: grayscale(100%);
  overflow: hidden;

  @media (min-width: 768px) {
    background-image: linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url('/bgforLogin_desktop.png');
    background-position: right center;
    justify-content: flex-start;
    padding-left: 8%;
    padding: 24px;
  }
`

const CardWrapper = styled.div`
  position: relative;
  width: 100%;
  max-width: 420px;
  border-radius: 26px;
  padding: 1.5px;
  background: transparent;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;

  @media (min-width: 768px) {
    max-width: 440px;
  }

  &::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: conic-gradient(
      transparent,
      rgba(255, 255, 255, 0.15),
      rgba(255, 255, 255, 0.5),
      #ffffff,
      transparent 60%
    );
    animation: rotateMonochromeGlow 6s linear infinite;
    pointer-events: none;
    z-index: 0;
  }

  @keyframes rotateMonochromeGlow {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`

const GlassCard = styled.div`
  position: relative;
  z-index: 1;
  width: 100%;
  background: #0a0a0a;
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 24px;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8), inset 0 1px 1px rgba(255, 255, 255, 0.1);
  padding: 24px 20px;
  box-sizing: border-box;
  color: #ffffff;

  @media (min-width: 768px) {
    padding: 32px 28px;
  }
`

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #b0b0b0;
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  margin-bottom: 16px;
  transition: color 0.2s ease;

  &:hover {
    color: #ffffff;
  }
`

const CardHeader = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 24px;
`

const BrandTitleContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 12px;
`

const BrandWordmark = styled.span`
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 26px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 0.18em;
  line-height: 1;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
`

const ProductSubtitle = styled.span`
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 10px;
  font-weight: 600;
  color: #999999;
  letter-spacing: 0.3em;
  margin-top: 4px;
  text-transform: uppercase;
`

const WelcomeTitle = styled.h1`
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 22px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  letter-spacing: -0.02em;

  @media (min-width: 768px) {
    font-size: 24px;
  }
`

const WelcomeSubTitle = styled.p`
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 13px;
  color: #afafaf;
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
  letter-spacing: 0.1em;
`

const NeumorphicInputWrapper = styled.div`
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  background: #151515;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  box-shadow: inset 2px 2px 6px rgba(0, 0, 0, 0.6), inset -2px -2px 6px rgba(255, 255, 255, 0.02);
  transition: all 0.25s ease;

  &:focus-within {
    border-color: rgba(255, 255, 255, 0.5);
    box-shadow: inset 2px 2px 6px rgba(0, 0, 0, 0.5), 0 0 0 3px rgba(255, 255, 255, 0.15);
    background: #1c1c1c;
  }

  &:hover:not(:focus-within) {
    border-color: rgba(255, 255, 255, 0.25);
  }
`

const IconContainer = styled.div`
  padding-left: 14px;
  color: #999999;
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
    color: #777777;
  }

  &:focus {
    outline: none;
  }
`

const EyeButton = styled.button`
  background: none;
  border: none;
  color: #999999;
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

const SubmitButton = styled.button`
  width: 100%;
  padding: 13px;
  margin-top: 8px;
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
  box-shadow: 0 4px 15px rgba(255, 255, 255, 0.15);

  &:hover:not(:disabled) {
    background: #e5e5e5;
    color: #000000;
    box-shadow: 0 6px 20px rgba(255, 255, 255, 0.25);
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
