const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');

// Загружаем переменные окружения из .env файла
require('dotenv').config();

// Импортируем новый email сервис
const emailService = require('./email-service');


const getAverageColor = require('fast-average-color').getAverageColor;

const axios = require('axios');
const cheerio = require('cheerio');


const SESSION_FILE = path.join(os.homedir(), '.chillmusic_session');

function saveSession(token) {
  fs.writeFileSync(SESSION_FILE, token, 'utf8');
}

function loadSession() {
  try {
    return fs.readFileSync(SESSION_FILE, 'utf8');
  } catch (e) {
    return null;
  }
}


function clearSession() {
  try {
    fs.unlinkSync(SESSION_FILE);
  } catch (e) {
    console.error('Error clearing session:', e);
  }
}


// Инициализация email сервиса при запуске
async function initializeEmailService() {
  try {
    console.log('🔧 Инициализация email сервиса...');
    const result = await emailService.testSMTPConnection();
    
    if (result.success) {
      console.log('✅ Email сервис готов к работе');
      const config = emailService.getConfigInfo();
      console.log(`📧 Провайдер: ${config.provider}, Host: ${config.host}`);
    } else {
      console.log('⚠️ Email сервис недоступен:', result.error);
    }
  } catch (error) {
    console.error('❌ Ошибка инициализации email сервиса:', error.message);
  }
}



// Конфигурация БД
const dbConfig = {
  host: 'server82.hosting.reg.ru',
  user: 'u2819853_default',
  password: 'SbMwsewMI531Xm6G',
  database: 'u2819853_default',
  waitForConnections: true,
  connectionLimit: 5,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  idleTimeout: 300000,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// Кэш для релизов
let releasesCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 30 * 1000; // 30 секунд

// Функция для очистки кэша релизов
function clearReleasesCache() {
  releasesCache = null;
  cacheTimestamp = null;
  console.log('Кэш релизов очищен');
}

// Функция для проверки состояния кэша
function getCacheStatus() {
  const now = Date.now();
  const isCacheValid = releasesCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION;
  const timeLeft = cacheTimestamp ? Math.max(0, CACHE_DURATION - (now - cacheTimestamp)) : 0;
  
  return {
    hasCache: !!releasesCache,
    isCacheValid,
    timeLeft: Math.round(timeLeft / 1000),
    cacheSize: releasesCache ? releasesCache.length : 0
  };
}

// Альтернативный быстрый метод загрузки релизов
ipcMain.handle('get-releases-fast', async () => {
  console.log('=== ЭКСТРЕННАЯ БЫСТРАЯ ЗАГРУЗКА ===');
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Самый простой запрос без JOIN'ов
    const [rows] = await connection.query(`
        SELECT 
          id,
          title,
          type,
          host_rating,
          average_user_rating,
          add_date,
          image
        FROM Releases
        ORDER BY add_date DESC
        LIMIT 50
    `);
    
    const result = rows.map(row => ({
      id: row.id,
      title: row.title,
      type: row.type,
      host_rating: row.host_rating,
      average_user_rating: row.average_user_rating,
      add_date: row.add_date,
      image: row.image ? row.image : null,
      artist_names: 'Загрузка...',
      artist_ids: [],
      artist_name: 'Загрузка...',
      artist_id: null
    }));
    
    console.log(`Быстро загружено ${result.length} релизов`);
    return result;
    
  } catch (err) {
    console.error('Ошибка быстрой загрузки:', err.message);
    throw new Error(`Быстрая загрузка не удалась: ${err.message}`);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Добавляем обработчики событий пула для отладки
pool.on('connection', function (connection) {
  console.log('Новое соединение установлено с БД');
});

pool.on('acquire', function (connection) {
  console.log('Соединение получено из пула');
});

pool.on('release', function (connection) {
  console.log('Соединение возвращено в пул');
});

pool.on('error', function(err) {
  console.error('Ошибка пула соединений:', err);
});

ipcMain.handle('get-all-releases', async () => {
  let connection;
  try {
    connection = await pool.getConnection();

    const [rows] = await connection.query(`
      SELECT 
        r.id,
        r.title,
        r.type,
        r.host_rating,
        r.average_user_rating,
        r.add_date,
        r.image,
        ar.artist_names,
        ar.artist_ids
      FROM Releases r
      LEFT JOIN (
        SELECT 
          ra.release_id,
          GROUP_CONCAT(a.name ORDER BY a.name SEPARATOR ', ') AS artist_names,
          GROUP_CONCAT(a.id ORDER BY a.id SEPARATOR ',') AS artist_ids
        FROM ReleaseArtists ra
        JOIN Artists a ON a.id = ra.artist_id
        GROUP BY ra.release_id
      ) ar ON ar.release_id = r.id
      ORDER BY r.add_date DESC
    `);

    return rows.map(row => {
      const artistIds = row.artist_ids ? String(row.artist_ids).split(',').map(v => v.trim()).filter(Boolean) : [];
      return {
        id: row.id,
        title: row.title,
        type: row.type,
        host_rating: row.host_rating,
        average_user_rating: row.average_user_rating,
        add_date: row.add_date,
        image: row.image ? row.image : null,
        artist_names: row.artist_names || 'Неизвестный исполнитель',
        artist_ids: artistIds,
        // совместимость со старым рендером
        artist_name: row.artist_names || 'Неизвестный исполнитель',
        artist_id: artistIds.length ? artistIds[0] : null
      };
    });
  } catch (err) {
    console.error('Ошибка загрузки релизов:', {
      message: err.message,
      code: err.code,
      errno: err.errno,
      sqlState: err.sqlState,
      sqlMessage: err.sqlMessage,
      stack: err.stack
    });
    throw new Error('Не удалось загрузить релизы');
  } finally {
    if (connection) connection.release();
  }
});

// Проверка подключения к БД
async function testDatabase() {
  let conn;
  try {
    console.log('=== ТЕСТ ПОДКЛЮЧЕНИЯ К БАЗЕ ДАННЫХ ===');
    console.log('Конфигурация БД:', {
      host: dbConfig.host,
      user: dbConfig.user,
      database: dbConfig.database,
      connectionLimit: dbConfig.connectionLimit
    });
    
    conn = await pool.getConnection();
    console.log('Соединение с БД установлено');
    
    const [rows] = await conn.query('SELECT NOW()');
    console.log('Database connection OK. Current time:', rows[0]['NOW()']);
    
    // Проверяем версию MySQL
    const [versionRows] = await conn.query('SELECT VERSION() as version');
    console.log('MySQL version:', versionRows[0].version);
    
    // Проверяем существование основных таблиц
    const [tables] = await conn.query("SHOW TABLES");
    const tableNames = tables.map(t => Object.values(t)[0]);
    console.log('Найденные таблицы:', tableNames);
    
    const requiredTables = ['Releases', 'ReleaseArtists', 'Artists', 'Users'];
    const missingTables = requiredTables.filter(table => !tableNames.includes(table));
    
    if (missingTables.length > 0) {
      console.warn('⚠️ Отсутствуют таблицы:', missingTables);
    } else {
      console.log('✅ Все необходимые таблицы найдены');
    }
    
    console.log('=== ТЕСТ ПОДКЛЮЧЕНИЯ ЗАВЕРШЕН ===');
  } catch (err) {
    console.error('=== ОШИБКА ПОДКЛЮЧЕНИЯ К БД ===');
    console.error('Тип ошибки:', err.constructor.name);
    console.error('Сообщение:', err.message);
    console.error('Код ошибки:', err.code);
    console.error('SQL State:', err.sqlState);
    console.error('Stack trace:', err.stack);
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

// Инициализация необходимых таблиц
async function initializeTables() {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Проверяем и добавляем колонку average_user_rating в таблицу Releases, если её нет
    try {
      await connection.query('SELECT average_user_rating FROM Releases LIMIT 1');
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        console.log('Добавляем колонку average_user_rating в таблицу Releases...');
        await connection.query('ALTER TABLE Releases ADD COLUMN average_user_rating DECIMAL(3,1) DEFAULT NULL');
        console.log('Колонка average_user_rating добавлена успешно');
      }
    }
    
    // Создаем таблицу UserReleaseRatings, если не существует
    const [userRatingsTables] = await connection.query("SHOW TABLES LIKE 'UserReleaseRatings'");
    if (userRatingsTables.length === 0) {
      console.log('Создаем таблицу UserReleaseRatings...');
      await connection.query(`
        CREATE TABLE UserReleaseRatings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          release_id INT NOT NULL,
          textValue DECIMAL(3,1) DEFAULT 5.0,
          structureValue DECIMAL(3,1) DEFAULT 5.0,
          soundValue DECIMAL(3,1) DEFAULT 5.0,
          voiceValue DECIMAL(3,1) DEFAULT 5.0,
          individualityValue DECIMAL(3,1) DEFAULT 5.0,
          atmosphereValue DECIMAL(3,1) DEFAULT 5.0,
          score DECIMAL(3,1) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user_release (user_id, release_id),
          FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
          FOREIGN KEY (release_id) REFERENCES Releases(id) ON DELETE CASCADE
        )
      `);
      console.log('Таблица UserReleaseRatings создана успешно');
    }
    
    // Создаем таблицу UserFavorites, если не существует
    const [userFavoritesTables] = await connection.query("SHOW TABLES LIKE 'UserFavorites'");
    if (userFavoritesTables.length === 0) {
      console.log('Создаем таблицу UserFavorites...');
      await connection.query(`
        CREATE TABLE UserFavorites (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          release_id INT NOT NULL,
          added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_pinned BOOLEAN DEFAULT FALSE,
          UNIQUE KEY unique_user_release_fav (user_id, release_id),
          FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
          FOREIGN KEY (release_id) REFERENCES Releases(id) ON DELETE CASCADE
        )
      `);
      console.log('Таблица UserFavorites создана успешно');
    }
    
    // Создаем таблицу UserArtistFavorites, если не существует
    const [userArtistFavoritesTables] = await connection.query("SHOW TABLES LIKE 'UserArtistFavorites'");
    if (userArtistFavoritesTables.length === 0) {
      console.log('Создаем таблицу UserArtistFavorites...');
      await connection.query(`
        CREATE TABLE UserArtistFavorites (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          artist_id INT NOT NULL,
          added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_pinned BOOLEAN DEFAULT FALSE,
          avatar_cache LONGBLOB,
          UNIQUE KEY unique_user_artist_fav (user_id, artist_id),
          FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
          FOREIGN KEY (artist_id) REFERENCES Artists(id) ON DELETE CASCADE
        )
      `);
      console.log('Таблица UserArtistFavorites создана успешно');
    }
    
    // Создаем таблицу PostLikes, если не существует
    const [postLikesTables] = await connection.query("SHOW TABLES LIKE 'post_likes'");
    if (postLikesTables.length === 0) {
      console.log('Создаем таблицу post_likes...');
      await connection.query(`
        CREATE TABLE post_likes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          post_id INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user_post_like (user_id, post_id),
          FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
          FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
        )
      `);
      console.log('Таблица post_likes создана успешно');
    }
    
    // Создаем таблицу Posts, если не существует
    const [postsTables] = await connection.query("SHOW TABLES LIKE 'posts'");
    if (postsTables.length === 0) {
      console.log('Создаем таблицу posts...');
      await connection.query(`
        CREATE TABLE posts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          author_id INT NOT NULL,
          text TEXT NOT NULL,
          image_url VARCHAR(500) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (author_id) REFERENCES Users(id) ON DELETE CASCADE
        )
      `);
      console.log('Таблица posts создана успешно');
    }
    
    // Добавляем поле is_admin в таблицу Users, если его нет
    try {
      await connection.query('SELECT is_admin FROM Users LIMIT 1');
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        console.log('Добавляем поле is_admin в таблицу Users...');
        await connection.query('ALTER TABLE Users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE');
        console.log('Поле is_admin добавлено успешно');
      }
    }
    
    // Создаем таблицу UserLoginHistory, если не существует
    const [loginHistoryTables] = await connection.query("SHOW TABLES LIKE 'UserLoginHistory'");
    if (loginHistoryTables.length === 0) {
      console.log('Создаем таблицу UserLoginHistory...');
      await connection.query(`
        CREATE TABLE UserLoginHistory (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          ip_address VARCHAR(64) NULL,
          os_info VARCHAR(255) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
        )
      `);
      console.log('Таблица UserLoginHistory создана успешно');
    }

    // Добавляем поля для 2FA в таблицу Users, если их нет
    try {
      await connection.query('SELECT twofa_secret, is_twofa_enabled FROM Users LIMIT 1');
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        console.log('Добавляем поля twofa_secret и is_twofa_enabled в таблицу Users...');
        try { await connection.query('ALTER TABLE Users ADD COLUMN twofa_secret VARBINARY(128) NULL'); } catch (e) {}
        try { await connection.query('ALTER TABLE Users ADD COLUMN is_twofa_enabled BOOLEAN DEFAULT FALSE'); } catch (e) {}
        console.log('Поля для 2FA добавлены (или уже существуют)');
      }
    }

  } catch (err) {
    console.error('Ошибка инициализации таблиц:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

let mainWindow;

function createWindow() {
  
  const iconPath = path.join(__dirname, 'images', 'favicon.ico');
  mainWindow = new BrowserWindow({
    width: 1580,
    height: 980,
    icon: iconPath,
    //titleBarStyle: 'hidden',
    //frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Очищаем кэш при создании окна
  clearReleasesCache();
  console.log('Кэш очищен при создании окна');

  require('electron').Menu.setApplicationMenu(null)
  mainWindow.loadFile('home.html');
  mainWindow.webContents.openDevTools();
  
  // Инициализируем email сервис после создания окна
  initializeEmailService();
}

// Обработчики IPC
ipcMain.handle('send-confirmation-code', async (event, email) => {
  try {
    console.log(`🔐 Запрос на отправку кода подтверждения для: ${email}`);
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.error('❌ Некорректный формат email:', email);
      throw new Error('Некорректный формат email');
    }

    // Используем новый email сервис
    const result = await emailService.sendConfirmationEmail(email, 'ChillMusic');
    console.log(`✅ Код подтверждения успешно отправлен на ${email}`);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Ошибка отправки кода:', error);
    console.error('Детали ошибки:', {
      email: email,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
});

ipcMain.handle('verify-confirmation-code', async (event, { email, code }) => {
  try {
    // Используем новый email сервис для проверки кода
    emailService.verifyConfirmationCode(email, code);
    return { success: true };
  } catch (error) {
    console.error('Ошибка проверки кода:', error);
    throw error;
  }
});

// Добавляем в раздел с другими ipcMain.handle
ipcMain.handle('save-token', (event, token) => {
  try {
    const SESSION_FILE = path.join(os.homedir(), '.chillmusic_session');
    fs.writeFileSync(SESSION_FILE, token, 'utf8');
    return { success: true };
  } catch (err) {
    console.error('Error saving token:', err);
    return { success: false };
  }
});


ipcMain.handle('register-user', async (event, userData) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Проверка существующего пользователя
    const [existingUsers] = await connection.query(
      'SELECT id FROM Users WHERE email = ?',
      [userData.email]
    );
    
    if (existingUsers.length > 0) {
      throw new Error('Пользователь с таким email уже существует');
    }
    
    // Хеширование пароля с солью
    const salt = crypto.randomBytes(16).toString('hex');
    const hashedPassword = crypto
      .pbkdf2Sync(userData.password, salt, 1000, 64, 'sha512')
      .toString('hex');
    
    // Создание пользователя
    const [result] = await connection.query(
      `INSERT INTO Users 
       (email, display_name, password_hash, salt, is_verified) 
       VALUES (?, ?, ?, ?, ?)`,
      [userData.email, userData.displayName, hashedPassword, salt, true]
    );
    
    return { success: true, userId: result.insertId };
  } catch (err) {
    console.error('Registration error:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
});

// Получить список доступных лет по датам релизов
ipcMain.handle('get-release-years', async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query(`
      SELECT DISTINCT YEAR(add_date) AS yr
      FROM Releases
      WHERE add_date IS NOT NULL
      ORDER BY yr DESC
    `);
    // Возвращаем массив, например [2025, 2024, 2021]
    return rows.map(r => r.yr);
  } catch (err) {
    console.error('Error fetching release years:', err);
    return [];
  } finally {
    if (connection) connection.release();
  }
});

app.on('window-all-closed', () => {
  pool.end();
  app.quit();
});

// IPC обработчики
ipcMain.handle('get-releases', async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [rows] = await connection.query(`
        SELECT 
          r.id,
          r.title,
          r.type,
          r.host_rating,
          r.average_user_rating,
          r.add_date,
          r.image,
          ar.artist_names,
          ar.artist_ids
        FROM Releases r
        LEFT JOIN (
          SELECT 
            ra.release_id,
            GROUP_CONCAT(a.name ORDER BY a.name SEPARATOR ', ') AS artist_names,
            GROUP_CONCAT(a.id ORDER BY a.id SEPARATOR ',') AS artist_ids
          FROM ReleaseArtists ra
          JOIN Artists a ON a.id = ra.artist_id
          GROUP BY ra.release_id
        ) ar ON ar.release_id = r.id
        ORDER BY r.add_date DESC
        LIMIT 10
    `);
    
    return rows.map(row => ({
      id: row.id,
      title: row.title,
      type: row.type,
      host_rating: row.host_rating,
      average_user_rating: row.average_user_rating,
      add_date: row.add_date,
      image: row.image ? row.image : null,
      artist_names: row.artist_names || 'Неизвестный исполнитель',
      artist_ids: row.artist_ids ? row.artist_ids.split(',').map(id => id.trim()) : [],
      // Для совместимости со старым кодом
      artist_name: row.artist_names || 'Неизвестный исполнитель',
      artist_id: row.artist_ids ? row.artist_ids.split(',')[0].trim() : null
    }));
    
  } catch (err) {
    console.error('Database error:', err);
    throw new Error('Не удалось загрузить данные');
  } finally {
    if (connection) connection.release();
  }
});

ipcMain.handle('get-paged-releases', async (_event, { page = 1, pageSize = 20, filters = {} }) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const offset = (page - 1) * pageSize;

    // Подготавливаем условия фильтрации
    const whereClauses = [];
    const params = [];
    if (filters.year) { whereClauses.push('YEAR(r.add_date) = ?'); params.push(filters.year); }
    if (typeof filters.month === 'number') { whereClauses.push('MONTH(r.add_date) = ?'); params.push(filters.month + 1); }
    if (filters.type) { whereClauses.push('r.type = ?'); params.push(filters.type); }
    // Диапазон рейтинга: выбираем столбец по источнику
    const ratingCol = (filters.ratingSource === 'host') ? 'r.host_rating' : 'r.average_user_rating';
    if (typeof filters.ratingMin === 'number') { whereClauses.push(`${ratingCol} >= ?`); params.push(filters.ratingMin); }
    if (typeof filters.ratingMax === 'number') { whereClauses.push(`${ratingCol} <= ?`); params.push(filters.ratingMax); }
    const whereSql = whereClauses.length ? ('WHERE ' + whereClauses.join(' AND ')) : '';

    // всего записей для подсчёта страниц
    const [[{ total }]] = await connection.query(`SELECT COUNT(*) as total FROM Releases r ${whereSql}`, params);

    // берем релизы постранично
    const [rows] = await connection.query(`
      SELECT 
        r.id,
        r.title,
        r.type,
        r.host_rating,
        r.average_user_rating,
        r.add_date,
        r.image,
        GROUP_CONCAT(DISTINCT a.name ORDER BY a.name SEPARATOR ', ') AS artist_names,
        GROUP_CONCAT(DISTINCT a.id ORDER BY a.id SEPARATOR ',') AS artist_ids
      FROM Releases r
      LEFT JOIN ReleaseArtists ra ON r.id = ra.release_id
      LEFT JOIN Artists a ON ra.artist_id = a.id
      ${whereSql}
      GROUP BY r.id
      ORDER BY r.add_date DESC
      LIMIT ? OFFSET ?
    `, [...params, pageSize, offset]);

    return {
      releases: rows.map(row => ({
        id: row.id,
        title: row.title,
        type: row.type,
        host_rating: row.host_rating,
        average_user_rating: row.average_user_rating,
        add_date: row.add_date,
        image: row.image ? row.image : null,
        artist_names: row.artist_names || 'Неизвестный исполнитель',
        artist_ids: row.artist_ids ? String(row.artist_ids).split(',').map(v => v.trim()).filter(Boolean) : [],
        // совместимость
        artist_name: row.artist_names || 'Неизвестный исполнитель',
        artist_id: row.artist_ids ? String(row.artist_ids).split(',')[0] : null
      })),
      total
    };

  } catch (err) {
    console.error('Database error:', err);
    throw new Error('Не удалось загрузить релизы');
  } finally {
    if (connection) connection.release();
  }
});

// Сохранить аватар (байты + mime)
ipcMain.handle('update-user-avatar', async (event, { bytes, mime }) => {
  const token = loadSession();
  if (!token) throw new Error('Не авторизован');

  let connection;
  try {
    connection = await pool.getConnection();
    const buffer = bytes ? Buffer.from(bytes) : null; // bytes = Uint8Array / number[]
    await connection.query(
      'UPDATE Users SET avatar = ?, avatar_mime = ? WHERE auth_token = ?',
      [buffer, mime || 'application/octet-stream', token]
    );
    return { success: true };
  } catch (err) {
    console.error('Error updating avatar:', err);
    throw err;
  } finally { if (connection) connection.release(); }
});

// Сохранить баннер (байты + mime)
ipcMain.handle('update-user-banner', async (event, { bytes, mime }) => {
  const token = loadSession();
  if (!token) throw new Error('Не авторизован');

  let connection;
  try {
    connection = await pool.getConnection();
    const buffer = bytes ? Buffer.from(bytes) : null;
    await connection.query(
      'UPDATE Users SET banner = ?, banner_mime = ? WHERE auth_token = ?',
      [buffer, mime || 'application/octet-stream', token]
    );
    return { success: true };
  } catch (err) {
    console.error('Error updating banner:', err);
    throw err;
  } finally { if (connection) connection.release(); }
});

// Сменить ник
ipcMain.handle('update-user-name', async (event, { displayName }) => {
  const token = loadSession();
  if (!token) throw new Error('Не авторизован');

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      'UPDATE Users SET display_name = ? WHERE auth_token = ?',
      [displayName, token]
    );
    return { success: true };
  } catch (err) {
    console.error('Error updating display name:', err);
    throw err;
  } finally { if (connection) connection.release(); }
});



