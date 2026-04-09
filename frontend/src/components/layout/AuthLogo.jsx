import * as React from 'react';
import '../../assets/bg-gradient.css';
import logo from '../../assets/logo.png';;



function AuthLogo() {
    return (
        <div className="auth-logo-row">
            <img src={logo} alt="Logo" id='auth-logo-image' />
        </div>
    );
}

export default AuthLogo;

