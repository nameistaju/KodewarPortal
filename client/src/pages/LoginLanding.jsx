import React from 'react'
import { Navigate, Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import Loading from "../components/Loading"
import styled from 'styled-components'

const LoginLanding = () => {
    const { user, loading } = useAuth()

    if (loading) return <Loading />
    if (user) return <Navigate to={user.mustChangePassword || user.forcePasswordChange ? "/change-password" : "/dashboard"} />

    return (
        <BackgroundContainer>
            <HeaderSection>
                <img src="/whiteLogo.png" alt="SharpKode Logo" className="h-12 sm:h-14 w-auto object-contain mb-5 float-animation" style={{ mixBlendMode: 'screen' }} />
                <HeroTitle>SharpKode</HeroTitle>
                <SubTitle>Modern Enterprise Platform</SubTitle>
            </HeaderSection>

            <CardsContainer>
                <PortalCard to="/login/admin" className="group">
                    <LogoWrapper>
                        <img src="/adminLOGO.png" alt="Admin Portal Logo" className="portal-logo" />
                    </LogoWrapper>
                    <PortalTag>ADMIN</PortalTag>
                    <ActionText>Continue <span className="arrow">→</span></ActionText>
                </PortalCard>

                <PortalCard to="/login/employee" className="group">
                    <LogoWrapper>
                        <img src="/EmployeeLOGO.png" alt="Employee Portal Logo" className="portal-logo" />
                    </LogoWrapper>
                    <PortalTag>EMPLOYEE</PortalTag>
                    <ActionText>Continue <span className="arrow">→</span></ActionText>
                </PortalCard>
            </CardsContainer>
        </BackgroundContainer>
    )
}

const BackgroundContainer = styled.div`
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-image: url('/bgforLogin_mobile.png');

  @media (min-width: 768px) {
    background-image: url('/bgforLogin_desktop.png');
    background-position: right center;
  }
`;

const HeaderSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 32px;
  z-index: 10;

  @media (min-width: 768px) {
    margin-bottom: 48px;
  }
`;

const HeroTitle = styled.h1`
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 32px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  letter-spacing: -0.025em;
  line-height: 1.1;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);

  @media (min-width: 768px) {
    font-size: 48px;
  }
`;

const SubTitle = styled.p`
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 600;
  color: #42C8FF;
  margin-top: 10px;
  margin-bottom: 0;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);

  @media (min-width: 768px) {
    font-size: 14px;
    letter-spacing: 0.16em;
  }
`;

const CardsContainer = styled.div`
  display: flex;
  flex-direction: row;
  gap: 16px;
  justify-content: center;
  align-items: center;
  width: 100%;
  max-width: 680px;
  z-index: 10;

  @media (min-width: 768px) {
    gap: 32px;
  }
`;

const PortalCard = styled(Link)`
  width: 145px;
  height: 210px;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 24px 16px 20px;
  box-sizing: border-box;
  text-decoration: none;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  cursor: pointer;

  &:hover {
    transform: translateY(-6px) scale(1.02);
    border-color: rgba(66, 200, 255, 0.4);
    background: rgba(255, 255, 255, 0.15);
    box-shadow: 
      0 25px 65px rgba(0, 174, 239, 0.25),
      inset 0 1px 0 rgba(255, 255, 255, 0.25);
  }

  @media (min-width: 768px) {
    width: 260px;
    height: 310px;
    padding: 36px 24px 32px;
  }
`;

const LogoWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;

  .portal-logo {
    height: 48px;
    width: auto;
    object-fit: contain;
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.2));
  }

  ${PortalCard}:hover & .portal-logo {
    transform: scale(1.08);
  }

  @media (min-width: 768px) {
    .portal-logo {
      height: 80px;
    }
  }
`;

const PortalTag = styled.h2`
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
  margin: 12px 0 6px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);

  @media (min-width: 768px) {
    font-size: 24px;
    margin: 20px 0 10px;
  }
`;

const ActionText = styled.span`
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 600;
  color: #42C8FF;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.3s ease;

  .arrow {
    transition: transform 0.3s ease;
  }

  ${PortalCard}:hover & {
    color: #ffffff;
  }

  ${PortalCard}:hover & .arrow {
    transform: translateX(4px);
  }

  @media (min-width: 768px) {
    font-size: 14px;
    gap: 6px;
  }
`;

export default LoginLanding
