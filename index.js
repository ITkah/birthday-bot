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
    return { greeting: 'Happy birthday, {name}! (@{username})' };
  }
}

function saveConfig(data) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

// 🟢 Allow only admin in private chat to use commands
bot.use((ctx, next) => {
  if (ctx.chat.type === 'private') {
    if (isAdmin(ctx)) return next();
    return;
  }
  // Allow messages in group (only for cron greetings)
  return next();
});

// 👋 Start
bot.start((ctx) => {
  console.log('/start');
  ctx.reply('👋 Hi! I am a congratulator bot. Use /add, /remove, /update, /list, /setgreeting, /test etc.');
});

// 🔎 Whoami
bot.command('whoami', (ctx) => {
  ctx.reply(`🆔 Your Telegram ID: ${ctx.from.id}`);
});

// ➕ Add
bot.command('add', (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 3) return ctx.reply('❗ Format: /add Name MM-DD username');
  const [name, date, username] = args;
  const birthdays = loadBirthdays();

  if (birthdays.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    return ctx.reply('⚠ This person already exists.');
  }

  birthdays.push({ name, date, username });
  saveBirthdays(birthdays);
  ctx.reply(`✅ Added: ${name} (${date}) — @${username}`);
});

// 🗑 Remove
bot.command('remove', (ctx) => {
  const name = ctx.message.text.split(' ').slice(1).join(' ');
  if (!name) return ctx.reply('❗ Format: /remove Name');

  let birthdays = loadBirthdays();
  const before = birthdays.length;
  birthdays = birthdays.filter(p => p.name.toLowerCase() !== name.toLowerCase());

  if (birthdays.length === before) return ctx.reply('⚠ Person not found.');
  saveBirthdays(birthdays);
  ctx.reply(`🗑 Removed: ${name}`);
});

// ✏ Update
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
  ctx.reply(`✏ Updated: ${name} → ${newDate}, @${newUsername}`);
});

// 📋 List
bot.command('list', (ctx) => {
  const birthdays = loadBirthdays();
  if (!birthdays.length) return ctx.reply('📭 Birthday list is empty.');
  const list = birthdays.map(p => `• ${p.name} — ${p.date} — @${p.username}`).join('\n');
  ctx.reply(`📋 Birthday list:\n${list}`);
});

// ⚙ Set greeting
bot.command('setgreeting', (ctx) => {
  const text = ctx.message.text.split(' ').slice(1).join(' ');
  if (!text.includes('{name}') || !text.includes('{username}')) {
    return ctx.reply('❗ Template must contain {name} and {username}');
  }

  const config = loadConfig();
  config.greeting = text;
  saveConfig(config);
  ctx.reply('✅ Greeting template updated.');
});

// 📩 Get greeting
bot.command('getgreeting', (ctx) => {
  const config = loadConfig();
  ctx.reply(`📨 Current template:\n${config.greeting}`);
});

// 🧪 Test command
bot.command('test', (ctx) => {
  const today = new Date().toISOString().slice(5, 10);
  const birthdays = loadBirthdays();
  const config = loadConfig();

  console.log('✅ ENV CHAT_ID:', process.env.CHAT_ID);
  console.log('📆 Today is:', today);
  console.log('🎂 Birthdays today:', birthdays.filter(p => p.date === today));

  birthdays.forEach(p => {
    if (p.date === today) {
      const msg = config.greeting.replace('{name}', p.name).replace('{username}', p.username);
      bot.telegram.sendMessage(process.env.CHAT_ID, msg);
      console.log(`✅ Sent greeting to ${p.name}`);
    }
  });

  ctx.reply('✅ Test message sent to group.');
});


// ⏰ Cron job at 09:00
cron.schedule('0 6 * * *', () => {
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

// ✅ Log chat info (for debug)
bot.on('message', (ctx) => {
  console.log(`📩 Message from ${ctx.from.username || ctx.from.first_name}, chat ID: ${ctx.chat.id}, type: ${ctx.chat.type}`);
});

bot.launch();
console.log('🤖 Bot is running...');
