import axios from "axios";
import crypto from "crypto";

const API_URL = "http://localhost:5002/api/v1";
const WEBHOOK_SECRET = "whsec_72UDkwBG3vOQE0YqHAJlrdtrPi6wVssf";

async function simulateStripeWebhook(sessionId: string) {
    console.log(`[Test] Simulating Stripe webhook for session: ${sessionId}`);

    const payload = JSON.stringify({
        id: "evt_test_" + Math.random().toString(36).substring(7),
        type: "checkout.session.completed",
        data: {
            object: {
                id: sessionId,
                payment_status: "paid",
                status: "complete",
            }
        },
        created: Math.floor(Date.now() / 1000),
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const signature = crypto
        .createHmac("sha256", WEBHOOK_SECRET)
        .update(signedPayload)
        .digest("hex");

    const stripeSignature = `t=${timestamp},v1=${signature}`;

    try {
        const response = await axios.post(`${API_URL}/payments/webhook`, payload, {
            headers: {
                "Content-Type": "application/json",
                "Stripe-Signature": stripeSignature,
            }
        });

        console.log("[Test] Webhook simulation successful:", response.data);
    } catch (error: any) {
        console.error("[Test] Webhook simulation failed:", error.response?.data || error.message);
    }
}

// If run directly, you need to provide a session ID (checkoutSession.id)
const sessionId = process.argv[2];
if (sessionId) {
    simulateStripeWebhook(sessionId);
} else {
    console.log("Usage: pnpm ts-node scripts/simulate-stripe-webhook.ts <session_id>");
}
