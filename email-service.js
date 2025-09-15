/**
 * Сервис для отправки email с поддержкой множественных провайдеров
 * и резервных систем
 */

const { createTransporter, testSMTPConnection, getConfigInfo } = require('./email-config');
const crypto = require('crypto');

// Хранилище кодов подтверждения
const confirmationCodes = new Map();

// HTML шаблоны для писем
const EMAIL_TEMPLATES = {
  confirmation: (code, appName = 'ChillMusic') => `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Код подтверждения</title>
        <!--[if mso]>
        <noscript>
            <xml>
                <o:OfficeDocumentSettings>
                    <o:PixelsPerInch>96</o:PixelsPerInch>
                </o:OfficeDocumentSettings>
            </xml>
        </noscript>
        <![endif]-->
        <style>
            /* Gmail-compatible styles */
            body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 0;
                background-color: #f4f4f4;
                -webkit-text-size-adjust: 100%;
                -ms-text-size-adjust: 100%;
            }
            .container {
                background-color: #ffffff;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                padding: 30px;
                max-width: 500px;
                width: 100%;
                margin: 20px auto;
                text-align: center;
            }
            .logo {
                width: 60px;
                height: 60px;
                background-color: #667eea;
                border-radius: 50%;
                margin: 0 auto 20px;
                display: inline-block;
                line-height: 60px;
                font-size: 24px;
                color: white;
                font-weight: bold;
            }
            h1 {
                color: #333333;
                margin-bottom: 15px;
                font-size: 24px;
                font-weight: 600;
                margin-top: 0;
            }
            .subtitle {
                color: #666666;
                margin-bottom: 25px;
                font-size: 16px;
                line-height: 1.4;
            }
            .code-container {
                background-color: #667eea;
                border-radius: 8px;
                padding: 25px;
                margin: 25px 0;
            }
            .code {
                font-size: 32px;
                font-weight: bold;
                color: white;
                letter-spacing: 6px;
                font-family: 'Courier New', monospace;
                margin: 0;
            }
            .warning {
                background-color: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 6px;
                padding: 15px;
                margin: 20px 0;
                color: #856404;
                font-size: 14px;
            }
            .footer {
                margin-top: 25px;
                padding-top: 20px;
                border-top: 1px solid #eeeeee;
                color: #999999;
                font-size: 12px;
            }
            .security-note {
                background-color: #e8f4fd;
                border-left: 4px solid #2196F3;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
                text-align: left;
                font-size: 14px;
            }
            /* Gmail mobile compatibility */
            @media only screen and (max-width: 600px) {
                .container {
                    padding: 20px;
                    margin: 10px;
                }
                .code {
                    font-size: 28px;
                    letter-spacing: 4px;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">🎵</div>
            <h1>Код подтверждения</h1>
            <p class="subtitle">
                Для завершения регистрации в ${appName} используйте код ниже:
            </p>
            
            <div class="code-container">
                <div class="code">${code}</div>
            </div>
            
            <div class="warning">
                ⚠️ Код действителен в течение 15 минут
            </div>
            
            <div class="security-note">
                <strong>🔒 Безопасность:</strong><br>
                • Никому не сообщайте этот код<br>
                • Если вы не запрашивали код, проигнорируйте это письмо<br>
                • Код можно использовать только один раз
            </div>
            
            <div class="footer">
                <p>Это письмо отправлено автоматически, не отвечайте на него.</p>
                <p>© 2025 ${appName}. Все права защищены.</p>
            </div>
        </div>
    </body>
    </html>
  `,

  welcome: (userName, appName = 'ChillMusic') => `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Добро пожаловать!</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .container {
                background: white;
                border-radius: 20px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                padding: 40px;
                max-width: 500px;
                width: 90%;
                text-align: center;
            }
            .logo {
                width: 80px;
                height: 80px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 50%;
                margin: 0 auto 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 32px;
                color: white;
                font-weight: bold;
            }
            h1 {
                color: #333;
                margin-bottom: 20px;
                font-size: 28px;
                font-weight: 600;
            }
            .welcome-text {
                color: #666;
                margin-bottom: 30px;
                font-size: 16px;
                line-height: 1.6;
            }
            .features {
                text-align: left;
                margin: 30px 0;
            }
            .feature {
                display: flex;
                align-items: center;
                margin: 15px 0;
                padding: 10px;
                background: #f8f9fa;
                border-radius: 10px;
            }
            .feature-icon {
                font-size: 24px;
                margin-right: 15px;
            }
            .footer {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #eee;
                color: #999;
                font-size: 12px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">🎵</div>
            <h1>Добро пожаловать в ${appName}!</h1>
            <p class="welcome-text">
                Привет, ${userName}!<br>
                Спасибо за регистрацию. Теперь вы можете пользоваться всеми возможностями приложения.
            </p>
            
            <div class="features">
                <div class="feature">
                    <span class="feature-icon">🎧</span>
                    <span>Прослушивание музыки</span>
                </div>
                <div class="feature">
                    <span class="feature-icon">⭐</span>
                    <span>Оценка релизов</span>
                </div>
                <div class="feature">
                    <span class="feature-icon">❤️</span>
                    <span>Избранные треки</span>
                </div>
                <div class="feature">
                    <span class="feature-icon">👥</span>
                    <span>Сообщество</span>
                </div>
            </div>
            
            <div class="footer">
                <p>Это письмо отправлено автоматически, не отвечайте на него.</p>
                <p>© 2025 ${appName}. Все права защищены.</p>
            </div>
        </div>
    </body>
    </html>
  `
};