ipcMain.handle('get-rating-releases', async (_event, { month, year }) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [rows] = await connection.query(`
      SELECT 
        r.id,
        r.title,
        r.type,
        r.host_rating,
        r.average_user_rating,
        r.add_date,
        r.image,
        GROUP_CONCAT(a.name SEPARATOR ', ') AS artist_names,
        GROUP_CONCAT(a.id SEPARATOR ', ') AS artist_ids
      FROM Releases r
      LEFT JOIN ReleaseArtists ra ON r.id = ra.release_id
      LEFT JOIN Artists a ON ra.artist_id = a.id
      WHERE
        MONTH(r.add_date) = ?
        AND YEAR(r.add_date) = ?
      GROUP BY r.id
      ORDER BY r.add_date DESC
    `, [month + 1, year]);

    return rows.map(row => ({
      id: row.id,
      title: row.title,
      type: row.type,
      host_rating: row.host_rating,
      average_user_rating: row.average_user_rating,
      add_date: row.add_date,
      image: row.image ? row.image : null,
      artist_names: row.artist_names || 'Неизвестный исполнитель',
      artist_ids: row.artist_ids ? row.artist_ids.split(',').map(id => id.trim()) : [],
      // Для совместимости со старым кодом
      artist_name: row.artist_names || 'Неизвестный исполнитель',
      artist_id: row.artist_ids ? row.artist_ids.split(',')[0].trim() : null
    }));
  } catch (err) {
    console.error('Database error:', err);
    throw new Error('Не удалось загрузить рейтинг');
  } finally {
    if (connection) connection.release();
  }
});


