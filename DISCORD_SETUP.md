# Discord Integration Setup Guide

## Configuration Variables Required in Railway

To enable Discord forum thread creation for tournaments, add the following environment variables to your Railway project:

### Required Variables

```
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_FORUM_CHANNEL_ID=your_forum_channel_id_here
```

## How to Get These Values

### 1. DISCORD_BOT_TOKEN

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name (e.g., "Wesnoth Bot")
3. Go to the "Bot" section and click "Add Bot"
4. Under TOKEN, click "Copy" to copy your bot token
5. Paste this value as `DISCORD_BOT_TOKEN` in Railway

### 2. DISCORD_FORUM_CHANNEL_ID

1. Go to your Discord server
2. Create a **Forum Channel** named "tournaments"
3. Right-click on the forum channel and select "Copy Channel ID"
4. Paste this value as `DISCORD_FORUM_CHANNEL_ID` in Railway

### 3. Give Bot Permissions

1. Back in Discord Developer Portal, in your bot's OAuth2 section:
2. Go to **URL Generator**
3. Select these scopes: `bot`
4. Select these permissions:
   - Send Messages
   - Create Public Threads
   - Manage Threads
5. Copy the generated URL and open it in your browser
6. Select your Discord server and authorize the bot

## What This Does

Once configured, your system will:

✅ Create a Discord thread automatically when a tournament is created  
✅ Post updates when participants join and are accepted  
✅ Post when registration closes  
✅ Post when the tournament starts  
✅ Post round updates and match results  
✅ Allow anyone in Discord to comment on the thread without restrictions

## Testing

After setting up:

1. Create a tournament in your application
2. Check the "tournaments" forum channel in Discord
3. A new thread should appear automatically with the tournament name
4. Discord thread will receive messages as tournament events happen

## If Discord Features Don't Work

The system is designed to be **fault-tolerant**:
- If Discord variables are not configured, tournaments will still work normally
- If Discord API fails, tournament operations will continue without error
- Discord notifications are logged but don't affect core functionality

## Support

For Discord API issues, check the [Discord Developer Documentation](https://discord.com/developers/docs/intro)
