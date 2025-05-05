require('dotenv').config();
const { Telegraf } = require('telegraf');
const fs = require('fs');
const cron = require('node-cron');

const bot = new Telegraf(process.env.BOT_TOKEN);

const BIRTHDAYS_FILE = './birthdays.json';
const CONFIG_FILE = './config.json';
const CHAT_ID = process.env.CHAT_ID;

function isAdmin(ctx) {
    return String(ctx.from.id) === process.env.ADMIN_ID;
}
  
function loadBirthdays() {
  return JSON.parse(fs.readFileSync(BIRTHDAYS_FILE));
}

function saveBirthdays(data) {
  fs.writeFileSync(BIRTHDAYS_FILE, JSON.stringify(data, null, 2));
}

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_FILE));
}

function saveConfig(data) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

bot.use((ctx, next) => {
    if (ctx.chat.type === 'private' && !isAdmin(ctx)) {
      return; // silently ignore
    }
    return next();
});
  
bot.start((ctx) =>
  ctx.reply('👋 Hi! I am a birthday bot. Use /add, /remove, /update, /setgreeting, /list etc.')
);

bot.command('whoami', (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('⛔ You are not allowed to use this command.');
  } 
  ctx.reply(`Your Telegram ID is: ${ctx.from.id}`);
});

// /add Name MM-DD username
bot.command('add', (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('⛔ You are not allowed to use this command.');
  } 

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 3) return ctx.reply('❗ Format: /add Name MM-DD username');

  const [name, date, username] = args;
  const birthdays = loadBirthdays();

  if (birthdays.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    return ctx.reply('⚠ This person is already in the list.');
  }

  birthdays.push({ name, date, username });
  saveBirthdays(birthdays);
  ctx.reply(`✅ Added: ${name} (${date}) — @${username}`);
});

// /remove Name
bot.command('remove', (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('⛔ You are not allowed to use this command.');
  } 

  const name = ctx.message.text.split(' ').slice(1).join(' ');
  if (!name) return ctx.reply('❗ Format: /remove Name');

  let birthdays = loadBirthdays();
  const before = birthdays.length;
  birthdays = birthdays.filter((p) => p.name.toLowerCase() !== name.toLowerCase());

  if (birthdays.length === before) {
    return ctx.reply('⚠ Person not found.');
  }

  saveBirthdays(birthdays);
  ctx.reply(`🗑 Removed: ${name}`);
});

// /update Name MM-DD username
bot.command('update', (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('⛔ You are not allowed to use this command.');
  }

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 3) return ctx.reply('❗ Format: /update Name MM-DD username');

  const [name, newDate, newUsername] = args;
  const birthdays = loadBirthdays();
  const person = birthdays.find((p) => p.name.toLowerCase() === name.toLowerCase());

  if (!person) return ctx.reply('⚠ Person not found.');

  person.date = newDate;
  person.username = newUsername;
  saveBirthdays(birthdays);
  ctx.reply(`✏ Updated: ${name} → ${newDate}, @${newUsername}`);
});

// /list
bot.command('list', (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('⛔ You are not allowed to use this command.');
  }

  const birthdays = loadBirthdays();
  if (!birthdays.length) return ctx.reply('📭 Birthday list is empty.');

  const list = birthdays
    .map((p) => `• ${p.name} — ${p.date} — @${p.username}`)
    .join('\n');

  ctx.reply(`📋 Birthday list:\n${list}`);
});

// /setgreeting Happy birthday, {name}! @{username}
bot.command('setgreeting', (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('⛔ You are not allowed to use this command.');
  }
  
  const newText = ctx.message.text.split(' ').slice(1).join(' ');
  if (!newText.includes('{name}') || !newText.includes('{username}')) {
    return ctx.reply('❗ Template must include {name} and {username}');
  }

  const config = loadConfig();
  config.greeting = newText;
  saveConfig(config);
  ctx.reply('✅ Birthday greeting updated.');
});

// /getgreeting
bot.command('getgreeting', (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('⛔ You are not allowed to use this command.');
  }

  const config = loadConfig();
  ctx.reply(`📨 Current greeting:\n${config.greeting}`);
});

// DAILY check at 09:00 server time
cron.schedule('0 9 * * *', () => {

  const today = new Date().toISOString().slice(5, 10); // MM-DD
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
