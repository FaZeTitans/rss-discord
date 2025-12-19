<p align="center">
  <img src="assets/banner.png" alt="RSS Discord Bot Banner" width="100%">
</p>

<p align="center">
  <img src="assets/logo.png" alt="RSS Discord Bot Logo" width="120" height="120">
</p>

<h1 align="center">RSS Discord Bot</h1>

<p align="center">
  <strong>A powerful, self-hostable Discord bot for RSS/Atom feed management</strong>
</p>

<p align="center">
  <a href="https://discord.com/api/oauth2/authorize?client_id=1451372685396541604&permissions=536988672&scope=bot%20applications.commands">
    <img src="https://img.shields.io/badge/Add%20to%20Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Add to Discord">
  </a>
  <a href="https://hub.docker.com/r/fazetitans/rss-discord">
    <img src="https://img.shields.io/badge/Docker%20Hub-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker Hub">
  </a>
  <a href="https://github.com/FaZeTitans/rss-discord">
    <img src="https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub">
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/docker/pulls/fazetitans/rss-discord?style=flat-square&color=orange" alt="Docker Pulls">
  <img src="https://img.shields.io/github/stars/FaZeTitans/rss-discord?style=flat-square&color=orange" alt="GitHub Stars">
  <img src="https://img.shields.io/github/license/FaZeTitans/rss-discord?style=flat-square&color=orange" alt="License">
</p>

---

## Overview

RSS Discord Bot lets you subscribe to any RSS or Atom feed and receive beautifully formatted notifications directly in your Discord channels. Perfect for staying updated on news, blogs, YouTube channels, Reddit posts, GitHub releases, and more.

> [!TIP]
> **Just want to use the bot?** [Add it to your server](https://discord.com/api/oauth2/authorize?client_id=1451372685396541604&permissions=536988672&scope=bot%20applications.commands) instantly - no setup required!
>
> **Want to self-host?** Follow the [Docker deployment](#-docker-deployment) guide below.

---

## Features

<table>
<tr>
<td width="50%">

### Core Features

- **Multi-feed subscriptions** per channel
- **Keyword filtering** (include/exclude)
- **Rate limiting** per feed
- **Categories** for organization
- **Pause/Resume** feeds anytime

</td>
<td width="50%">

### Smart Features

- **Auto-color** embeds by domain
- **GitHub/GitLab buttons** auto-detected
- **Duplicate detection** across feeds
- **Custom webhooks** (name & avatar)
- **Analytics** & health monitoring

</td>
</tr>
</table>

### Supported Platforms

| Platform        | Auto-Color | RSS Helper Command |
| --------------- | :--------: | :----------------: |
| YouTube         |     🔴     |     `/youtube`     |
| Reddit          |     🟠     |     `/reddit`      |
| GitHub          |     🟢     |         -          |
| Twitter/X       |     ⚫     |         -          |
| And 10+ more... |     ✓      |         -          |

---

## Commands

| Command                        | Description                    |
| ------------------------------ | ------------------------------ |
| `/subscribe <url>`             | Subscribe to an RSS feed       |
| `/unsubscribe <id>`            | Remove a subscription          |
| `/list [category]`             | List all subscriptions         |
| `/edit <id>`                   | Edit subscription settings     |
| `/test <id>`                   | Force check a feed             |
| `/pause <id>` / `/resume <id>` | Pause or resume a feed         |
| `/status [id]`                 | View feed health status        |
| `/webhook <id>`                | Configure custom webhook       |
| `/settings`                    | Server-wide settings           |
| `/stats [days]`                | View analytics                 |
| `/youtube <url>`               | Get YouTube channel RSS URL    |
| `/reddit <subreddit>`          | Get subreddit RSS URL          |
| `/export` / `/import`          | Backup & restore subscriptions |
| `/botstats`                    | Show bot statistics            |

---

## Quick Start

### Option 1: Use the Hosted Bot

Simply [invite the bot](https://discord.com/api/oauth2/authorize?client_id=1451372685396541604&permissions=536988672&scope=bot%20applications.commands) to your server and start using `/subscribe`!

### Option 2: Self-Host with Docker

```bash
docker run -d \
  --name rss-discord \
  -e DISCORD_TOKEN=your_bot_token \
  -e DISCORD_CLIENT_ID=your_client_id \
  -e NODE_ENV=production \
  -v rss-discord-data:/app/data \
  fazetitans/rss-discord:latest
```

Then deploy slash commands:

```bash
docker exec rss-discord bun run deploy
```

---

## Docker Deployment

### Docker Compose (Recommended)

```yaml
services:
  rss-discord:
    image: fazetitans/rss-discord:latest
    container_name: rss-discord
    restart: unless-stopped
    environment:
      - DISCORD_TOKEN=${DISCORD_TOKEN}
      - DISCORD_CLIENT_ID=${DISCORD_CLIENT_ID}
      - NODE_ENV=production
    volumes:
      - rss-discord-data:/app/data

volumes:
  rss-discord-data:
```

### Environment Variables

| Variable            | Required | Description                                          |
| ------------------- | :------: | ---------------------------------------------------- |
| `DISCORD_TOKEN`     |    ✓     | Bot token from Discord Developer Portal              |
| `DISCORD_CLIENT_ID` |    ✓     | Application client ID                                |
| `NODE_ENV`          |          | Set to `production` for 5min check interval          |
| `DATABASE_PATH`     |          | Custom SQLite path (default: `/app/data/rss-bot.db`) |

### Unraid / Synology / Other Platforms

1. Pull image: `fazetitans/rss-discord:latest`
2. Set environment variables (see above)
3. Map volume: `/app/data` → your persistent storage
4. Run `docker exec rss-discord bun run deploy` once

---

## Development

### Prerequisites

- [Bun](https://bun.sh) v1.0+
- Discord Bot Token

### Setup

```bash
git clone https://github.com/FaZeTitans/rss-discord.git
cd rss-discord
bun install
```

Create `.env`:

```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_GUILD_ID=your_dev_guild_id  # For instant command updates
```

Run:

```bash
bun run deploy  # Deploy slash commands
bun run dev     # Start with 30s check interval
```

### Building Docker Image

```bash
docker build -t rss-discord .
```

---

## Bot Permissions

The bot requires these Discord permissions:

| Permission           | Reason                 |
| -------------------- | ---------------------- |
| Send Messages        | Post feed updates      |
| Embed Links          | Rich embed formatting  |
| Attach Files         | Export functionality   |
| Read Message History | Context for commands   |
| Manage Webhooks      | Custom webhook feature |

**Invite URL:**

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=536988672&scope=bot%20applications.commands
```

---

## Contributing

Contributions are welcome! Feel free to:

- Report bugs
- Suggest features
- Submit pull requests

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  <sub>Built with Bun & discord.js</sub>
</p>
