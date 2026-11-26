function renderPageShell(title, updatedDate, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — NTWRKH</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.65;
      color: #1a202c;
      background: #f7fafc;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 820px;
      margin: 40px auto;
      background: #ffffff;
      padding: 40px 48px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
    }
    h1 { font-size: 2rem; margin-bottom: 4px; color: #111827; }
    .meta { color: #6b7280; font-size: 0.9rem; margin-bottom: 28px; }
    h2 { font-size: 1.25rem; margin-top: 28px; color: #1f2937; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
    p, li { color: #374151; font-size: 1rem; }
    ul { padding-left: 20px; }
    footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 0.85rem; color: #6b7280; }
    a { color: #2563eb; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    <div class="meta">Effective Date: ${updatedDate} &bull; NTWRKH Platform</div>
    ${bodyHtml}
    <footer>
      &copy; ${new Date().getFullYear()} NTWRKH. All rights reserved. &bull;
      <a href="/privacy">Privacy Policy</a> &bull;
      <a href="/terms">Terms of Service</a>
    </footer>
  </div>
</body>
</html>`;
}

function getPrivacyPolicyHtml(baseUrl) {
  return renderPageShell(
    'Privacy Policy',
    'November 26, 2026',
    `
    <p>NTWRKH ("we," "our," or "us") operates an AI-powered social content discovery and distribution service accessible via WhatsApp, Telegram, and authorized social media APIs (${baseUrl}). This Privacy Policy explains how we collect, use, store, and protect your data when you connect third-party accounts such as Instagram (Meta) and TikTok.</p>

    <h2>1. Information We Collect</h2>
    <ul>
      <li><strong>Messaging Account Identifiers:</strong> Your WhatsApp phone number, Telegram user ID, and display name used to communicate with the NTWRKH bot.</li>
      <li><strong>Connected Social Media Tokens & Profile Data:</strong> When you authorize Instagram or TikTok via OAuth 2.0, we receive your platform user ID, username, and scoped OAuth access/refresh tokens required to publish content on your behalf.</li>
      <li><strong>User-Submitted Media & Metadata:</strong> Videos, images, captions, and hashtags you send to NTWRKH for AI hashtag optimization, cross-platform publishing, and niche audience routing.</li>
      <li><strong>Subscription & Billing Records:</strong> Payment references and subscription tier status processed securely via Paystack. We do not store raw credit/debit card numbers.</li>
    </ul>

    <h2>2. How We Use Your Information</h2>
    <ul>
      <li>To authenticate your identity and maintain your NTWRKH creator profile.</li>
      <li>To analyze captions and hashtags using AI and match your content with relevant opted-in creator niches.</li>
      <li>To publish media directly to your connected Instagram Business/Creator and TikTok accounts solely upon your explicit command.</li>
      <li>To deliver service notifications, reach analytics, and subscription receipts via WhatsApp or Telegram.</li>
    </ul>

    <h2>3. Third-Party Platform Compliance (Meta & TikTok)</h2>
    <p>NTWRKH strictly adheres to the Meta Platform Terms, Instagram Graph API Policies, and TikTok Developer Terms of Service. We never sell your personal data, social tokens, or audience metrics to third parties, data brokers, or advertising networks.</p>

    <h2>4. Data Retention & Deletion</h2>
    <p>Media files uploaded for distribution are temporarily hosted on encrypted cloud storage (Cloudinary) solely to facilitate API transfer to Instagram and TikTok. You may revoke NTWRKH's access at any time from your Instagram ("Apps and Websites") or TikTok ("Manage App Permissions") security settings, or request full account and token deletion by contacting <strong>privacy@ntwrkh.app</strong>.</p>

    <h2>5. Contact Us</h2>
    <p>If you have questions about this Privacy Policy or data deletion requests, contact our Data Protection Officer at <strong>privacy@ntwrkh.app</strong>.</p>
    `
  );
}

function getTermsOfServiceHtml(baseUrl) {
  return renderPageShell(
    'Terms of Service',
    'November 26, 2026',
    `
    <p>Welcome to NTWRKH (${baseUrl}). By interacting with the NTWRKH WhatsApp or Telegram bot, connecting your social media accounts, or subscribing to a paid plan, you agree to these Terms of Service.</p>

    <h2>1. Description of Service</h2>
    <p>NTWRKH is a conversational SaaS tool that helps creators, influencers, and businesses optimize hashtags, syndicate user-authorized content to connected social platforms (including Instagram and TikTok), and discover relevant niche audiences within the NTWRKH network.</p>

    <h2>2. User Responsibilities & Content Ownership</h2>
    <ul>
      <li><strong>Ownership:</strong> You retain 100% ownership and intellectual property rights to all videos, images, and captions you submit to NTWRKH.</li>
      <li><strong>License to Distribute:</strong> You grant NTWRKH a limited, non-exclusive license to process, transcode, and publish your submitted content exclusively to the social accounts and discovery feeds you authorize.</li>
      <li><strong>Acceptable Use:</strong> You agree not to upload illegal, infringing, hateful, or spam content, and you agree to comply with Instagram's Community Guidelines, TikTok's Community Guidelines, and WhatsApp's Business Messaging Policy.</li>
    </ul>

    <h2>3. Subscriptions & Payments</h2>
    <p>Free tier users receive limited monthly content distributions. Pro tier subscriptions are billed via Paystack and unlock expanded AI hashtag routing and multi-platform publishing. Payments are non-refundable once a billing cycle has commenced unless required by applicable law.</p>

    <h2>4. Limitation of Liability</h2>
    <p>NTWRKH relies on official third-party APIs (Meta, TikTok, Telegram, Cloudinary, Paystack). We are not liable for temporary API outages, rate limits, or algorithmic reach variations on third-party social networks.</p>

    <h2>5. Termination</h2>
    <p>We reserve the right to suspend accounts that violate platform anti-spam policies or abuse automated publishing endpoints. You may terminate your use at any time by disconnecting your social accounts and ceasing bot usage.</p>

    <h2>6. Contact</h2>
    <p>For support or legal inquiries, contact <strong>support@ntwrkh.app</strong>.</p>
    `
  );
}

module.exports = {
  getPrivacyPolicyHtml,
  getTermsOfServiceHtml,
};
