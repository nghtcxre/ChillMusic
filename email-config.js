/**
 * Конфигурация SMTP для отправки email
 * Поддерживает Gmail, Mail.ru, Yandex и другие провайдеры
 */

const nodemailer = require('nodemailer');

// Конфигурации для разных почтовых провайдеров
const SMTP_CONFIGS = {
  // Gmail конфигурация
  gmail: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true для 465, false для других портов
    auth: {
      user: process.env.GMAIL_USER || 'your-email@gmail.com',
      pass: process.env.GMAIL_APP_PASSWORD || 'your-app-password'
    },
    tls: {
      rejectUnauthorized: false
    }
  },

  // Mail.ru конфигурация
  mailru: {
    host: 'smtp.mail.ru',
    port: 587,
    secure: false,
    auth: {
      user: process.env.MAILRU_USER || 'your-email@mail.ru',
      pass: process.env.MAILRU_PASSWORD || 'your-password'
    },
    tls: {
      rejectUnauthorized: false
    }
  },

  // Yandex конфигурация
  yandex: {
    host: 'smtp.yandex.ru',
    port: 587,
    secure: false,
    auth: {
      user: process.env.YANDEX_USER || 'your-email@yandex.ru',
      pass: process.env.YANDEX_PASSWORD || 'your-password'
    },
    tls: {
      rejectUnauthorized: false
    }
  },

  // Outlook/Hotmail конфигурация
  outlook: {
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.OUTLOOK_USER || 'your-email@outlook.com',
      pass: process.env.OUTLOOK_PASSWORD || 'your-password'
    },
    tls: {
      rejectUnauthorized: false
    }
  },

  // Reg.ru SMTP сервер (текущие настройки ChillMusic)
  custom: {
    host: process.env.SMTP_HOST || 'server82.hosting.reg.ru',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false, // Reg.ru использует STARTTLS на порту 587
    auth: {
      user: process.env.SMTP_USER || 'admin_chill@chill-music.ru',
      pass: process.env.SMTP_PASSWORD || 'bY7pQ2fC4vcV7gS3'
    },
    tls: {
      // Используем современные настройки TLS; Nodemailer сам применит STARTTLS
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true
    },
    connectionTimeout: 30000, // 30 секунд
    greetingTimeout: 30000,   // 30 секунд
    socketTimeout: 30000,     // 30 секунд
    debug: false,
    logger: false
  }
};

// Определяем активную конфигурацию
function getActiveConfig() {
  const provider = process.env.EMAIL_PROVIDER || 'custom';
  const config = SMTP_CONFIGS[provider];
  
  if (!config) {
    throw new Error(`Неподдерживаемый провайдер email: ${provider}`);
  }
  
  return config;
}

// Создаем транспортер
function createTransporter() {
  const config = getActiveConfig();
  return nodemailer.createTransport(config);
}

// Проверяем подключение к SMTP
async function testSMTPConnection() {
  const transporter = createTransporter();
  
  try {
    console.log('🔍 Тестирование SMTP подключения...');
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('SMTP connection timeout after 30 seconds')), 30000);
    });
    
    const verifyPromise = transporter.verify();
    await Promise.race([verifyPromise, timeoutPromise]);
    
    console.log('✅ SMTP подключение успешно');
    return { success: true, transporter };
  } catch (error) {
    console.error('❌ Ошибка SMTP подключения:', error.message);
    return { success: false, error: error.message };
  }
}

// Получаем информацию о текущей конфигурации
function getConfigInfo() {
  const config = getActiveConfig();
  const provider = process.env.EMAIL_PROVIDER || 'custom';
  
  return {
    provider,
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.auth.user
  };
}

module.exports = {
  SMTP_CONFIGS,
  getActiveConfig,
  createTransporter,
  testSMTPConnection,
  getConfigInfo
};
