export const welcomeEmail = (firstName) => `
  <div style="font-family: Arial, sans-serif; max-width: 520px; margin: auto; color: #3b2a20;">
    <h2 style="color: #713e26;">Welcome to Furniva, ${firstName}!</h2>
    <p>Thanks for creating your account. You can now save favourites,
       track your orders, and get early access to new collections.</p>
    <p>As a new member, enjoy <strong>10% off your first order</strong>.</p>
    <a href="${process.env.CLIENT_URL || "http://localhost:5173"}"
       style="display:inline-block; padding:10px 22px; background:#713e26;
              color:#fff; text-decoration:none; border-radius:999px;">
      Start shopping
    </a>
    <p style="margin-top:24px; font-size:13px; color:#888;">
      If you didn't create this account, you can ignore this email.
    </p>
  </div>
`;