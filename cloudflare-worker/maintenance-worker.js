/**
 * Cloudflare Worker — LEON Maintenance Failover
 * 
 * Ce Worker se place devant leon.direct.
 * Si le serveur LEON répond → réponse normale (transparent).
 * Si le serveur est injoignable (NAS éteint) → page de maintenance.
 * 
 * Configuration : créer une variable d'environnement ORIGIN_URL
 * dans les settings du Worker (ex: https://leon.direct)
 */

const MAINTENANCE_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LEON — Maintenance</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@200;500;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
      padding: 20px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .card {
      width: 100%;
      max-width: 400px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 48px 40px;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      text-align: center;
    }

    .logo {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 32px;
    }

    .logo-text {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: 4px;
      color: #fff;
    }

    .logo-dot {
      width: 8px;
      height: 8px;
      background: #dc2626;
      border-radius: 50%;
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.9); }
    }

    .title {
      font-size: 20px;
      font-weight: 500;
      color: #fff;
      margin-bottom: 12px;
    }

    .subtitle {
      font-size: 14px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.5);
      line-height: 1.6;
      margin-bottom: 24px;
    }

    .contact {
      font-size: 13px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.35);
    }

    @media (max-width: 480px) {
      .card {
        padding: 36px 24px;
      }

      .logo-text {
        font-size: 28px;
      }

      .title {
        font-size: 18px;
      }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <span class="logo-text">LEON</span>
      <span class="logo-dot"></span>
    </div>
    <p class="title">Service temporairement indisponible</p>
    <p class="subtitle">Nous revenons très vite. Merci de votre patience.</p>
    <p class="contact">Contacter Lio si besoin urgent</p>
  </div>
</body>
</html>`;

export default {
  async fetch(request) {
    try {
      // Transmettre la requête au serveur LEON (via le tunnel Cloudflare)
      // Timeout de 5 secondes : si le NAS ne répond pas, on affiche la maintenance
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(request, {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // Le serveur a répondu → transmettre la réponse telle quelle
      return response;
    } catch (error) {
      // Le serveur est injoignable (NAS éteint, tunnel down, timeout)
      // → Afficher la page de maintenance
      return new Response(MAINTENANCE_HTML, {
        status: 503,
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          'Retry-After': '300',
          'Cache-Control': 'no-store',
        },
      });
    }
  },
};
