# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A feature-rich Discord bot for RSS/Atom feed management with keyword filtering, rate limiting, webhooks, categories, health monitoring, smart image extraction, analytics, and platform-specific RSS helpers.

## Commands

```bash
bun install          # Install dependencies
bun run dev          # Run with hot reload (30s check interval)
bun run start        # Run in production (5min check interval)
bun run deploy       # Deploy slash commands to Discord
bun run typecheck    # Type check
```

## Architecture

```
src/
├── index.ts           # Bot entry point, command router
├── database.ts        # SQLite (bun:sqlite) with auto-migrations
├── rss.ts             # Feed parsing, filtering, image extraction, posting
├── deploy-commands.ts # Slash command registration
└── commands/
    ├── subscribe.ts   # /subscribe - Add feed (url, name, color, role, category)
    ├── unsubscribe.ts # /unsubscribe <id> - Remove feed
    ├── list.ts        # /list [category] - Show feeds with status icons
    ├── edit.ts        # /edit <id> - Modify all subscription options
    ├── test.ts        # /test <id> - Force immediate check
    ├── pause.ts       # /pause <id> - Pause subscription
    ├── resume.ts      # /resume <id> - Resume subscription
    ├── status.ts      # /status [id] - Feed health monitoring
    ├── export.ts      # /export - Export subscriptions as JSON
    ├── import.ts      # /import <file> - Import from JSON
    ├── settings.ts    # /settings - Server-wide configuration
    ├── stats.ts       # /stats [days] - Analytics and statistics
    ├── youtube.ts     # /youtube <url> - Get YouTube channel RSS URL
    └── reddit.ts      # /reddit <subreddit> - Get Reddit RSS URL
```

## Key Features

- **Keyword filters**: `include_keywords` / `exclude_keywords` (comma-separated)
- **Rate limiting**: `max_posts_per_hour` per subscription
- **Webhooks**: `webhook_url`, `webhook_name`, `webhook_avatar` for custom posting
- **Categories**: Organize feeds, filter in `/list [category]`
- **Error tracking**: `error_count`, `last_error`, `last_check_at` per feed
- **Pause/Resume**: Temporarily disable subscriptions
- **Auto-color**: Automatic embed colors based on domain (GitHub, YouTube, Reddit, etc.)
- **Buttons**: Read/Share buttons under embeds (configurable per feed and server)
- **Duplicate detection**: Cross-feed deduplication by link URL
- **Post history**: Track all posted items for stats and deduplication
- **Analytics**: `/stats` shows posts by day, top feeds, totals
- **Platform helpers**: `/youtube` and `/reddit` generate RSS URLs easily

## Server Settings (/settings)

- `alert_channel`: Channel for feed error notifications
- `alert_threshold`: Number of errors before alerting (default: 3)
- `default_color`: Default embed color for new feeds
- `buttons_enabled`: Show/hide Read/Share buttons globally

## Image Extraction (Priority Order)

1. `media:content` / `media:thumbnail` / `media:group`
2. `enclosure` (podcasts/media attachments)
3. `<img>` tags in HTML content (filters tracking pixels)
4. `og:image` meta tags
5. Direct image URLs (.jpg, .png, .gif, .webp)
6. **GitHub OpenGraph**: Auto-generates preview for `github.com/owner/repo` URLs

## Domain Auto-Colors

Recognized domains with automatic colors:

- GitHub (#238636), YouTube (#FF0000), Reddit (#FF4500)
- Twitter (#1DA1F2), X (#000000), LinkedIn (#0A66C2)
- Medium (#000000), Dev.to (#0A0A0A), HackerNews (#FF6600)
- Stack Overflow (#F48024), Discord (#5865F2), Twitch (#9146FF)
- Facebook (#1877F2), Instagram (#E4405F)

## Database Schema

### subscriptions table

- `feed_url`, `feed_name`, `channel_id`, `guild_id`
- `color` (hex), `role_id` (mention), `show_buttons`
- `paused`, `category`, `template`
- `include_keywords`, `exclude_keywords`
- `max_posts_per_hour`, `posts_this_hour`, `hour_started_at`
- `webhook_url`, `webhook_name`, `webhook_avatar`
- `last_check_at`, `error_count`, `last_error`
- `last_item_guid` (deduplication)

### guild_settings table

- `guild_id`, `alert_channel_id`, `alert_threshold`
- `default_color`, `buttons_enabled`

### post_history table

- `guild_id`, `subscription_id`, `item_guid`
- `item_title`, `item_link`, `posted_at`

## Environment Variables

```bash
DISCORD_TOKEN=       # Bot token
DISCORD_CLIENT_ID=   # App client ID
DISCORD_GUILD_ID=    # Guild ID (instant command updates in dev)
NODE_ENV=            # "production" = 5min interval, else 30s
```

## Code Style

- Bun APIs (`bun:sqlite`) over Node equivalents
- Bun auto-loads `.env` - no dotenv needed
- Single quotes, 4-space tabs, English comments