// Генерируем код подтверждения
function generateConfirmationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Сохраняем код подтверждения
function saveConfirmationCode(email, code) {
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 минут
  confirmationCodes.set(email, { 
    code, 
    expiresAt,
    attempts: 0,
    createdAt: Date.now()
  });
  
  // Очищаем старые коды
  cleanupExpiredCodes();
}

// Проверяем код подтверждения
function verifyConfirmationCode(email, code) {
  const savedCode = confirmationCodes.get(email);
  
  if (!savedCode) {
    throw new Error('Код подтверждения не найден');
  }
  
  if (savedCode.expiresAt < Date.now()) {
    confirmationCodes.delete(email);
    throw new Error('Код подтверждения истёк');
  }
  
  if (savedCode.attempts >= 3) {
    confirmationCodes.delete(email);
    throw new Error('Превышено количество попыток ввода кода');
  }
  
  if (savedCode.code !== code) {
    savedCode.attempts++;
    throw new Error('Неверный код подтверждения');
  }
  
  // Код верный, удаляем его
  confirmationCodes.delete(email);
  return true;
}

// Очищаем истёкшие коды
function cleanupExpiredCodes() {
  const now = Date.now();
  for (const [email, data] of confirmationCodes.entries()) {
    if (data.expiresAt < now) {
      confirmationCodes.delete(email);
    }
  }
}

// Отправляем email с кодом подтверждения
async function sendConfirmationEmail(email, appName = 'ChillMusic') {
  try {
    console.log(`📧 Отправка кода подтверждения на ${email}`);
    
    // Генерируем код
    const code = generateConfirmationCode();
    
    // Сохраняем код
    saveConfirmationCode(email, code);
    
    // Создаем транспортер
    console.log('🔧 Создание SMTP транспортера...');
    const transporter = createTransporter();
    
    // Получаем информацию о конфигурации
    const config = getConfigInfo();
    console.log('📋 Конфигурация SMTP:', {
      provider: config.provider,
      host: config.host,
      port: config.port,
      user: config.user
    });
    
    // Настройки письма с улучшенными заголовками для Gmail
    const mailOptions = {
      from: `"${appName}" <${config.user}>`,
      to: email,
      subject: `Код подтверждения для ${appName}`,
      html: EMAIL_TEMPLATES.confirmation(code, appName),
      text: `Ваш код подтверждения для ${appName}: ${code}\n\nКод действителен в течение 15 минут.`,
      headers: {
        'X-Mailer': `${appName} Email Service`,
        'X-Priority': '3',
        'X-MSMail-Priority': 'Normal',
        'Importance': 'Normal',
        'X-Report-Abuse': 'Please report abuse to admin@chill-music.ru',
        'List-Unsubscribe': '<mailto:unsubscribe@chill-music.ru>',
        'Reply-To': config.user,
        
      },
      // Добавляем альтернативные заголовки для лучшей доставки
      alternatives: [
        {
          contentType: 'text/plain; charset=utf-8',
          content: `Ваш код подтверждения для ${appName}: ${code}\n\nКод действителен в течение 15 минут.\n\nЕсли вы не запрашивали этот код, проигнорируйте это письмо.\n\nС уважением,\nКоманда ${appName}`
        }
      ]
    };
    
    console.log('📤 Отправляем письмо...');
    console.log('📧 От кого:', mailOptions.from);
    console.log('📧 Кому:', mailOptions.to);
    
    // Устанавливаем таймаут (увеличиваем для Reg.ru)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Email sending timeout after 30 seconds')), 30000);
    });
    
    const sendPromise = transporter.sendMail(mailOptions);
    const info = await Promise.race([sendPromise, timeoutPromise]);
    
    console.log('✅ Письмо отправлено успешно:', info.messageId);
    console.log('🔑 Код:', code);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Ошибка отправки письма:', error.message);
    console.error('❌ Детали ошибки:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response
    });
    throw new Error(`Не удалось отправить письмо: ${error.message}`);
  }
}

// Отправляем приветственное письмо
async function sendWelcomeEmail(email, userName, appName = 'ChillMusic') {
  try {
    console.log(`📧 Отправка приветственного письма на ${email}`);
    
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${appName}" <${getConfigInfo().user}>`,
      to: email,
      subject: `Добро пожаловать в ${appName}!`,
      html: EMAIL_TEMPLATES.welcome(userName, appName)
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Приветственное письмо отправлено:', info.messageId);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Ошибка отправки приветственного письма:', error.message);
    throw new Error(`Не удалось отправить приветственное письмо: ${error.message}`);
  }
}

// Получаем статистику кодов
function getConfirmationStats() {
  const now = Date.now();
  const active = Array.from(confirmationCodes.values()).filter(
    data => data.expiresAt > now
  ).length;
  
  return {
    active,
    total: confirmationCodes.size,
    expired: confirmationCodes.size - active
  };
}

module.exports = {
  sendConfirmationEmail,
  sendWelcomeEmail,
  verifyConfirmationCode,
  generateConfirmationCode,
  getConfirmationStats,
  testSMTPConnection,
  getConfigInfo
};
