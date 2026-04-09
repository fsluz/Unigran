import * as React from 'react';
import illustration from '../../assets/login-illustration.png';
import '../../assets/bg-gradient.css';


function AuthLayout({ children }) {
  return (
    <div className="auth-split-layout">
      <div className="auth-visual-side">
        <div className="auth-gradient-bg">
          <img src={illustration} alt="Comunidade" className="auth-illustration" />
        </div>
      </div>
      <div className="auth-form-side">
        <div className="auth-form-center">
          {children}
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
