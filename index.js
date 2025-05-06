require('dotenv').config();
const { Telegraf } = require('telegraf');
const fs = require('fs');
const cron = require('node-cron');

const bot = new Telegraf(process.env.BOT_TOKEN);

const BIRTHDAYS_FILE = './birthdays.json';
const CONFIG_FILE = './config.json';
const CHAT_ID = process.env.CHAT_ID;

function isAdmin(ctx) {
  return ctx.from.id === Number(process.env.ADMIN_ID);
}

function loadBirthdays() {
  try {
    return JSON.parse(fs.readFileSync(BIRTHDAYS_FILE));
  } catch {
    return [];
  }
}

function saveBirthdays(data) {
  fs.writeFileSync(BIRTHDAYS_FILE, JSON.stringify(data, null, 2));
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE));
  } catch {
    return { greeting: 'Happy Birthday, {name}! @{username}' };
  }
}

function saveConfig(data) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

// 📩 Log any message for debugging
bot.on('message', (ctx) => {
  console.log('📩 Message:', ctx.message.text);
  console.log('Chat type:', ctx.chat.type);
  console.log('Chat ID:', ctx.chat.id);
  console.log('User:', ctx.from.username, ctx.from.id);
});

// Only allow commands in private chat
bot.use((ctx, next) => {
  if (ctx.chat.type === 'private') {
    return next();
  }
  return;
});

bot.start((ctx) => {
  console.log('/start triggered');
  return ctx.reply('👋 Hi! I`m a congratulator bot. Use /add, /remove, /update, /list, /setgreeting etc.');
});

bot.command('whoami', (ctx) => {
  return ctx.reply(`🆔 Your Telegram ID: ${ctx.from.id}`);
});

bot.command('add', (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 3) return ctx.reply('❗ Format: /add Name MM-DD username');
  const [name, date, username] = args;

  const birthdays = loadBirthdays();
  if (birthdays.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    return ctx.reply('⚠ This person is already in the list.');
  }

  birthdays.push({ name, date, username });
  saveBirthdays(birthdays);
  return ctx.reply(`✅ Added: ${name} (${date}) — @${username}`);
});

bot.command('remove', (ctx) => {
  const name = ctx.message.text.split(' ').slice(1).join(' ');
  if (!name) return ctx.reply('❗ Format: /remove Name');

  let birthdays = loadBirthdays();
  const before = birthdays.length;
  birthdays = birthdays.filter(p => p.name.toLowerCase() !== name.toLowerCase());

  if (birthdays.length === before) return ctx.reply('⚠ Person not found.');
  saveBirthdays(birthdays);
  return ctx.reply(`🗑 Removed: ${name}`);
});

bot.command('update', (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 3) return ctx.reply('❗ Format: /update Name MM-DD username');
  const [name, newDate, newUsername] = args;

  const birthdays = loadBirthdays();
  const person = birthdays.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (!person) return ctx.reply('⚠ Person not found.');

  person.date = newDate;
  person.username = newUsername;
  saveBirthdays(birthdays);
  return ctx.reply(`✏ Updated: ${name} → ${newDate}, @${newUsername}`);
});

bot.command('list', (ctx) => {
  const birthdays = loadBirthdays();
  if (!birthdays.length) return ctx.reply('📭 The list is empty.');

  const list = birthdays.map(p => `• ${p.name} — ${p.date} — @${p.username}`).join('\n');
  return ctx.reply(`📋 Birthday list:\n${list}`);
});

bot.command('setgreeting', (ctx) => {
  const text = ctx.message.text.split(' ').slice(1).join(' ');
  if (!text.includes('{name}') || !text.includes('{username}')) {
    return ctx.reply('❗ Template must include {name} and {username}');
  }

  const config = loadConfig();
  config.greeting = text;
  saveConfig(config);
  return ctx.reply('✅ Greeting template updated.');
});

bot.command('getgreeting', (ctx) => {
  const config = loadConfig();
  return ctx.reply(`📨 Current template:\n${config.greeting}`);
});

// Used to manually test greeting message
bot.command('test', (ctx) => {
  const today = new Date().toISOString().slice(5, 10);
  const birthdays = loadBirthdays();
  const config = loadConfig();

  birthdays.forEach(p => {
    if (p.date === today) {
      const msg = config.greeting.replace('{name}', p.name).replace('{username}', p.username);
      bot.telegram.sendMessage(CHAT_ID, msg);
    }
  });

  return ctx.reply('✅ Test message sent to the group.');
});

// Cron daily greeting at 09:00
cron.schedule('0 9 * * *', () => {
  const today = new Date().toISOString().slice(5, 10);
  const birthdays = loadBirthdays();
  const config = loadConfig();

  birthdays.forEach((person) => {
    if (person.date === today) {
      const message = config.greeting
        .replace('{name}', person.name)
        .replace('{username}', person.username);
      bot.telegram.sendMessage(CHAT_ID, message);
    }
  });
});

bot.launch();
console.log('🤖 Bot is running...');