// Унифицированный поиск релизов, артистов и пользователей
ipcMain.handle('unifiedSearch', async (event, searchQuery) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Поиск релизов
    const [releaseRows] = await connection.query(`
      SELECT 
        r.id,
        r.title,
        r.type,
        r.host_rating,
        r.average_user_rating,
        r.add_date,
        r.image,
        GROUP_CONCAT(a.name SEPARATOR ', ') AS artist_names,
        MIN(a.id) AS artist_id,
        'release' as result_type
      FROM Releases r
      JOIN ReleaseArtists ra ON r.id = ra.release_id
      JOIN Artists a ON ra.artist_id = a.id
      WHERE r.title LIKE ? OR a.name LIKE ?
      GROUP BY r.id
      ORDER BY r.add_date DESC
      LIMIT 20
    `, [`%${searchQuery}%`, `%${searchQuery}%`]);
    
    // Поиск артистов с аватарами (из любого пользователя)
    const [artistRows] = await connection.query(`
      SELECT 
        a.id,
        a.name,
        'artist' as result_type,
        uaf.avatar_cache
      FROM Artists a
      LEFT JOIN UserArtistFavorites uaf ON a.id = uaf.artist_id
      WHERE a.name LIKE ?
      GROUP BY a.id
      ORDER BY a.name ASC
      LIMIT 10
    `, [`%${searchQuery}%`]);

    // Поиск пользователей (по display_name и email)
    const [userRows] = await connection.query(`
      SELECT 
        id,
        display_name,
        email,
        avatar,
        'user' as result_type
      FROM Users
      WHERE display_name LIKE ? OR email LIKE ?
      ORDER BY display_name ASC
      LIMIT 10
    `, [`%${searchQuery}%`, `%${searchQuery}%`]);
    
    // Объединяем результаты
    const releases = releaseRows.map(row => ({
      id: row.id,
      title: row.title,
      type: row.type,
      host_rating: row.host_rating,
      average_user_rating: row.average_user_rating,
      add_date: row.add_date,
      image: row.image ? row.image : null,
      artist_name: row.artist_names,
      artist_id: row.artist_id,
      result_type: 'release'
    }));
    
    const artists = await Promise.all(artistRows.map(async (row) => {
      let avatar = null;
      
      // Сначала проверяем кэшированный аватар
      if (row.avatar_cache) {
        avatar = new Uint8Array(row.avatar_cache);
      } else {
        // Если нет кэшированного аватара, пытаемся найти через внешние источники
        let avatarUrl = null;
        
        // Проверяем кэш изображений
        if (artistImageCache.has(row.name)) {
          avatarUrl = artistImageCache.get(row.name);
        } else {
          // Пытаемся найти изображение через несколько источников
          avatarUrl = await findArtistImage(row.name);
          
          // Сохраняем в кэш (даже если null)
          artistImageCache.set(row.name, avatarUrl);
        }
        
        // Если нашли аватар, скачиваем его
        if (avatarUrl) {
          try {
            const response = await axios.get(avatarUrl, { 
              responseType: 'arraybuffer',
              timeout: 5000 // Уменьшаем таймаут для поиска
            });
            avatar = new Uint8Array(response.data);
          } catch (downloadError) {
            console.error('Ошибка скачивания аватара для поиска:', downloadError);
          }
        }
      }
      
      return {
        id: row.id,
        name: row.name,
        result_type: 'artist',
        avatar: avatar
      };
    }));
    
    const users = userRows.map(row => ({
      id: row.id,
      displayName: row.display_name || row.email,
      email: row.email,
      result_type: 'user',
      avatar: row.avatar ? new Uint8Array(row.avatar) : null
    }));

    return {
      releases,
      artists,
      users,
      total: releases.length + artists.length + users.length
    };
    
  } catch (err) {
    console.error('Unified search error:', err);
    throw new Error('Не удалось выполнить поиск');
  } finally {
    if (connection) connection.release();
  }
});

// Поиск релизов для страницы оценки (использует механику unifiedSearch)
ipcMain.handle('searchReleases', async (event, searchQuery) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Поиск релизов (та же логика, что и в unifiedSearch)
    const [releaseRows] = await connection.query(`
      SELECT 
        r.id,
        r.title,
        r.type,
        r.host_rating,
        r.average_user_rating,
        r.add_date,
        r.image,
        GROUP_CONCAT(a.name SEPARATOR ', ') AS artist_names,
        MIN(a.id) AS artist_id,
        'release' as result_type
      FROM Releases r
      JOIN ReleaseArtists ra ON r.id = ra.release_id
      JOIN Artists a ON ra.artist_id = a.id
      WHERE r.title LIKE ? OR a.name LIKE ?
      GROUP BY r.id
      ORDER BY r.add_date DESC
      LIMIT 20
    `, [`%${searchQuery}%`, `%${searchQuery}%`]);
    
    // Обрабатываем результаты (та же логика, что и в unifiedSearch)
    const releases = releaseRows.map(row => ({
      id: row.id,
      title: row.title,
      type: row.type,
      host_rating: row.host_rating,
      average_user_rating: row.average_user_rating,
      add_date: row.add_date,
      image: row.image ? row.image : null,
      artist_name: row.artist_names,
      artist_id: row.artist_id,
      result_type: 'release'
    }));
    
    return {
      releases,
      total: releases.length
    };
    
  } catch (err) {
    console.error('Search releases error:', err);
    throw new Error('Не удалось выполнить поиск релизов');
  } finally {
    if (connection) connection.release();
  }
});

