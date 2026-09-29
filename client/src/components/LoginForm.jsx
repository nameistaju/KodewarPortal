import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, EyeIcon, EyeOffIcon, Loader2Icon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { getErrorMessage } from '../api/helpers'
import styled from 'styled-components'

const LoginForm = ({ role }) => {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const { login } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true)
        try {
            const user = await login(email, password, role)
            navigate(user?.mustChangePassword || user?.forcePasswordChange ? "/change-password" : "/dashboard")
        } catch (error) {
            toast.error(getErrorMessage(error))
        } finally {
            setLoading(false)
        }
    }

    return (
        <BackgroundContainer>
            <GlassCard className="animate-fade-in text-left">
                <BackLink to='/login'>
                    <ArrowLeftIcon size={14}/> Back to portals
                </BackLink>

                <CardHeader>
                    <LogoWrapper>
                        <img 
                            src={role === 'admin' ? '/adminLOGO.png' : '/EmployeeLOGO.png'} 
                            alt="SharpKode Logo" 
                            className="logo-img" 
                        />
                    </LogoWrapper>
                    <WelcomeTitle>Welcome Back</WelcomeTitle>
                </CardHeader>

                <form className='space-y-4' onSubmit={handleSubmit}>
                    <div>
                        <Label htmlFor="login-email">Email Address</Label>
                        <Input 
                            id="login-email"
                            name="email"
                            type="email" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            required 
                            autoComplete='email'
                            placeholder='name@sharpkode.com'
                        />
                    </div>
                    <div>
                        <Label htmlFor="login-password">Password</Label>
                        <InputWrapper>
                            <Input 
                                id="login-password"
                                name="password"
                                type={showPassword ? 'text' : 'password'} 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)} 
                                required 
                                autoComplete='current-password'
                                placeholder='Password'
                            />
                            <EyeButton 
                                type='button' 
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                title={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeOffIcon size={18}/> : <EyeIcon size={18}/>}
                            </EyeButton>
                        </InputWrapper>
                    </div>
                    <SubmitButton type='submit' disabled={loading}>
                        {loading && <Loader2Icon className="animate-spin h-4 w-4 mr-2"/>}
                        Sign In
                    </SubmitButton>
                </form>
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
  padding: 12px;
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
    padding-left: 10%;
    padding: 24px;
  }
`;

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.7);
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  margin-bottom: 8px;
  transition: color 0.2s ease;

  &:hover {
    color: #ffffff;
  }
`;

const CardHeader = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 12px;
`;

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
      height: 100px;
    }
  }
`;

const WelcomeTitle = styled.h1`
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 22px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  letter-spacing: -0.02em;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);

  @media (min-width: 768px) {
    font-size: 26px;
  }
`;

const Label = styled.label`
  display: block;
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 600;
  color: #2EA8FF;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
`;

const InputWrapper = styled.div`
  position: relative;
  width: 100%;
`;

const Input = styled.input`
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  background: rgba(15, 23, 42, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  color: #ffffff;
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;

  &::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  &:focus {
    outline: none;
    border-color: #00AEEF;
    box-shadow: 0 0 0 4px rgba(0, 174, 239, 0.15);
    background: rgba(15, 23, 42, 0.6);
  }

  &:hover {
    border-color: rgba(255, 255, 255, 0.3);
  }

  @media (min-width: 768px) {
    padding: 12px 14px;
  }
`;

const EyeButton = styled.button`
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease;

  &:hover {
    color: #ffffff;
  }
`;

const SubmitButton = styled.button`
  width: 100%;
  padding: 11px;
  margin-top: 4px;
  background: linear-gradient(135deg, #2EA8FF, #1F7AE0);
  border: none;
  border-radius: 14px;
  color: #ffffff;
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 4px 12px rgba(46, 168, 255, 0.15);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 30px rgba(46, 168, 255, 0.25);
  }

  &:active {
    transform: scale(0.98);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  @media (min-width: 768px) {
    padding: 12px;
    margin-top: 8px;
    font-size: 15px;
    border-radius: 16px;
  }
`;

const GlassCard = styled.div`
  width: 100%;
  max-width: 400px;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  padding: 20px 18px;
  box-sizing: border-box;
  color: #ffffff;

  @media (min-width: 768px) {
    max-width: 440px;
    padding: 28px 24px;
  }
`;

export default LoginForm
