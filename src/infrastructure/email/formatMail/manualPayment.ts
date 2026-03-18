export function formatManualPaymentNotification(data: {
  userAid: string;
  amount: number;
  token: string;
  proof: string;
  transactionId: string;
}) {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #0c0c0e; color: #e4e4e7; }
        .container { max-width: 600px; margin: 0 auto; background: #18181b; border-radius: 16px; overflow: hidden; border: 1px solid #27272a; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5); }
        .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 40px 24px; text-align: center; }
        .header h1 { margin: 0 0 8px 0; font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; }
        .header p { margin: 0; font-size: 14px; opacity: 0.9; }
        .content { padding: 32px 24px; }
        .grid { display: grid; grid-template-cols: 1fr 1fr; gap: 16px; margin-bottom: 32px; }
        .field { margin-bottom: 24px; }
        .label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #a1a1aa; margin-bottom: 8px; }
        .value { font-size: 14px; color: #f4f4f5; background: #0c0c0e; padding: 12px 16px; border-radius: 8px; border: 1px solid #27272a; word-break: break-all; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        .highlight { color: #f59e0b; font-weight: 700; border-color: #f59e0b20; }
        .footer { padding: 24px; text-align: center; font-size: 12px; color: #71717a; border-top: 1px solid #27272a; background: #121214; }
        .btn { display: inline-block; background: #f59e0b; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin-top: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Payment Proof</h1>
          <p>Manual Premium Upgrade Request</p>
        </div>
        
        <div class="content">
          <div class="field">
            <span class="label">User (AID)</span>
            <div class="value">${escapeHtml(data.userAid)}</div>
          </div>
          
          <div style="display: flex; gap: 16px; margin-bottom: 24px;">
            <div style="flex: 1;">
              <span class="label">Amount</span>
              <div class="value highlight">$${data.amount.toFixed(2)}</div>
            </div>
            <div style="flex: 1;">
              <span class="label">Token</span>
              <div class="value">${escapeHtml(data.token)}</div>
            </div>
          </div>
          
          <div class="field">
            <span class="label">Transaction Hash / Proof</span>
            <div class="value">${escapeHtml(data.proof)}</div>
          </div>

          <div class="field">
            <span class="label">Internal ID</span>
            <div class="value" style="font-size: 12px; color: #a1a1aa;">${data.transactionId}</div>
          </div>
          
          <div style="text-align: center; margin-top: 32px;">
            <p style="font-size: 13px; color: #a1a1aa; margin-bottom: 16px;">Please verify this transaction in the Celo explorer and update the transaction status in the database.</p>
            <a href="https://celoscan.io/tx/${encodeURIComponent(data.proof)}" class="btn">View on Celoscan</a>
          </div>
        </div>
        
        <div class="footer">
          <p style="margin: 0;">Anonfly — Anonymous Messaging Infrastructure</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return html;
}

function escapeHtml(text: string): string {
  if (!text) return "";
  const map: { [key: string]: string } = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
  };
  return text.replaceAll(/[&<>"']/g, (m) => map[m]);
}