ipcMain.handle('update-user-about', async (event, { about }) => {
  const token = loadSession();
  if (!token) throw new Error('Не авторизован');

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(
      'UPDATE Users SET about = ? WHERE auth_token = ?',
      [about, token]
    );
    return { success: true };
  } catch (err) {
    console.error('Error updating about:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
});

// Обновленный обработчик проверки авторизации
ipcMain.handle('check-auth', async () => {
  const token = loadSession();
  if (!token) return null;

  let connection;
  try {
    connection = await pool.getConnection();
    const [users] = await connection.query(
      'SELECT id, email, display_name, about, avatar, avatar_mime, banner, banner_mime, created_at, is_admin, is_twofa_enabled FROM Users WHERE auth_token = ?',
      [token]
    );
    connection.release();

    if (!users.length) { clearSession(); return null; }
    const u = users[0];

    console.log('check-auth: Found user:', {
      id: u.id,
      display_name: u.display_name,
      hasAvatar: !!u.avatar,
      hasBanner: !!u.banner,
      avatarSize: u.avatar ? u.avatar.length : 0,
      bannerSize: u.banner ? u.banner.length : 0
    });

    // Buffer -> Uint8Array (по IPC уедет нормально)
    const avatarBytes = u.avatar ? new Uint8Array(u.avatar) : null;
    const bannerBytes = u.banner ? new Uint8Array(u.banner) : null;

    const result = {
      id: u.id,
      email: u.email,
      displayName: u.display_name,
      about: u.about || '',
      avatarBytes,
      avatarMime: u.avatar_mime || null,
      bannerBytes,
      bannerMime: u.banner_mime || null,
      registrationDate: u.created_at,
      isAdmin: u.is_admin || 0,
      isAdminLevel2: u.is_admin === 2,
      isTwoFAEnabled: !!u.is_twofa_enabled
    };
    
    console.log('=== DEBUG check-auth ===');
    console.log('User is_admin from DB:', u.is_admin);
    console.log('Calculated isAdmin:', result.isAdmin);
    console.log('Calculated isAdminLevel2:', result.isAdminLevel2);

    console.log('check-auth: Returning user data:', {
      id: result.id,
      displayName: result.displayName,
      hasAvatar: !!result.avatarBytes,
      hasBanner: !!result.bannerBytes,
      avatarSize: result.avatarBytes ? result.avatarBytes.length : 0,
      bannerSize: result.bannerBytes ? result.bannerBytes.length : 0
    });

    return result;
  } catch (err) {
    console.error('Auth check error:', err);
    return null;
  }
});



// Поиск артистов
ipcMain.handle('searchArtists', async (event, query) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query(
      'SELECT id, name FROM Artists WHERE name LIKE ? LIMIT 5',
      [`%${query}%`]
    );
    return rows;
  } catch (err) {
    console.error('Error searching artists:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
});

// Создание нового артиста
ipcMain.handle('createArtist', async (event, name) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Проверяем, существует ли уже артист
    const [existing] = await connection.query(
      'SELECT id FROM Artists WHERE name = ?',
      [name]
    );
    
    if (existing.length > 0) {
      return existing[0].id;
    }
    
    // Создаем нового артиста
    const [result] = await connection.query(
      'INSERT INTO Artists (name) VALUES (?)',
      [name]
    );
    
    return result.insertId;
  } catch (err) {
    console.error('Error creating artist:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
});

ipcMain.handle('submitRating', async (event, { releaseId, userId, ratings }) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Извлекаем значения из ratings
    const { textValue, structureValue, soundValue, voiceValue, individualityValue, atmosphereValue } = ratings;
    
    // Рассчитываем рейтинг по вашей формуле
    const arithmeticMean = (textValue + structureValue + soundValue + voiceValue + individualityValue + atmosphereValue) / 6;
    const geometricMean = Math.pow(
      textValue * structureValue * soundValue * voiceValue * individualityValue * atmosphereValue, 
      1/6
    );
    const host_rating = 0.5 * (arithmeticMean + geometricMean);
    
    // Начинаем транзакцию
    await connection.beginTransaction();
    
  
    // Обновляем host_rating и отдельные значения в Releases
    await connection.query(
      `UPDATE Releases SET
        textValue = ?,
        structureValue = ?,
        soundValue = ?,
        voiceValue = ?,
        individualityValue = ?,
        atmosphereValue = ?,
        host_rating = ?
      WHERE id = ?`,
      [
        textValue,
        structureValue,
        soundValue,
        voiceValue,
        individualityValue,
        atmosphereValue,
        host_rating,
        releaseId
      ]
    );
    
    // Фиксируем транзакцию
    await connection.commit();
    
    return { 
      success: true
    };
  } catch (err) {
    // Откатываем транзакцию при ошибке
    if (connection) await connection.rollback();
    console.error('Ошибка при сохранении оценки:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
});

// Сохранение пользовательской оценки релиза и обновление среднего пользовательского рейтинга
ipcMain.handle('submit-user-rating', async (event, { releaseId, userId, ratings }) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const { textValue, structureValue, soundValue, voiceValue, individualityValue, atmosphereValue } = ratings;

    const arithmeticMean = (textValue + structureValue + soundValue + voiceValue + individualityValue + atmosphereValue) / 6;
    const geometricMean = Math.pow(textValue * structureValue * soundValue * voiceValue * individualityValue * atmosphereValue, 1/6);
    const user_score = 0.5 * (arithmeticMean + geometricMean);

    await connection.beginTransaction();

    // UPSERT пользовательской оценки
    await connection.query(
      `INSERT INTO UserReleaseRatings (
         user_id, release_id,
         textValue, structureValue, soundValue, voiceValue, individualityValue, atmosphereValue,
         score, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         textValue = VALUES(textValue),
         structureValue = VALUES(structureValue),
         soundValue = VALUES(soundValue),
         voiceValue = VALUES(voiceValue),
         individualityValue = VALUES(individualityValue),
         atmosphereValue = VALUES(atmosphereValue),
         score = VALUES(score),
         updated_at = NOW()`,
      [
        userId, releaseId,
        textValue, structureValue, soundValue, voiceValue, individualityValue, atmosphereValue,
        user_score
      ]
    );

    // Пересчет среднего пользовательского рейтинга
    const [avgRows] = await connection.query(
      `SELECT AVG(score) AS avg_score FROM UserReleaseRatings WHERE release_id = ?`,
      [releaseId]
    );

    const avgScore = avgRows[0]?.avg_score || null;
    console.log('Calculating average user rating:', { releaseId, avgScore, avgRows });

    await connection.query(
      `UPDATE Releases SET average_user_rating = ? WHERE id = ?`,
      [avgScore, releaseId]
    );
    
    console.log('Updated average_user_rating in Releases table:', { releaseId, avgScore });

    await connection.commit();

    return { success: true, average_user_rating: avgScore, user_score };
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('Ошибка сохранения пользовательской оценки:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
});

// Получение списка пользовательских оценок релиза
ipcMain.handle('get-release-user-ratings', async (event, releaseId) => {
  let connection;
  try {
    console.log('Запрос оценок для релиза:', releaseId);
    connection = await pool.getConnection();
    
    const [rows] = await connection.query(
      `SELECT urr.user_id, u.display_name, urr.score, urr.textValue, urr.structureValue, urr.soundValue,
              urr.voiceValue, urr.individualityValue, urr.atmosphereValue, urr.updated_at
       FROM UserReleaseRatings urr
       JOIN Users u ON u.id = urr.user_id
       WHERE urr.release_id = ?
       ORDER BY urr.updated_at DESC`,
      [releaseId]
    );
    console.log('Найдено оценок:', rows.length);
    return rows;
  } catch (err) {
    console.error('Ошибка получения пользовательских оценок:', err);
    console.error('Детали ошибки:', {
      message: err.message,
      code: err.code,
      sqlState: err.sqlState,
      sqlMessage: err.sqlMessage
    });
    throw err;
  } finally {
    if (connection) connection.release();
  }
});

// Получение данных пользователя по ID
ipcMain.handle('get-user-by-id', async (event, userId) => {
  let connection;
  try {
    console.log('Запрос данных пользователя ID:', userId);
    connection = await pool.getConnection();
    
    const [rows] = await connection.query(
      `SELECT id, display_name, email, avatar, avatar_mime, banner, banner_mime, 
              about, created_at
       FROM Users 
       WHERE id = ?`,
      [userId]
    );
    
    if (rows.length === 0) {
      console.log('Пользователь с ID', userId, 'не найден');
      return null;
    }
    
    const user = rows[0];
    console.log('Найден пользователь:', {
      id: user.id,
      display_name: user.display_name,
      has_avatar: !!user.avatar,
      has_banner: !!user.banner,
      avatar_size: user.avatar ? user.avatar.length : 0,
      banner_size: user.banner ? user.banner.length : 0
    });
    
    // Buffer -> Uint8Array (по IPC уедет нормально)
    const avatarBytes = user.avatar ? new Uint8Array(user.avatar) : null;
    const bannerBytes = user.banner ? new Uint8Array(user.banner) : null;
    
    const result = {
      id: user.id,
      displayName: user.display_name,
      email: user.email,
      avatarBytes,
      avatarMime: user.avatar_mime || null,
      bannerBytes,
      bannerMime: user.banner_mime || null,
      about: user.about || '',
      registrationDate: user.created_at
    };
    
    console.log('Возвращаем данные пользователя:', {
      id: result.id,
      displayName: result.displayName,
      hasAvatarBytes: !!result.avatarBytes,
      hasBannerBytes: !!result.bannerBytes,
      avatarBytesSize: result.avatarBytes ? result.avatarBytes.length : 0,
      bannerBytesSize: result.bannerBytes ? result.bannerBytes.length : 0
    });
    
    return result;
  } catch (err) {
    console.error('Ошибка получения данных пользователя:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
});

// Получение релизов пользователя (оцененных им)
ipcMain.handle('get-user-rated-releases', async (event, userId) => {
  let connection;
  try {
    console.log('Запрос оцененных релизов пользователя:', userId);
    connection = await pool.getConnection();
    
    // Сначала проверяем, является ли пользователь администратором (is_admin = 2)
    const [userRows] = await connection.query(
      'SELECT is_admin FROM Users WHERE id = ?',
      [userId]
    );
    
    if (userRows.length === 0) {
      throw new Error('Пользователь не найден');
    }
    
    const isAdmin = userRows[0].is_admin === 2;
    console.log(`Пользователь ${userId} is_admin: ${userRows[0].is_admin}, isAdmin: ${isAdmin}`);
    
    let query, params;
    
    if (isAdmin) {
      // Для администратора (is_admin = 2) показываем все релизы с оценками автора
      query = `
        SELECT r.id, r.title, r.type, r.host_rating, r.average_user_rating, r.add_date, r.image,
                GROUP_CONCAT(a.name SEPARATOR ', ') AS artist_names,
                r.host_rating as user_score, r.add_date as rating_date
         FROM Releases r
         JOIN ReleaseArtists ra ON r.id = ra.release_id
         JOIN Artists a ON ra.artist_id = a.id
         WHERE r.host_rating IS NOT NULL AND r.host_rating > 0
         GROUP BY r.id
         ORDER BY r.add_date DESC
      `;
      params = [];
    } else {
      // Для обычных пользователей показываем только их оценки
      query = `
        SELECT r.id, r.title, r.type, r.host_rating, r.average_user_rating, r.add_date, r.image,
                GROUP_CONCAT(a.name SEPARATOR ', ') AS artist_names,
                urr.score as user_score, urr.updated_at as rating_date
         FROM UserReleaseRatings urr
         JOIN Releases r ON r.id = urr.release_id
         JOIN ReleaseArtists ra ON r.id = ra.release_id
         JOIN Artists a ON ra.artist_id = a.id
         WHERE urr.user_id = ?
         GROUP BY r.id
         ORDER BY urr.updated_at DESC
      `;
      params = [userId];
    }
    
    const [rows] = await connection.query(query, params);
    
    return rows.map(row => ({
      id: row.id,
      title: row.title,
      type: row.type,
      host_rating: row.host_rating,
      average_user_rating: row.average_user_rating,
      add_date: row.add_date,
      image: row.image,
      artist_names: row.artist_names,
      user_score: row.user_score,
      rating_date: row.rating_date,
      is_admin_rating: isAdmin // Добавляем флаг, что это оценка администратора
    }));
  } catch (err) {
    console.error('Ошибка получения оцененных релизов пользователя:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
});

// Получение избранных релизов пользователя
ipcMain.handle('get-user-favorites', async (event, userId) => {
  let connection;
  try {
    console.log('Запрос избранных релизов пользователя:', userId);
    connection = await pool.getConnection();
    
    const [rows] = await connection.query(
      `SELECT r.id, r.title, r.type, r.host_rating, r.average_user_rating, r.add_date, r.image,
              GROUP_CONCAT(a.name SEPARATOR ', ') AS artist_names,
              uf.added_date, uf.is_pinned
       FROM UserFavorites uf
       JOIN Releases r ON r.id = uf.release_id
       JOIN ReleaseArtists ra ON r.id = ra.release_id
       JOIN Artists a ON ra.artist_id = a.id
       WHERE uf.user_id = ?
       GROUP BY r.id
       ORDER BY uf.is_pinned DESC, uf.added_date DESC`,
      [userId]
    );
    
    return rows.map(row => ({
      id: row.id,
      title: row.title,
      type: row.type,
      host_rating: row.host_rating,
      average_user_rating: row.average_user_rating,
      add_date: row.add_date,
      image: row.image,
      artist_names: row.artist_names,
      added_date: row.added_date,
      is_pinned: row.is_pinned
    }));
  } catch (err) {
    console.error('Ошибка получения избранных релизов пользователя:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
});

// Получение избранных артистов пользователя
ipcMain.handle('get-user-artist-favorites', async (event, userId) => {
  let connection;
  try {
    console.log('Запрос избранных артистов пользователя:', userId);
    connection = await pool.getConnection();
    
    const [rows] = await connection.query(
      `SELECT a.id, a.name, uaf.added_date, uaf.is_pinned, uaf.avatar_cache
       FROM UserArtistFavorites uaf
       JOIN Artists a ON a.id = uaf.artist_id
       WHERE uaf.user_id = ?
       ORDER BY uaf.is_pinned DESC, uaf.added_date DESC`,
      [userId]
    );
    
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      added_date: row.added_date,
      is_pinned: row.is_pinned,
      avatar_cache: row.avatar_cache
    }));
  } catch (err) {
    console.error('Ошибка получения избранных артистов пользователя:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
});

// Добавляем в существующие ipcMain.handle
ipcMain.handle('get-average-color', async (_, imageBuffer) => {
  try {
    // Убедитесь, что imageBuffer - это Buffer или Uint8Array
    if (!imageBuffer || !imageBuffer.data || !(imageBuffer.data instanceof Uint8Array)) {
      throw new Error('Invalid image buffer');
    }
    
    // Преобразуем Buffer/Uint8Array в ArrayBuffer
    const buffer = imageBuffer.data instanceof Buffer ? 
      imageBuffer.data.buffer : 
      imageBuffer.data;
    
    const color = await getAverageColor(buffer);
    console.log('Calculated average color:', color.hex); // Добавляем лог
    return { success: true, color: color.hex };
  } catch (e) {
    console.error('Error calculating average color:', e);
    return { success: false, color: '#7830B7' };
  }
});

// Создание релиза
ipcMain.handle('createRelease', async (event, { title, type, date, image, artistIds }) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Начинаем транзакцию
    await connection.beginTransaction();
    
    // Создаем релиз
    const [result] = await connection.query(
      `INSERT INTO Releases 
       (title, type, add_date, image) 
       VALUES (?, ?, ?, ?)`,
      [title, type, date, image ? Buffer.from(image) : null]
    );
    
    const releaseId = result.insertId;
    
    // Добавляем связи с артистами
    for (const artistId of artistIds) {
      await connection.query(
        'INSERT INTO ReleaseArtists (release_id, artist_id) VALUES (?, ?)',
        [releaseId, artistId]
      );
    }
    
    // Фиксируем транзакцию
    await connection.commit();
    
    // Очищаем кэш релизов
    clearReleasesCache();
    
    return releaseId;
  } catch (err) {
    // Откатываем транзакцию в случае ошибки
    if (connection) await connection.rollback();
    console.error('Error creating release:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
});

ipcMain.handle('check-user-exists', async (event, { email, displayName }) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Проверяем email
    const [emailRows] = await connection.query(
      'SELECT 1 FROM Users WHERE email = ?', 
      [email]
    );
    
    // Проверяем displayName
    const [nameRows] = await connection.query(
      'SELECT 1 FROM Users WHERE display_name = ?', 
      [displayName]
    );
    
    return { 
      emailExists: emailRows.length > 0,
      displayNameExists: nameRows.length > 0
    };
  } catch (error) {
    console.error('Error checking user existence:', error);
    throw error;
  } finally {
    if (connection) connection.release();
  }
});

ipcMain.handle('logout-user', async () => {
  try {
    const token = loadSession();
    if (token) {
      const connection = await pool.getConnection();
      await connection.query(
        'UPDATE Users SET auth_token = NULL WHERE auth_token = ?',
        [token]
      );
      connection.release();
    }
    clearSession();
    return { success: true };
  } catch (err) {
    console.error('Logout error:', err);
    throw err;
  }
});

// В обработчике get-release-details (main.js)
ipcMain.handle('get-release-details', async (event, releaseId) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const [rows] = await connection.query(`
      SELECT 
        r.id,
        r.title,
        r.type,
        r.host_rating,
        r.average_user_rating,
        r.add_date,
        r.image,
        r.textValue,
        r.structureValue,
        r.soundValue,
        r.voiceValue,
        r.individualityValue,
        r.atmosphereValue,
        DATE(r.add_date) as release_date,
        GROUP_CONCAT(a.name SEPARATOR ', ') AS artist_names,
        GROUP_CONCAT(a.id SEPARATOR ', ') AS artist_ids
      FROM Releases r
      JOIN ReleaseArtists ra ON r.id = ra.release_id
      JOIN Artists a ON ra.artist_id = a.id
      WHERE r.id = ?
      GROUP BY r.id
    `, [releaseId]);

    if (rows.length === 0) return null;

    const row = rows[0];
    console.log('Release details data:', { 
      id: row.id, 
      title: row.title, 
      host_rating: row.host_rating, 
      average_user_rating: row.average_user_rating 
    });

    return {
      id: row.id,
      title: row.title,
      type: row.type,
      host_rating: row.host_rating,
      average_user_rating: row.average_user_rating,
      add_date: row.add_date,
      release_date: row.release_date,
      textValue: row.textValue,
      structureValue: row.structureValue,
      soundValue: row.soundValue,
      voiceValue: row.voiceValue,
      individualityValue: row.individualityValue,
      atmosphereValue: row.atmosphereValue,
      image: row.image ? row.image : null,
      artist_names: row.artist_names,
      artist_ids: row.artist_ids.split(',').map(id => id.trim())  // Убираем лишние пробелы
    };

  } catch (err) {
    console.error('Error fetching release details:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
});



// const puppeteer = require('puppeteer');

// ipcMain.handle('fetch-lyrics', async (event, { artist, title }) => {
//   let browser;
//   try {
//     const query = `${artist} ${title}`;
//     const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(query)}`;

//     const { data } = await axios.get(searchUrl, {
//       headers: {
//         Authorization: `Bearer 9oDUQ5Y20njJ_sq2LPjtwJAoaQ5f2nAKxAe0iVH0CRiYbGU02uywCvsXXOHSOTje`
//       }
//     });

//     const hits = data.response.hits;
//     if (!hits || hits.length === 0) throw new Error('Song not found');

//     const normalize = str => str.toLowerCase()
//       .replace(/[\W_]+/g, '')
//       .replace(/ё/g, 'е');

//     const normalizedArtist = normalize(artist);
//     const normalizedTitle = normalize(title);

//     const match = hits.find(hit => {
//       const hitArtist = normalize(hit.result.primary_artist.name);
//       const hitTitle = normalize(hit.result.title);
//       return hitArtist.includes(normalizedArtist) && hitTitle.includes(normalizedTitle);
//     }) || hits[0];

//     const songUrl = `https://genius.com${match.result.path}`;

//     browser = await puppeteer.launch({
//       headless: true,
//       args: ['--no-sandbox', '--disable-setuid-sandbox']
//     });
//     const page = await browser.newPage();
    
//     await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
//     await page.setViewport({ width: 1200, height: 800 });
//     await page.goto(songUrl, { 
//       waitUntil: 'domcontentloaded',
//       timeout: 30000
//     });

//     // 🔽 Отдельная функция для извлечения текста
//     const lyrics = await extractLyricsFromPage(page);

//     if (!lyrics || lyrics.length < 50) {
//       throw new Error('Не удалось извлечь текст песни. Возможно, структура страницы изменилась.');
//     }

//     console.log('Successfully extracted lyrics');
//     return { success: true, lyrics };
//   } catch (err) {
//     console.error('Lyrics fetch error:', err.message);
//     return { 
//       success: false, 
//       error: err.message || 'Ошибка при получении текста песни',
//       details: err.stack
//     };
//   } finally {
//     if (browser) await browser.close();
//   }
// });


// // 🔽 Вынесенная функция извлечения текста песни
// async function extractLyricsFromPage(page) {
//   // Эмулируем прокрутку страницы до конца несколько раз
//   await autoScroll(page);

//   return await page.evaluate(() => {
//     // Находим все контейнеры с текстом (новый селектор для Genius 2024)
//     const lyricsContainers = Array.from(document.querySelectorAll(
//       'div[data-lyrics-container="true"], div[class*="Lyrics__Container"]'
//     ));

//     if (lyricsContainers.length > 0) {
//       // Собираем текст из всех контейнеров
//       let fullLyrics = [];
      
//       lyricsContainers.forEach(container => {
//         const clone = container.cloneNode(true);
        
//         // Удаляем ненужные элементы
//         clone.querySelectorAll(
//           'a, button, svg, img, iframe, script, style, noscript, .EmbeddedPlayer__Container, .Label'
//         ).forEach(el => el.remove());
        
//         // Обрабатываем переносы строк
//         clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        
//         // Добавляем текст в общий массив
//         fullLyrics.push(clone.innerText.trim());
//       });

//       // Объединяем и очищаем текст
//       return fullLyrics.join('\n\n')
//         .replace(/\r\n/g, '\n')
//         .replace(/\n{3,}/g, '\n\n')
//         .trim();
//     }

//     // Альтернативный метод для старых версий Genius
//     const oldLyricsContainer = document.querySelector('.lyrics');
//     if (oldLyricsContainer) {
//       return oldLyricsContainer.innerText
//         .trim()
//         .replace(/\r\n/g, '\n')
//         .replace(/\n{3,}/g, '\n\n');
//     }

//     return "Не удалось извлечь текст песни";
//   });
// }

// Функция для плавной прокрутки страницы
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 500;
      const scrollInterval = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(scrollInterval);
          
          // Дополнительное ожидание после прокрутки
          setTimeout(resolve, 2000);
        }
      }, 200);
    });
  });
}

