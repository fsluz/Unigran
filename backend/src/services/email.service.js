import nodemailer from 'nodemailer';

function createTransporter() {
  const user = String(process.env.EMAIL_USER || process.env.SMTP_USER || '').trim();
  const pass = String(process.env.EMAIL_PASS || process.env.SMTP_PASS || '').trim();
  if (!user || !pass) return null;

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function sendPasswordResetCode(toEmail, code) {
    const transporter = createTransporter();
    if (!transporter) {
      if (process.env.NODE_ENV === 'production') {
        const error = new Error('Email de recuperacao nao configurado. Defina EMAIL_USER e EMAIL_PASS.');
        error.statusCode = 503;
        throw error;
      }
      console.warn('[email] SMTP nao configurado (EMAIL_USER/EMAIL_PASS). Codigo de reset:', code);
      return;
    }

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #f9f9f9; border-radius: 12px; overflow: hidden;">
      <div style="background: #4f46e5; padding: 32px 24px; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 24px; letter-spacing: 1px;">UNIGRAN</h1>
        <p style="color: #c7d2fe; margin: 6px 0 0; font-size: 14px;">Rede Social Universitária</p>
      </div>
      <div style="padding: 32px 24px;">
        <h2 style="color: #1e1b4b; margin: 0 0 12px;">Redefinição de senha</h2>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          Recebemos uma solicitação para redefinir a senha da sua conta.<br/>
          Use o código abaixo para continuar. Ele expira em <strong>10 minutos</strong>.
        </p>
        <div style="background: #ede9fe; border-radius: 10px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 42px; font-weight: 700; letter-spacing: 10px; color: #4f46e5;">${code}</span>
        </div>
        <p style="color: #9ca3af; font-size: 13px; margin: 0;">
          Se você não solicitou a redefinição, ignore este e-mail. Sua senha permanece a mesma.
        </p>
      </div>
      <div style="background: #f3f4f6; padding: 16px 24px; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Unigran. Todos os direitos reservados.</p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Unigram" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `${code} - Seu Código de redefinição de senha · Unigram`,
    html,
  });
}

export async function sendTwoFactorCode(toEmail, code) {
  const transporter = createTransporter();
  if (!transporter) {
    if (process.env.NODE_ENV === 'production') {
      const error = new Error('Email 2FA nao configurado. Defina EMAIL_USER e EMAIL_PASS.');
      error.statusCode = 503;
      throw error;
    }
    console.warn('[email] SMTP nao configurado (EMAIL_USER/EMAIL_PASS). Codigo 2FA:', code);
    return;
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #f9f9f9; border-radius: 12px; overflow: hidden;">
      <div style="background: #4f46e5; padding: 28px 24px; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 24px; letter-spacing: 1px;">UNIGRAN</h1>
        <p style="color: #c7d2fe; margin: 6px 0 0; font-size: 14px;">Codigo de seguranca</p>
      </div>
      <div style="padding: 30px 24px;">
        <h2 style="color: #1e1b4b; margin: 0 0 12px;">Confirmar login</h2>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          Use o codigo abaixo para entrar na sua conta. Ele expira em <strong>10 minutos</strong>.
        </p>
        <div style="background: #ede9fe; border-radius: 10px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 42px; font-weight: 700; letter-spacing: 10px; color: #4f46e5;">${code}</span>
        </div>
        <p style="color: #9ca3af; font-size: 13px; margin: 0;">Se voce nao tentou entrar, troque sua senha.</p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Unigram" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `${code} - Codigo de login · Unigram`,
    html,
  });
}
