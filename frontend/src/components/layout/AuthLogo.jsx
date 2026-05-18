import * as React from 'react';
import '../../assets/bg-gradient.css';
import UnigranLogo from './UnigranLogo';



function AuthLogo() {
    return (
        <div className="auth-logo-row">
            <UnigranLogo size={52} className="auth-logo-svg" />
            <div>
                <div className="auth-logo-title">UNIGRAN</div>
                <div className="auth-logo-caption">Rede Social Academica</div>
            </div>
        </div>
    );
}

export default AuthLogo;