// Кэш для изображений артистов
const artistImageCache = new Map();
// Pending login sessions awaiting 2FA verification
const pendingLogins = new Map(); // pendingId -> { userId, email, createdAt }
// Pending 2FA setup secrets per current session token
const twofaSetupPending = new Map(); // token -> { secretBase32, createdAt }
// 2FA attempt tracking per pendingId
const twofaAttempts = new Map(); // pendingId -> { attempts: number, lastAttempt: timestamp, blockedUntil: timestamp }

// ===== TOTP (Google Authenticator) helpers =====
function base32ToBuffer(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  let buffer = [];
  const clean = (base32 || '').replace(/=+$/, '').toUpperCase().replace(/\s+/g, '');
  for (let i = 0; i < clean.length; i++) {
    const val = alphabet.indexOf(clean[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  for (let j = 0; j + 8 <= bits.length; j += 8) {
    buffer.push(parseInt(bits.substring(j, j + 8), 2));
  }
  return Buffer.from(buffer);
}

function generateRandomSecretBase32(length = 32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

function hotp(secretBuffer, counter, digits = 6) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secretBuffer).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  const otp = (code % 10 ** digits).toString().padStart(digits, '0');
  return otp;
}

function verifyTotp(secretBase32, code, timeStep = 30, digits = 6, skew = 1) {
  try {
    const secretBuffer = base32ToBuffer(secretBase32);
    const counter = Math.floor(Date.now() / 1000 / timeStep);
    const normalized = String(code || '').replace(/\s+/g, '');
    for (let i = -skew; i <= skew; i++) {
      const candidate = hotp(secretBuffer, counter + i, digits);
      if (candidate === normalized) return true;
    }
  } catch (e) {
    return false;
  }
  return false;
}

async function recordLoginHistory(connection, userId) {
  try {
    const platform = os.platform();
    const release = os.release();
    const arch = os.arch();
    const osInfo = `${platform} ${release} (${arch})`;
    let ipAddress = null;
    try {
      const { data } = await axios.get('https://api.ipify.org?format=json', { timeout: 5000 });
      ipAddress = data && data.ip ? data.ip : null;
    } catch (e) {
      ipAddress = null;
    }
    await connection.query(
      'INSERT INTO UserLoginHistory (user_id, ip_address, os_info) VALUES (?, ?, ?)',
      [userId, ipAddress, osInfo]
    );
  } catch (e) {
    console.warn('Failed to record login history:', e.message);
  }
}

// ====== ARTIST FAVORITES SYSTEM ======

// Добавить артиста в избранное
ipcMain.handle('add-artist-to-favorites', async (event, { userId, artistId }) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Проверяем, не добавлен ли уже артист в избранное
    const [existing] = await connection.query(
      'SELECT id FROM UserArtistFavorites WHERE user_id = ? AND artist_id = ?',
      [userId, artistId]
    );
    
    if (existing.length > 0) {
      return { success: false, message: 'Артист уже в избранном' };
    }
    
    // Добавляем в избранное
    await connection.query(
      'INSERT INTO UserArtistFavorites (user_id, artist_id) VALUES (?, ?)',
      [userId, artistId]
    );
    
    return { success: true, message: 'Артист добавлен в избранное' };
  } catch (err) {
    console.error('Ошибка добавления артиста в избранное:', err);
    throw new Error('Не удалось добавить артиста в избранное');
  } finally {
    if (connection) connection.release();
  }
});

// Удалить артиста из избранного
ipcMain.handle('remove-artist-from-favorites', async (event, { userId, artistId }) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [result] = await connection.query(
      'DELETE FROM UserArtistFavorites WHERE user_id = ? AND artist_id = ?',
      [userId, artistId]
    );
    
    if (result.affectedRows === 0) {
      return { success: false, message: 'Артист не найден в избранном' };
    }
    
    return { success: true, message: 'Артист удален из избранного' };
  } catch (err) {
    console.error('Ошибка удаления артиста из избранного:', err);
    throw new Error('Не удалось удалить артиста из избранного');
  } finally {
    if (connection) connection.release();
  }
});

// Проверить, в избранном ли артист
ipcMain.handle('is-artist-favorite', async (event, { userId, artistId }) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [rows] = await connection.query(
      'SELECT id FROM UserArtistFavorites WHERE user_id = ? AND artist_id = ?',
      [userId, artistId]
    );
    
    return { isFavorite: rows.length > 0 };
  } catch (err) {
    console.error('Ошибка проверки избранного артиста:', err);
    throw new Error('Не удалось проверить статус избранного артиста');
  } finally {
    if (connection) connection.release();
  }
});

// Переключить статус закрепления избранного артиста (pin/unpin)
ipcMain.handle('toggle-artist-favorite-pin', async (event, { userId, artistId }) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Проверяем, есть ли артист в избранном
    const [existing] = await connection.query(
      'SELECT id, is_pinned FROM UserArtistFavorites WHERE user_id = ? AND artist_id = ?',
      [userId, artistId]
    );
    
    if (existing.length === 0) {
      return { success: false, message: 'Артист не найден в избранном' };
    }
    
    const currentPinStatus = existing[0].is_pinned;
    const newPinStatus = currentPinStatus ? 0 : 1;
    
    // Проверяем лимит закрепленных (максимум 5)
    if (newPinStatus === 1) {
      const [pinnedCount] = await connection.query(
        'SELECT COUNT(*) as count FROM UserArtistFavorites WHERE user_id = ? AND is_pinned = 1',
        [userId]
      );
      
      if (pinnedCount[0].count >= 5) {
        return { success: false, message: 'Можно закрепить максимум 5 артистов.' };
      }
    }
    
    // Обновляем статус закрепления
    await connection.query(
      'UPDATE UserArtistFavorites SET is_pinned = ? WHERE user_id = ? AND artist_id = ?',
      [newPinStatus, userId, artistId]
    );
    
    return { 
      success: true, 
      message: newPinStatus ? 'Артист закреплен' : 'Артист откреплен', 
      isPinned: newPinStatus === 1 
    };
  } catch (err) {
    console.error('Ошибка переключения закрепления артиста:', err);
    throw new Error('Не удалось изменить статус закрепления артиста');
  } finally {
    if (connection) connection.release();
  }
});


// Сохранить аватар артиста в кэш
ipcMain.handle('cache-artist-avatar', async (event, { userId, artistId, avatarData }) => {
  let connection;
  try {
    console.log('Caching avatar for user:', userId, 'artist:', artistId, 'data size:', avatarData?.length);
    
    // Валидация входных данных
    if (!userId || !artistId || !avatarData) {
      throw new Error('Missing required parameters: userId, artistId, or avatarData');
    }
    
    connection = await pool.getConnection();
    
    // Проверим структуру таблицы для отладки
    try {
      const [tableInfo] = await connection.query('SHOW COLUMNS FROM UserArtistFavorites');
      console.log('Table structure:', tableInfo);
    } catch (descError) {
      console.log('Could not describe table:', descError.message);
    }
    
    // Проверяем, есть ли запись в избранном
    const [existing] = await connection.query(
      'SELECT id FROM UserArtistFavorites WHERE user_id = ? AND artist_id = ?',
      [userId, artistId]
    );
    
    console.log('Existing records found:', existing.length);
    
    if (existing.length > 0) {
      // Обновляем существующую запись
      console.log('Updating existing record');
      const bufferData = Buffer.from(avatarData);
      await connection.query(
        'UPDATE UserArtistFavorites SET avatar_cache = ? WHERE user_id = ? AND artist_id = ?',
        [bufferData, userId, artistId]
      );
    } else {
      // Создаем новую запись в избранном только для кэширования аватара
      console.log('Creating new record');
      console.log('Inserting values:', { userId, artistId, avatarDataSize: avatarData.length });
      
      // Попробуем самый простой INSERT
      const insertQuery = 'INSERT INTO UserArtistFavorites (user_id, artist_id, avatar_cache) VALUES (?, ?, ?)';
      console.log('Insert query:', insertQuery);
      
      // Конвертируем Uint8Array в Buffer для MySQL
      const bufferData = Buffer.from(avatarData);
      console.log('Buffer data size:', bufferData.length);
      
      await connection.query(insertQuery, [userId, artistId, bufferData]);
    }
    
    console.log('Avatar cached successfully');
    return { success: true };
  } catch (err) {
    console.error('Ошибка кэширования аватара артиста:', err);
    console.error('Error details:', {
      message: err.message,
      code: err.code,
      sqlState: err.sqlState,
      sqlMessage: err.sqlMessage
    });
    throw new Error(`Не удалось сохранить аватар артиста: ${err.message}`);
  } finally {
    if (connection) connection.release();
  }
});

// Получить кэшированный аватар артиста
ipcMain.handle('get-cached-artist-avatar', async (event, { userId, artistId }) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [rows] = await connection.query(
      'SELECT avatar_cache FROM UserArtistFavorites WHERE user_id = ? AND artist_id = ?',
      [userId, artistId]
    );
    
    if (rows.length > 0 && rows[0].avatar_cache) {
      return { 
        success: true, 
        avatar: new Uint8Array(rows[0].avatar_cache) 
      };
    }
    
    return { success: false, avatar: null };
  } catch (err) {
    console.error('Ошибка получения кэшированного аватара артиста:', err);
    return { success: false, avatar: null };
  } finally {
    if (connection) connection.release();
  }
});

// ====== FAVORITES SYSTEM ======

