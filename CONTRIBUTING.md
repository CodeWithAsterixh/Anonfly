<div align="center">
  <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
    <svg width="128" height="128" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));">
      <defs>
        <linearGradient id="logo-shield-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#3b82f6" />
          <stop offset="100%" stop-color="#1d4ed8" />
        </linearGradient>
      </defs>
      <path d="M176 192V144C176 99.8172 211.817 64 256 64C300.183 64 336 99.8172 336 144V192" stroke="#3b82f6" stroke-width="32" stroke-linecap="round" />
      <path d="M128 160C128 160 128 280 128 320C128 400 256 464 256 464C256 464 384 400 384 320C384 280 384 160 384 160H128Z" fill="url(#logo-shield-grad)" />
      <rect x="180" y="260" width="60" height="20" rx="10" fill="white" />
      <rect x="272" y="260" width="60" height="20" rx="10" fill="white" />
      <path d="M128 200L32 280L128 320" fill="#3b82f6" fill-opacity="0.6" />
      <path d="M384 200L480 280L384 320" fill="#3b82f6" fill-opacity="0.6" />
    </svg>
    <div style="display: flex; flex-direction: column; line-height: 1.2; text-align: left;">
      <span style="font-weight: bold; font-size: 24px; letter-spacing: -0.025em; color: #1d4ed8;">
        Anonfly
      </span>
      <span style="font-size: 10px; font-weight: bold; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.1em;">
        Free • Secure • Anon
      </span>
    </div>
  </div>
</div>

# Contributing to Anonfly Backend 🚀

Thank you for your interest in contributing to the Anonfly Backend! We welcome contributions from everyone.

## 🚀 How to Contribute

1. **Fork the Repository**: Create a personal fork of the project.
2. **Clone the Fork**: `git clone https://github.com/CodeWithAsterixh/Anonfly.git`
3. **Create a Branch**: `git checkout -b feature/your-feature-name`
4. **Make Changes**: Implement your feature or fix.
5. **Test**: Ensure your changes don't break existing functionality.
6. **Submit a PR**: Open a Pull Request against the `main` branch.

## 🛠️ Development Setup

Refer to the `README.md` in this folder for specific setup instructions.

## 📜 Code Style
- Use TypeScript for all new code.
- Follow the existing project structure.
- Write clear, descriptive commit messages.

## 🏗️ Specifics for Backend
- Ensure all routes are documented in `app/routes/`.
- Use Zod for request body validation.
- Maintain the cryptographic integrity of the handshake protocol.
- Follow the Mongoose schema patterns in `lib/models/`.

## 🐛 Reporting Bugs
If you find a bug, please open an issue on GitHub with:
- A clear description of the problem.
- Steps to reproduce.
- Expected vs. actual behavior.

Thank you for making Anonfly better!
