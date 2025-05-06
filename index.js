require('dotenv').config();
const { Telegraf } = require('telegraf');
const fs = require('fs');
const cron = require('node-cron');

const bot = new Telegraf(process.env.BOT_TOKEN);

const BIRTHDAYS_FILE = './birthdays.json';
const CONFIG_FILE = './config.json';
const CHAT_ID = process.env.CHAT_ID;

function isAdmin(ctx) {
  const isAdmin = String(ctx.from.id) === process.env.ADMIN_ID;
  console.log(`👤 User ${ctx.from.id} is${isAdmin ? '' : ' NOT'} admin.`);
  return isAdmin;
}

function loadBirthdays() {
  try {
    const data = fs.readFileSync(BIRTHDAYS_FILE);
    return JSON.parse(data);
  } catch (err) {
    console.error('❌ Failed to load birthdays:', err.message);
    return [];
  }
}

function saveBirthdays(data) {
  fs.writeFileSync(BIRTHDAYS_FILE, JSON.stringify(data, null, 2));
  console.log('✅ Birthdays saved.');
}

function loadConfig() {
  try {
    const data = fs.readFileSync(CONFIG_FILE);
    return JSON.parse(data);
  } catch (err) {
    console.error('❌ Failed to load config:', err.message);
    return { greeting: 'Happy Birthday, {name}! @{username}' };
  }
}

function saveConfig(data) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
  console.log('✅ Config saved.');
}

bot.use((ctx, next) => {
  if (ctx.chat.type === 'private' && !isAdmin(ctx)) {
    console.log('🔒 Message from non-admin ignored.');
    return;
  }
  return next();
});

bot.on('message', (ctx) => {
  console.log(`📢 Message from ${ctx.from.username || ctx.from.first_name}, chat ID: ${ctx.chat.id}`);
});

bot.start((ctx) => {
  console.log('/start command triggered');
  ctx.reply('👋 Hi! I am a birthday bot. Use /add, /remove, /update, /setgreeting, /list etc.');
});

bot.command('whoami', (ctx) => {
  console.log('/whoami command');
  if (!isAdmin(ctx)) return ctx.reply('⛔ You are not allowed to use this command.');
  ctx.reply(`Your Telegram ID is: ${ctx.from.id}`);
});

bot.command('add', (ctx) => {
  console.log('/add command');
  if (!isAdmin(ctx)) return ctx.reply('⛔ You are not allowed to use this command.');

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 3) return ctx.reply('❗ Format: /add Name MM-DD username');

  const [name, date, username] = args;
  const birthdays = loadBirthdays();

  if (birthdays.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    return ctx.reply('⚠ This person is already in the list.');
  }

  birthdays.push({ name, date, username });
  saveBirthdays(birthdays);
  ctx.reply(`✅ Added: ${name} (${date}) — @${username}`);
});

bot.command('remove', (ctx) => {
  console.log('/remove command');
  if (!isAdmin(ctx)) return ctx.reply('⛔ You are not allowed to use this command.');

  const name = ctx.message.text.split(' ').slice(1).join(' ');
  if (!name) return ctx.reply('❗ Format: /remove Name');

  let birthdays = loadBirthdays();
  const before = birthdays.length;
  birthdays = birthdays.filter(p => p.name.toLowerCase() !== name.toLowerCase());

  if (birthdays.length === before) return ctx.reply('⚠ Person not found.');

  saveBirthdays(birthdays);
  ctx.reply(`🗑 Removed: ${name}`);
});

bot.command('update', (ctx) => {
  console.log('/update command');
  if (!isAdmin(ctx)) return ctx.reply('⛔ You are not allowed to use this command.');

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 3) return ctx.reply('❗ Format: /update Name MM-DD username');

  const [name, newDate, newUsername] = args;
  const birthdays = loadBirthdays();
  const person = birthdays.find(p => p.name.toLowerCase() === name.toLowerCase());

  if (!person) return ctx.reply('⚠ Person not found.');

  person.date = newDate;
  person.username = newUsername;
  saveBirthdays(birthdays);
  ctx.reply(`✏ Updated: ${name} → ${newDate}, @${newUsername}`);
});

bot.command('list', (ctx) => {
  console.log('/list command');
  if (!isAdmin(ctx)) return ctx.reply('⛔ You are not allowed to use this command.');

  const birthdays = loadBirthdays();
  if (!birthdays.length) return ctx.reply('📭 Birthday list is empty.');

  const list = birthdays.map(p => `• ${p.name} — ${p.date} — @${p.username}`).join('\n');
  ctx.reply(`📋 Birthday list:\n${list}`);
});

bot.command('setgreeting', (ctx) => {
  console.log('/setgreeting command');
  if (!isAdmin(ctx)) return ctx.reply('⛔ You are not allowed to use this command.');

  const newText = ctx.message.text.split(' ').slice(1).join(' ');
  if (!newText.includes('{name}') || !newText.includes('{username}')) {
    return ctx.reply('❗ Template must include {name} and {username}');
  }

  const config = loadConfig();
  config.greeting = newText;
  saveConfig(config);
  ctx.reply('✅ Birthday greeting updated.');
});

bot.command('getgreeting', (ctx) => {
  console.log('/getgreeting command');
  if (!isAdmin(ctx)) return ctx.reply('⛔ You are not allowed to use this command.');

  const config = loadConfig();
  ctx.reply(`📨 Current greeting:\n${config.greeting}`);
});

bot.command('test', (ctx) => {
  console.log('/test command');
  if (!isAdmin(ctx)) return ctx.reply('⛔ You are not allowed to use this command.');

  const today = new Date().toISOString().slice(5, 10);
  const birthdays = loadBirthdays();
  const config = loadConfig();

  birthdays.forEach(person => {
    if (person.date === today) {
      const message = config.greeting
        .replace('{name}', person.name)
        .replace('{username}', person.username);
      bot.telegram.sendMessage(CHAT_ID, message);
      console.log(`🎉 Sent greeting to ${person.name}`);
    }
  });
  ctx.reply('✅ Test message sent.');
});

cron.schedule('0 9 * * *', () => {
  console.log('⏰ Cron triggered at 09:00');
  const today = new Date().toISOString().slice(5, 10);
  console.log(`📅 Today is: ${today}`);

  const birthdays = loadBirthdays();
  const config = loadConfig();

  birthdays.forEach(person => {
    if (person.date === today) {
      const message = config.greeting
        .replace('{name}', person.name)
        .replace('{username}', person.username);
      bot.telegram.sendMessage(CHAT_ID, message);
      console.log(`🎉 Sent cron greeting to ${person.name}`);
    }
  });
});

bot.launch();
console.log('🤖 Bot is running...');