// Добавить релиз в избранное
ipcMain.handle('add-to-favorites', async (event, { userId, releaseId }) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Проверяем, не добавлен ли уже релиз в избранное
    const [existing] = await connection.query(
      'SELECT id FROM UserFavorites WHERE user_id = ? AND release_id = ?',
      [userId, releaseId]
    );
    
    if (existing.length > 0) {
      return { success: false, message: 'Релиз уже в избранном' };
    }
    
    // Добавляем в избранное
    await connection.query(
      'INSERT INTO UserFavorites (user_id, release_id) VALUES (?, ?)',
      [userId, releaseId]
    );
    
    return { success: true, message: 'Релиз добавлен в избранное' };
  } catch (err) {
    console.error('Ошибка добавления в избранное:', err);
    throw new Error('Не удалось добавить в избранное');
  } finally {
    if (connection) connection.release();
  }
});

// Удалить релиз из избранного
ipcMain.handle('remove-from-favorites', async (event, { userId, releaseId }) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [result] = await connection.query(
      'DELETE FROM UserFavorites WHERE user_id = ? AND release_id = ?',
      [userId, releaseId]
    );
    
    if (result.affectedRows === 0) {
      return { success: false, message: 'Релиз не найден в избранном' };
    }
    
    return { success: true, message: 'Релиз удален из избранного' };
  } catch (err) {
    console.error('Ошибка удаления из избранного:', err);
    throw new Error('Не удалось удалить из избранного');
  } finally {
    if (connection) connection.release();
  }
});

// Проверить, в избранном ли релиз
ipcMain.handle('is-favorite', async (event, { userId, releaseId }) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [rows] = await connection.query(
      'SELECT id FROM UserFavorites WHERE user_id = ? AND release_id = ?',
      [userId, releaseId]
    );
    
    return { isFavorite: rows.length > 0 };
  } catch (err) {
    console.error('Ошибка проверки избранного:', err);
    throw new Error('Не удалось проверить статус избранного');
  } finally {
    if (connection) connection.release();
  }
});

// Переключить статус закрепления избранного релиза (pin/unpin)
ipcMain.handle('toggle-favorite-pin', async (event, { userId, releaseId }) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Проверяем, есть ли релиз в избранном
    const [existing] = await connection.query(
      'SELECT id, is_pinned FROM UserFavorites WHERE user_id = ? AND release_id = ?',
      [userId, releaseId]
    );
    
    if (existing.length === 0) {
      return { success: false, message: 'Релиз не найден в избранном' };
    }
    
    const currentPinStatus = existing[0].is_pinned;
    const newPinStatus = currentPinStatus ? 0 : 1;
    
    // Проверяем лимит закрепленных (максимум 5)
    if (newPinStatus === 1) {
      const [pinnedCount] = await connection.query(
        'SELECT COUNT(*) as count FROM UserFavorites WHERE user_id = ? AND is_pinned = 1',
        [userId]
      );
      
      if (pinnedCount[0].count >= 5) {
        return { success: false, message: 'Максимум 5 релизов можно закрепить' };
      }
    }
    
    // Обновляем статус закрепления
    await connection.query(
      'UPDATE UserFavorites SET is_pinned = ? WHERE user_id = ? AND release_id = ?',
      [newPinStatus, userId, releaseId]
    );
    
    return { 
      success: true, 
      message: newPinStatus ? 'Релиз закреплен' : 'Релиз откреплен', 
      isPinned: newPinStatus === 1 
    };
  } catch (err) {
    console.error('Ошибка переключения закрепления:', err);
    throw new Error('Не удалось изменить статус закрепления');
  } finally {
    if (connection) connection.release();
  }
});

// Добавить/удалить закрепление релиза (старая функция для совместимости)
ipcMain.handle('toggle-pin-release', async (event, { userId, releaseId }) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Проверяем, закреплен ли уже релиз
    const [existing] = await connection.query(
      'SELECT id FROM UserFavorites WHERE user_id = ? AND release_id = ?',
      [userId, releaseId]
    );
    
    if (existing.length > 0) {
      // Удаляем закрепление
      await connection.query(
        'DELETE FROM UserFavorites WHERE user_id = ? AND release_id = ?',
        [userId, releaseId]
      );
      return { success: true, message: 'Релиз откреплен', isPinned: false };
    } else {
      // Добавляем закрепление
      await connection.query(
        'INSERT INTO UserFavorites (user_id, release_id) VALUES (?, ?)',
        [userId, releaseId]
      );
      return { success: true, message: 'Релиз закреплен', isPinned: true };
    }
  } catch (err) {
    console.error('Ошибка переключения закрепления:', err);
    throw new Error('Не удалось изменить статус закрепления');
  } finally {
    if (connection) connection.release();
  }
});


// Получение информации об артисте
ipcMain.handle('get-artist-details', async (event, artistId) => {
  let connection;
  try {
    connection = await pool.getConnection();

    // Получаем имя по ID из базы
    const [artistRows] = await connection.query(
      'SELECT id, name FROM Artists WHERE id = ?',
      [artistId]
    );

    if (artistRows.length === 0) return null;

    const artist = artistRows[0];

    // Получаем средний рейтинг
    const [ratingRows] = await connection.query(`
      SELECT AVG(r.host_rating) as average_rating 
      FROM Releases r
      JOIN ReleaseArtists ra ON r.id = ra.release_id
      WHERE ra.artist_id = ?
    `, [artistId]);

    let avatarUrl = null;
    let avatarData = null;

    // Проверяем кэш
    if (artistImageCache.has(artist.name)) {
      avatarUrl = artistImageCache.get(artist.name);
    } else {
      // Пытаемся найти изображение через несколько источников
      avatarUrl = await findArtistImage(artist.name);
      
      // Сохраняем в кэш (даже если null)
      artistImageCache.set(artist.name, avatarUrl);
    }

    // Если нашли аватар, скачиваем и конвертируем в байты для кэширования
    if (avatarUrl) {
      try {
        const response = await axios.get(avatarUrl, { 
          responseType: 'arraybuffer',
          timeout: 10000 
        });
        avatarData = new Uint8Array(response.data);
      } catch (downloadError) {
        console.error('Ошибка скачивания аватара:', downloadError);
      }
    }

    return {
      id: artist.id,
      name: artist.name,
      average_rating: ratingRows[0].average_rating ? ratingRows[0].average_rating.toFixed(1) : null,
      avatar: avatarUrl,
      avatarData: avatarData // Добавляем данные аватара для кэширования
    };
  } catch (err) {
    console.error('Ошибка get-artist-details:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
});


// Функция для поиска изображения артиста через несколько источников
async function findArtistImage(artistName) {
  const searchPromises = [];
  
  // 1. Genius API (быстрый)
  searchPromises.push(searchGeniusAPI(artistName));
  
  // 2. Last.fm API (хорошо работает с русскими именами)
  searchPromises.push(searchLastFM(artistName));
  
  // 3. Google Images API (если доступен)
  searchPromises.push(searchGoogleImages(artistName));
  
  // 4. Транслитерация для русских имен
  if (isRussianName(artistName)) {
    const transliterated = transliterateRussian(artistName);
    searchPromises.push(searchGeniusAPI(transliterated));
    searchPromises.push(searchLastFM(transliterated));
  }
  
  try {
    // Ждем первый успешный результат
    const results = await Promise.allSettled(searchPromises);
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        return result.value;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error in findArtistImage:', error);
    return null;
  }
}

// Проверка, является ли имя русским
function isRussianName(name) {
  return /[а-яё]/i.test(name);
}

// Простая транслитерация русских букв
function transliterateRussian(text) {
  const translitMap = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
  };
  
  return text.toLowerCase().split('').map(char => 
    translitMap[char] || char
  ).join('');
}

// Поиск через Genius API
async function searchGeniusAPI(artistName) {
  try {
    const query = encodeURIComponent(artistName);
    const response = await axios.get(`https://api.genius.com/search?q=${query}`, {
      headers: {
        Authorization: `Bearer 9oDUQ5Y20njJ_sq2LPjtwJAoaQ5f2nAKxAe0iVH0CRiYbGU02uywCvsXXOHSOTje`
      },
      timeout: 5000
    });

    const hits = response.data.response.hits;
    const match = hits.find(hit => {
      const name = hit.result.primary_artist.name.toLowerCase();
      return name === artistName.toLowerCase() || 
             name.includes(artistName.toLowerCase()) ||
             artistName.toLowerCase().includes(name);
    });

    if (match && match.result.primary_artist.image_url) {
      return match.result.primary_artist.image_url;
    }

    return null;
  } catch (error) {
    console.error('Genius API error:', error.message);
    return null;
  }
}

// Поиск через Last.fm API
async function searchLastFM(artistName) {
  try {
    const query = encodeURIComponent(artistName);
    const response = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${query}&api_key=YOUR_LASTFM_API_KEY&format=json`, {
      timeout: 5000
    });

    if (response.data.artist && response.data.artist.image) {
      // Берем изображение наибольшего размера
      const images = response.data.artist.image;
      const largeImage = images.find(img => img.size === 'large') || 
                        images.find(img => img.size === 'medium') || 
                        images[images.length - 1];
      
      if (largeImage && largeImage['#text']) {
        return largeImage['#text'];
      }
    }

    return null;
  } catch (error) {
    console.error('Last.fm API error:', error.message);
    return null;
  }
}

// Поиск через Google Images (упрощенная версия)
async function searchGoogleImages(artistName) {
  try {
    // Используем Google Custom Search API
    const query = encodeURIComponent(`${artistName} musician artist`);
    const response = await axios.get(`https://www.googleapis.com/customsearch/v1?key=YOUR_GOOGLE_API_KEY&cx=YOUR_SEARCH_ENGINE_ID&q=${query}&searchType=image&num=1`, {
      timeout: 5000
    });

    if (response.data.items && response.data.items.length > 0) {
      return response.data.items[0].link;
    }

    return null;
  } catch (error) {
    console.error('Google Images API error:', error.message);
    return null;
  }
}

// Старая функция для совместимости
async function fetchArtistByName(artistName) {
  try {
    const query = encodeURIComponent(artistName);
    const response = await axios.get(`https://api.genius.com/search?q=${query}`, {
      headers: {
        Authorization: `Bearer 9oDUQ5Y20njJ_sq2LPjtwJAoaQ5f2nAKxAe0iVH0CRiYbGU02uywCvsXXOHSOTje`
      }
    });

    const hits = response.data.response.hits;
    const match = hits.find(hit => {
      const name = hit.result.primary_artist.name.toLowerCase();
      return name === artistName.toLowerCase();
    });

    if (match) {
      return {
        genius_id: match.result.primary_artist.id,
        name: match.result.primary_artist.name,
        url: match.result.primary_artist.url,
        image_url: match.result.primary_artist.image_url,
        header_image_url: match.result.primary_artist.header_image_url,
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching artist from Genius:', error.message);
    return null;
  }
}

// Получение релизов артиста
ipcMain.handle('get-artist-releases', async (event, artistId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [rows] = await connection.query(
      `SELECT 
        r.id,
        r.title,
        r.type,
        r.host_rating,
        r.average_user_rating,
        r.add_date,
        r.image,
        ra.artist_id,
        GROUP_CONCAT(a.name SEPARATOR ', ') AS artist_names
      FROM Releases r
      JOIN ReleaseArtists ra ON r.id = ra.release_id
      JOIN Artists a ON ra.artist_id = a.id
      WHERE ra.artist_id = ?
      GROUP BY r.id
      ORDER BY r.add_date DESC`,
      [artistId]
    );

    
    return rows.map(row => ({
      id: row.id,
      title: row.title,
      type: row.type,
      host_rating: row.host_rating,
      average_user_rating: row.average_user_rating,
      add_date: row.add_date,
      image: row.image ? row.image : null,  
      artist_name: row.artist_names,
      artist_id: row.artist_id
    }));

  } catch (err) {
    console.error('Error fetching artist releases:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
});

// Обработчик входа
ipcMain.handle('login-user', async (event, { email, password }) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [users] = await connection.query(
      'SELECT * FROM Users WHERE email = ?', 
      [email]
    );
    
    if (users.length === 0) throw new Error('Пользователь не найден');
    
    const user = users[0];
    const inputHash = crypto
      .pbkdf2Sync(password, user.salt, 1000, 64, 'sha512')
      .toString('hex');
    
    if (inputHash !== user.password_hash) {
      throw new Error('Неверный пароль');
    }

    // Если включено 2FA, возвращаем промежуточный статус
    if (user.is_twofa_enabled) {
      const pendingId = crypto.randomBytes(16).toString('hex');
      pendingLogins.set(pendingId, { userId: user.id, email: user.email, createdAt: Date.now() });
      // Инициализируем счетчик попыток
      twofaAttempts.set(pendingId, { attempts: 0, lastAttempt: null, blockedUntil: null });
      return { success: true, requires2fa: true, pendingId };
    }

    // Без 2FA: обычный вход
    const token = crypto.randomBytes(32).toString('hex');
    await connection.query('UPDATE Users SET auth_token = ? WHERE id = ?', [token, user.id]);
    saveSession(token);
    await recordLoginHistory(connection, user.id);

    return { success: true, user: { id: user.id, email: user.email, displayName: user.display_name } };
  } catch (err) {
    console.error('Login error:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
});

// Завершение входа с 2FA
ipcMain.handle('verify-2fa-login', async (event, { pendingId, code }) => {
  let connection;
  try {
    const pending = pendingLogins.get(pendingId);
    if (!pending) {
      return { success: false, error: 'Сессия входа истекла. Попробуйте войти заново' };
    }
    if (Date.now() - pending.createdAt > 5 * 60 * 1000) { // 5 минут
      pendingLogins.delete(pendingId);
      twofaAttempts.delete(pendingId);
      return { success: false, error: 'Время ввода кода истекло. Попробуйте войти заново' };
    }

    // Проверяем блокировку
    const attemptData = twofaAttempts.get(pendingId);
    if (attemptData && attemptData.blockedUntil && Date.now() < attemptData.blockedUntil) {
      const remainingTime = Math.ceil((attemptData.blockedUntil - Date.now()) / 1000 / 60);
      return { success: false, error: `Доступ заблокирован на ${remainingTime} минут` };
    }

    connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT id, display_name, email, twofa_secret FROM Users WHERE id = ?', [pending.userId]);
    if (rows.length === 0) {
      return { success: false, error: 'Пользователь не найден' };
    }
    const user = rows[0];
    const secretBase32 = user.twofa_secret ? Buffer.from(user.twofa_secret).toString('utf8') : null;
    if (!secretBase32) {
      return { success: false, error: 'Ошибка настройки безопасности' };
    }
    const ok = verifyTotp(secretBase32, code);
    
    if (!ok) {
      // Неверный код - увеличиваем счетчик попыток
      const currentAttempts = attemptData ? attemptData.attempts + 1 : 1;
      const remainingAttempts = 3 - currentAttempts;
      
      if (currentAttempts >= 3) {
        // Блокируем на 10 минут
        const blockedUntil = Date.now() + (10 * 60 * 1000);
        twofaAttempts.set(pendingId, { 
          attempts: currentAttempts, 
          lastAttempt: Date.now(), 
          blockedUntil: blockedUntil 
        });
        // Очищаем данные после блокировки
        setTimeout(() => {
          pendingLogins.delete(pendingId);
          twofaAttempts.delete(pendingId);
        }, 10 * 60 * 1000);
        return { success: false, error: 'Превышено количество попыток. Доступ заблокирован на 10 минут', blocked: true };
      } else {
        // Обновляем счетчик попыток
        twofaAttempts.set(pendingId, { 
          attempts: currentAttempts, 
          lastAttempt: Date.now(), 
          blockedUntil: null 
        });
        const attemptWord = remainingAttempts === 1 ? 'попытка' : 'попытки';
        return { success: false, error: `Неверный код 2FA. У вас осталось ${remainingAttempts} ${attemptWord}, после чего вы будете заблокированы на 10 минут.` };
      }
    }

    // Успешная верификация - очищаем данные
    const token = crypto.randomBytes(32).toString('hex');
    await connection.query('UPDATE Users SET auth_token = ? WHERE id = ?', [token, user.id]);
    saveSession(token);
    await recordLoginHistory(connection, user.id);
    pendingLogins.delete(pendingId);
    twofaAttempts.delete(pendingId);

    return { success: true, user: { id: user.id, email: user.email, displayName: user.display_name } };
  } catch (err) {
    console.error('2FA verify login error:', err);
    return { success: false, error: 'Произошла ошибка при проверке кода' };
  } finally {
    if (connection) connection.release();
  }
});

// Получение истории входов текущего пользователя
ipcMain.handle('get-login-history', async () => {
  const token = loadSession();
  if (!token) throw new Error('Не авторизован');
  let connection;
  try {
    connection = await pool.getConnection();
    const [users] = await connection.query('SELECT id FROM Users WHERE auth_token = ?', [token]);
    if (users.length === 0) throw new Error('Пользователь не найден');
    const userId = users[0].id;
    const [rows] = await connection.query(
      'SELECT ip_address, os_info, created_at FROM UserLoginHistory WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [userId]
    );
    return rows;
  } catch (err) {
    console.error('get-login-history error:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
});

// Смена пароля
ipcMain.handle('change-password', async (event, { currentPassword, newPassword }) => {
  const token = loadSession();
  if (!token) throw new Error('Не авторизован');
  let connection;
  try {
    connection = await pool.getConnection();
    const [users] = await connection.query('SELECT id, password_hash, salt FROM Users WHERE auth_token = ?', [token]);
    if (users.length === 0) throw new Error('Пользователь не найден');
    const user = users[0];
    const inputHash = crypto.pbkdf2Sync(currentPassword, user.salt, 1000, 64, 'sha512').toString('hex');
    if (inputHash !== user.password_hash) throw new Error('Текущий пароль неверен');

    const newSalt = crypto.randomBytes(16).toString('hex');
    const newHash = crypto.pbkdf2Sync(newPassword, newSalt, 1000, 64, 'sha512').toString('hex');
    await connection.query('UPDATE Users SET password_hash = ?, salt = ? WHERE id = ?', [newHash, newSalt, user.id]);
    return { success: true };
  } catch (err) {
    console.error('change-password error:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
});

// Смена email (через предварительную верификацию кода на новый email)
ipcMain.handle('change-email', async (event, { newEmail, code }) => {
  const token = loadSession();
  if (!token) throw new Error('Не авторизован');
  let connection;
  try {
    // Проверяем код подтверждения (бросит исключение, если неверен)
    emailService.verifyConfirmationCode(newEmail, code);

    connection = await pool.getConnection();
    // Проверяем, что email не занят
    const [exists] = await connection.query('SELECT id FROM Users WHERE email = ?', [newEmail]);
    if (exists.length > 0) throw new Error('Этот email уже используется');

    await connection.query('UPDATE Users SET email = ? WHERE auth_token = ?', [newEmail, token]);
    return { success: true };
  } catch (err) {
    console.error('change-email error:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
});

// Инициация подключения 2FA: генерируем секрет и otpauth URL
ipcMain.handle('init-2fa-setup', async () => {
  const token = loadSession();
  if (!token) throw new Error('Не авторизован');
  let connection;
  try {
    connection = await pool.getConnection();
    const [users] = await connection.query('SELECT id, email FROM Users WHERE auth_token = ?', [token]);
    if (users.length === 0) throw new Error('Пользователь не найден');
    const user = users[0];
    const secretBase32 = generateRandomSecretBase32(32);
    twofaSetupPending.set(token, { secretBase32, createdAt: Date.now() });
    const issuer = encodeURIComponent('ChillMusic');
    const label = encodeURIComponent(user.email || 'user');
    const otpauth = `otpauth://totp/${issuer}:${label}?secret=${secretBase32}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
    return { success: true, secret: secretBase32, otpauth };
  } catch (err) {
    console.error('init-2fa-setup error:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
});

// Подтверждение и включение 2FA кодом
ipcMain.handle('enable-2fa', async (event, { code }) => {
  const token = loadSession();
  if (!token) throw new Error('Не авторизован');
  let connection;
  try {
    const pending = twofaSetupPending.get(token);
    if (!pending) throw new Error('Настройка безопасности не активна');
    if (Date.now() - pending.createdAt > 10 * 60 * 1000) { // 10 минут
      twofaSetupPending.delete(token);
      throw new Error('Время настройки истекло. Попробуйте заново');
    }
    const ok = verifyTotp(pending.secretBase32, code);
    if (!ok) throw new Error('Неверный код 2FA');

    connection = await pool.getConnection();
    await connection.query('UPDATE Users SET twofa_secret = ?, is_twofa_enabled = 1 WHERE auth_token = ?', [Buffer.from(pending.secretBase32, 'utf8'), token]);
    twofaSetupPending.delete(token);
    return { success: true };
  } catch (err) {
    console.error('enable-2fa error:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
});

// Отключение 2FA после ввода кода
ipcMain.handle('disable-2fa', async (event, { code }) => {
  const token = loadSession();
  if (!token) throw new Error('Не авторизован');
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT twofa_secret FROM Users WHERE auth_token = ?', [token]);
    if (rows.length === 0) throw new Error('Пользователь не найден');
    const secretBase32 = rows[0].twofa_secret ? Buffer.from(rows[0].twofa_secret).toString('utf8') : null;
    if (!secretBase32) throw new Error('Ошибка настройки безопасности');
    const ok = verifyTotp(secretBase32, code);
    if (!ok) throw new Error('Неверный код 2FA');
    await connection.query('UPDATE Users SET twofa_secret = NULL, is_twofa_enabled = 0 WHERE auth_token = ?', [token]);
    return { success: true };
  } catch (err) {
    console.error('disable-2fa error:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
});

// Инициация отвязки 2FA: отправка кода на email
ipcMain.handle('init-disable-2fa', async () => {
  const token = loadSession();
  if (!token) throw new Error('Не авторизован');
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT email FROM Users WHERE auth_token = ?', [token]);
    if (rows.length === 0) throw new Error('Пользователь не найден');
    const email = rows[0].email;
    await emailService.sendConfirmationEmail(email, 'ChillMusic');
    return { success: true };
  } catch (err) {
    console.error('init-disable-2fa error:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
});

// Подтверждение отвязки 2FA: проверка кода с email
ipcMain.handle('confirm-disable-2fa', async (event, { code }) => {
  const token = loadSession();
  if (!token) throw new Error('Не авторизован');
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT id, email FROM Users WHERE auth_token = ?', [token]);
    if (rows.length === 0) throw new Error('Пользователь не найден');
    const user = rows[0];
    // Проверяем email-код
    emailService.verifyConfirmationCode(user.email, code);
    // Отключаем 2FA
    await connection.query('UPDATE Users SET twofa_secret = NULL, is_twofa_enabled = 0 WHERE id = ?', [user.id]);
    return { success: true };
  } catch (err) {
    console.error('confirm-disable-2fa error:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
});


// Инициализация приложения
// ===== TELEGRAM INTEGRATION =====
/*
Для настройки Telegram интеграции:

1. Через переменные окружения (или используйте встроенные настройки):
   - TELEGRAM_GROUP_URL=https://t.me/chillmusicapp
   - TELEGRAM_BOT_TOKEN=7959964084:AAGJe1UcGDpy6LYBoPr6o_3agy6x8yrmpLE
   - TELEGRAM_CHAT_ID=2839297134

2. Через Bot API (рекомендуется):
   - Создайте бота через @BotFather
   - Добавьте бота в группу как администратора
   - Получите chat_id группы
   - Установите переменные окружения

3. Через парсинг публичных групп:
   - Установите TELEGRAM_GROUP_URL на публичную группу
   - Система автоматически попытается парсить посты

Примеры (текущие настройки):
- Публичная группа: https://t.me/chillmusicapp
- Bot API: TELEGRAM_BOT_TOKEN=7959964084:AAGJe1UcGDpy6LYBoPr6o_3agy6x8yrmpLE
- Chat ID: TELEGRAM_CHAT_ID=2839297134
*/

// Функция для парсинга постов из Telegram группы
async function parseTelegramGroup(groupUrl) {
  try {
    // Парсинг публичных Telegram групп через веб-интерфейс
    // Это работает только для публичных групп
    
    if (!groupUrl.includes('t.me/')) {
      console.log('Invalid Telegram group URL:', groupUrl);
      return null;
    }
    
    // Извлекаем имя группы из URL
    const groupName = groupUrl.split('t.me/')[1];
    
    try {
      // Пытаемся получить данные группы через веб-интерфейс
      const response = await axios.get(`https://t.me/s/${groupName}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      // Парсим HTML для извлечения постов
      const $ = cheerio.load(response.data);
      const posts = [];
      
      $('.tgme_widget_message').each((index, element) => {
        const $el = $(element);
        const text = $el.find('.tgme_widget_message_text').text().trim();
        const author = $el.find('.tgme_widget_message_author_name').text().trim() || 'Unknown';
        const date = $el.find('.tgme_widget_message_date').attr('datetime');
        const image = $el.find('.tgme_widget_message_photo img').attr('src');
        
        if (text) {
          posts.push({
            id: Date.now() + index, // Временный ID
            text: text,
            authorName: 'ChillMusic',
            authorAvatar: 'images/icon.png',
            date: date || new Date().toISOString(),
            image: image || null,
            likes: 0
          });
        }
      });
      
      if (posts.length > 0) {
        console.log('Successfully parsed Telegram group posts:', posts.length);
        return posts.slice(0, 10); // Ограничиваем количество постов
      }
    } catch (webError) {
      console.log('Web parsing failed, trying alternative method:', webError.message);
    }
    
    console.log('Telegram group parsing not available for:', groupUrl);
    return null;
  } catch (error) {
    console.error('Error parsing Telegram group:', error);
    return null;
  }
}

// Функция для получения постов через Telegram Bot API
async function getTelegramPostsViaBot(botToken, chatId) {
  try {
    console.log('Attempting to fetch posts via Telegram Bot API...');
    console.log('Bot Token:', botToken.substring(0, 10) + '...');
    console.log('Chat ID:', chatId);
    
    // Получаем обновления от бота
    const response = await axios.get(`https://api.telegram.org/bot${botToken}/getUpdates`, {
      params: {
        limit: 20,
        timeout: 30
      }
    });
    
    if (response.data.ok && response.data.result.length > 0) {
      const posts = response.data.result
        .filter(update => update.message && update.message.text && update.message.chat.id.toString() === chatId.toString())
        .map(update => ({
          id: update.message.message_id,
          text: update.message.text,
          authorName: 'ChillMusic',
          authorAvatar: 'images/icon.png', // Используем иконку приложения
          date: new Date(update.message.date * 1000).toISOString(),
          image: update.message.photo ? `https://api.telegram.org/file/bot${botToken}/${update.message.photo[update.message.photo.length - 1].file_id}` : null,
          likes: 0 // Начальное значение, будет загружено из базы данных
        }));
      
      console.log('Successfully fetched Telegram posts via Bot API:', posts.length);
      return posts;
    }
    
    console.log('No new messages from Telegram Bot API');
    
    // Попробуем получить историю сообщений напрямую
    try {
      console.log('Trying to get chat history directly...');
      const historyResponse = await axios.get(`https://api.telegram.org/bot${botToken}/getChatHistory`, {
        params: {
          chat_id: chatId,
          limit: 10
        }
      });
      
      if (historyResponse.data.ok && historyResponse.data.result.messages) {
        const historyPosts = historyResponse.data.result.messages
          .filter(message => message.text)
          .map(message => ({
            id: message.id,
            text: message.text,
            authorName: 'ChillMusic',
            authorAvatar: 'images/icon.png',
            date: new Date(message.date * 1000).toISOString(),
            image: message.photo ? `https://api.telegram.org/file/bot${botToken}/${message.photo[message.photo.length - 1].file_id}` : null,
            likes: 0
          }));
        
        if (historyPosts.length > 0) {
          console.log('Successfully fetched Telegram chat history:', historyPosts.length);
          return historyPosts;
        }
      }
    } catch (historyError) {
      console.log('Chat history method failed:', historyError.message);
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching posts via Telegram Bot:', error);
    return null;
  }
}

// Получение постов из базы данных
ipcMain.handle('get-posts', async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Получаем все посты с информацией об авторах
    const [posts] = await connection.execute(`
      SELECT 
        p.id,
        p.text,
        p.image_url,
        p.created_at,
        u.display_name as authorName,
        u.avatar as authorAvatar
      FROM posts p
      JOIN Users u ON p.author_id = u.id
      ORDER BY p.created_at DESC
      LIMIT 50
    `);
    
    // Форматируем посты для фронтенда
    const formattedPosts = posts.map(post => ({
      id: post.id,
      text: post.text,
      authorName: post.authorName || 'ChillMusic',
      authorAvatar: post.authorAvatar ? `data:image/png;base64,${post.authorAvatar.toString('base64')}` : 'images/icon.png',
      date: post.created_at.toISOString(),
      image: post.image_url,
      likes: 0 // Будет загружено отдельно
    }));
    
    console.log('Successfully fetched posts from database:', formattedPosts.length);
    return formattedPosts;
  } catch (error) {
    console.error('Error fetching posts from database:', error);
    throw error;
  } finally {
    if (connection) connection.release();
  }
});

// Создание нового поста (только для администраторов)
ipcMain.handle('create-post', async (event, { text, imageUrl }) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Проверяем, является ли пользователь администратором
    const token = loadSession();
    if (!token) throw new Error('Не авторизован');
    
    const [userRows] = await connection.execute(
      'SELECT id, is_admin FROM Users WHERE auth_token = ?',
      [token]
    );
    
    if (userRows.length === 0) throw new Error('Пользователь не найден');
    const user = userRows[0];
    
    if (!user.is_admin) throw new Error('Недостаточно прав для создания постов');
    
    // Создаем пост
    const [result] = await connection.execute(
      'INSERT INTO posts (author_id, text, image_url) VALUES (?, ?, ?)',
      [user.id, text, imageUrl]
    );
    
    console.log('Post created successfully:', result.insertId);
    return { success: true, postId: result.insertId };
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  } finally {
    if (connection) connection.release();
  }
});

// Проверка, является ли пользователь администратором
ipcMain.handle('is-admin', async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const token = loadSession();
    if (!token) {
      console.log('No session token found');
      return false;
    }
    
    const [userRows] = await connection.execute(
      'SELECT is_admin FROM Users WHERE auth_token = ?',
      [token]
    );
    
    if (userRows.length === 0) {
      console.log('No user found with this token');
      return false;
    }
    
    const isAdmin = userRows[0].is_admin === 1;
    console.log('Admin check result:', isAdmin, 'for user with token:', token.substring(0, 10) + '...');
    return isAdmin;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  } finally {
    if (connection) connection.release();
  }
});

// Лайк поста
ipcMain.handle('like-post', async (event, postId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Получаем ID текущего пользователя
    const token = loadSession();
    if (!token) throw new Error('Не авторизован');
    
    const [userRows] = await connection.execute(
      'SELECT id FROM Users WHERE auth_token = ?',
      [token]
    );
    
    if (userRows.length === 0) throw new Error('Пользователь не найден');
    const userId = userRows[0].id;
    
    // Проверяем, есть ли уже лайк
    const [existingLike] = await connection.execute(
      'SELECT id FROM post_likes WHERE user_id = ? AND post_id = ?',
      [userId, postId]
    );
    
    if (existingLike.length === 0) {
      // Добавляем лайк
      await connection.execute(
        'INSERT INTO post_likes (user_id, post_id, created_at) VALUES (?, ?, NOW())',
        [userId, postId]
      );
    }
    
    // Получаем общее количество лайков
    const [likeCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM post_likes WHERE post_id = ?',
      [postId]
    );
    
    console.log('Post liked:', postId, 'Total likes:', likeCount[0].count);
    return { success: true, likes: likeCount[0].count };
  } catch (error) {
    console.error('Error liking post:', error);
    throw error;
  } finally {
    if (connection) connection.release();
  }
});

// Убрать лайк с поста
ipcMain.handle('unlike-post', async (event, postId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Получаем ID текущего пользователя
    const token = loadSession();
    if (!token) throw new Error('Не авторизован');
    
    const [userRows] = await connection.execute(
      'SELECT id FROM Users WHERE auth_token = ?',
      [token]
    );
    
    if (userRows.length === 0) throw new Error('Пользователь не найден');
    const userId = userRows[0].id;
    
    // Удаляем лайк
    await connection.execute(
      'DELETE FROM post_likes WHERE user_id = ? AND post_id = ?',
      [userId, postId]
    );
    
    // Получаем общее количество лайков
    const [likeCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM post_likes WHERE post_id = ?',
      [postId]
    );
    
    console.log('Post unliked:', postId, 'Total likes:', likeCount[0].count);
    return { success: true, likes: likeCount[0].count };
  } catch (error) {
    console.error('Error unliking post:', error);
    throw error;
  } finally {
    if (connection) connection.release();
  }
});

// Получить количество лайков для поста
ipcMain.handle('get-post-likes', async (event, postId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const [likeCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM post_likes WHERE post_id = ?',
      [postId]
    );
    
    return likeCount[0].count;
  } catch (error) {
    console.error('Error getting post likes:', error);
    return 0;
  } finally {
    if (connection) connection.release();
  }
});

// Проверить, лайкнул ли пользователь пост
ipcMain.handle('is-post-liked', async (event, postId) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const token = loadSession();
    if (!token) return false;
    
    const [userRows] = await connection.execute(
      'SELECT id FROM Users WHERE auth_token = ?',
      [token]
    );
    
    if (userRows.length === 0) return false;
    const userId = userRows[0].id;
    
    const [likeRows] = await connection.execute(
      'SELECT id FROM post_likes WHERE user_id = ? AND post_id = ?',
      [userId, postId]
    );
    
    return likeRows.length > 0;
  } catch (error) {
    console.error('Error checking if post is liked:', error);
    return false;
  } finally {
    if (connection) connection.release();
  }
});

// Настройка Telegram интеграции
ipcMain.handle('configure-telegram', async (event, { groupUrl, botToken, chatId }) => {
  try {
    // Сохраняем настройки Telegram (можно в файл или базу данных)
    const telegramConfig = {
      groupUrl: groupUrl || 'https://t.me/your_group',
      botToken: botToken || null,
      chatId: chatId || null,
      lastUpdated: new Date().toISOString()
    };
    
    // Здесь можно сохранить в файл или базу данных
    console.log('Telegram configuration updated:', telegramConfig);
    
    return { success: true, config: telegramConfig };
  } catch (error) {
    console.error('Error configuring Telegram:', error);
    throw error;
  }
});

// Получение текущих настроек Telegram
ipcMain.handle('get-telegram-config', async () => {
  try {
    // Возвращаем текущие настройки
    return {
      groupUrl: process.env.TELEGRAM_GROUP_URL || 'https://t.me/chillmusicapp',
      botToken: process.env.TELEGRAM_BOT_TOKEN || '7959964084:AAGJe1UcGDpy6LYBoPr6o_3agy6x8yrmpLE',
      chatId: process.env.TELEGRAM_CHAT_ID || '2839297134'
    };
  } catch (error) {
    console.error('Error getting Telegram config:', error);
    throw error;
  }
});

// Тестирование подключения к базе данных
ipcMain.handle('test-database-connection', async () => {
  try {
    console.log('=== ТЕСТ ПОДКЛЮЧЕНИЯ К БД (из интерфейса) ===');
    await testDatabase();
    return { success: true, message: 'Подключение к базе данных успешно' };
  } catch (error) {
    console.error('Ошибка тестирования БД:', error);
    return { 
      success: false, 
      message: `Ошибка подключения к БД: ${error.message}`,
      details: {
        code: error.code,
        sqlState: error.sqlState,
        stack: error.stack
      }
    };
  }
});

// Принудительная очистка кэша релизов
ipcMain.handle('clear-releases-cache', async () => {
  try {
    clearReleasesCache();
    return { success: true, message: 'Кэш релизов очищен' };
  } catch (error) {
    console.error('Ошибка очистки кэша:', error);
    return { success: false, message: `Ошибка очистки кэша: ${error.message}` };
  }
});

// Получение статуса кэша
ipcMain.handle('get-cache-status', async () => {
  try {
    return getCacheStatus();
  } catch (error) {
    console.error('Ошибка получения статуса кэша:', error);
    return { error: error.message };
  }
});

app.whenReady().then(async () => {
  try {
    // Принудительно очищаем кэш при запуске
    console.log('=== ЗАПУСК ПРИЛОЖЕНИЯ ===');
    clearReleasesCache();
    console.log('Кэш релизов очищен при запуске');
    
    await testDatabase();
    await initializeTables();
    
    // Тестируем SMTP, но не останавливаем приложение при ошибке
    try {
      await testSMTP();
    } catch (smtpError) {
      console.warn('⚠️ SMTP недоступен, но приложение продолжит работу');
      console.warn('Письма с кодами подтверждения не будут отправляться');
    }
    
    createWindow();
  } catch (err) {
    console.error('=== ОШИБКА ИНИЦИАЛИЗАЦИИ ===');
    console.error('Ошибка инициализации:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  pool.end();
  app.quit();
});