////////////////////                                      ////////////////////
////////////////////                                      ////////////////////
////////////////////      ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ           ////////////////////
////////////////////                                      ////////////////////
////////////////////                                      ////////////////////

let registrationData = null;
let currentEmail = '';

let notificationQueue = [];
let isShowingNotification = false;

let currentRelease = null;

// Debounce utility function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

let selectedReleaseForRating = null;

let currentUser = null;


function showRateReleasePage() {
  // Используем централизованную навигацию
  showPage('rateReleasePage');
  
  initRateReleasePage();
}

function initRateReleasePage() {

  document.getElementById('objectiveRatings').innerHTML = '';
  document.getElementById('subjectiveRatings').innerHTML = '';

  const searchInput = document.getElementById('releaseSearchInput');
  const suggestions = document.getElementById('releaseSuggestions');
  
  // Очищаем предыдущий выбор
  selectedReleaseForRating = null;
  document.querySelector('.selected-release-info').style.display = 'none';
  document.getElementById('submitRatingBtn').disabled = true;
  
  // Настройка поиска релизов с debouncing
  searchInput.addEventListener('input', function() {
    const query = this.value.trim();
    debouncedReleaseSearch(query);
  });
  
  // Закрытие подсказок при клике вне
  document.addEventListener('click', function(e) {
    if (!searchInput.contains(e.target) && !suggestions.contains(e.target)) {
      suggestions.style.display = 'none';
    }
  });
  
  // Инициализация ползунков оценок
  initRatingSliders();
}

function renderReleaseSuggestions(releases) {
  const suggestions = document.getElementById('releaseSuggestions');
  suggestions.innerHTML = '';
  
  if (releases.length === 0) {
    const noResults = document.createElement('div');
    noResults.className = 'suggestion-item';
    noResults.textContent = 'Релизы не найдены';
    suggestions.appendChild(noResults);
    suggestions.style.display = 'block';
    return;
  }
  
  releases.slice(0, 5).forEach(release => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    
    const imageUrl = release.image ? bufferToImage(release.image) : 'images/default-avatar.png';
    
    item.innerHTML = `
      <img src="${imageUrl}" alt="${release.title}">
      <div class="suggestion-info">
        <div class="suggestion-title">${release.title || 'Без названия'}</div>
        <div class="suggestion-artist">${release.artist_names || release.artist_name || 'Исполнитель не указан'}</div>
      </div>
    `;
    
    item.addEventListener('click', () => {
      selectReleaseForRating(release);
      suggestions.style.display = 'none';
    });
    
    suggestions.appendChild(item);
  });
  
  suggestions.style.display = 'block';
}

function selectReleaseForRating(release) {
  selectedReleaseForRating = release;
  const searchInput = document.getElementById('releaseSearchInput');
  const selectedInfo = document.querySelector('.selected-release-info');
  
  searchInput.value = `${release.title} - ${release.artist_names || release.artist_name}`;
  selectedInfo.style.display = 'block';
  
  // Обновляем информацию о релизе
  const coverArt = selectedInfo.querySelector('.release-cover-art');
  const badgeElement = selectedInfo.querySelector('.release-type-badge');
  const titleElement = selectedInfo.querySelector('.release-page-title');
  const artistElement = selectedInfo.querySelector('.release-artist');
  const dateElement = selectedInfo.querySelector('.release-date');
  
  coverArt.src = release.image ? bufferToImage(release.image) : 'images/default-avatar.png';
  coverArt.onerror = () => {
    coverArt.src = 'images/default-avatar.png';
  };
   

  badgeElement.textContent = release.type || 'Тип не указан';
  titleElement.textContent = release.title || 'Без названия';
  
  // Обрабатываем артистов в форме оценки
  if (release.artist_names && release.artist_ids) {
    createArtistLinks(release.artist_names, release.artist_ids, artistElement);
  } else {
    artistElement.textContent = release.artist_name || 'Исполнитель не указан';
  }
  
  dateElement.textContent = release.add_date ? new Date(release.add_date).toLocaleDateString('ru-RU') : 'Дата не указана';
  
  // Активируем кнопку отправки
  document.getElementById('submitRatingBtn').disabled = false;
}

// Инициализация ползунков оценок
function initRatingSliders() {

    document.getElementById('objectiveRatings').innerHTML = '';
    document.getElementById('subjectiveRatings').innerHTML = '';

    const objectiveRatings = [
        { id: 'textValue', label: 'Текст / Содержание' },
        { id: 'structureValue', label: 'Структура / Композиция' },
        { id: 'soundValue', label: 'Звук / Продакшн' },
        { id: 'voiceValue', label: 'Вокал / Исполнение' }
    ];

    const subjectiveRatings = [
        { id: 'individualityValue', label: 'Индивидуальность / Харизма' },
        { id: 'atmosphereValue', label: 'Атмосфера / Вайб' }
    ];

    // Рендер объективных параметров (синий цвет)
    objectiveRatings.forEach(rating => {
        const sliderHTML = `
            <div class="rating-item" data-category="${rating.id}">
                <div class="rating-header">
                    <span class="rating-label">${rating.label}</span>
                    <span class="rating-value">5</span>
                </div>
                <div class="rating-input">
                    <input type="range" 
                           min="1" 
                           max="10" 
                           value="5" 
                           class="rating-slider objective"
                           data-rating="${rating.id}">
                    <div class="rating-bar">
                        <div class="rating-progress objective" style="width: 44.444%"></div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('objectiveRatings').insertAdjacentHTML('beforeend', sliderHTML);
    });

    // Рендер субъективных параметров (фиолетовый цвет)
    subjectiveRatings.forEach(rating => {
        const sliderHTML = `
            <div class="rating-item" data-category="${rating.id}">
                <div class="rating-header">
                    <span class="rating-label">${rating.label}</span>
                    <span class="rating-value">5</span>
                </div>
                <div class="rating-input">
                    <input type="range" 
                           min="1" 
                           max="10" 
                           value="5" 
                           class="rating-slider subjective"
                           data-rating="${rating.id}">
                    <div class="rating-bar">
                        <div class="rating-progress subjective" style="width: 44.444%"></div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('subjectiveRatings').insertAdjacentHTML('beforeend', sliderHTML);
    });

    // Настройка обработчиков событий
    document.querySelectorAll('.rating-slider').forEach(slider => {
        slider.addEventListener('input', function() {
            const value = this.value;
            const min = this.min || 1;
            const max = this.max || 10;
            const container = this.closest('.rating-item');
            const progress = container.querySelector('.rating-progress');
            
            // Расчет позиции (от 0% до 100%)
            const percentage = ((value - min) / (max - min)) * 100;
            progress.style.width = `${percentage}%`;
            
            // Обновление значения
            container.querySelector('.rating-value').textContent = value;
            updateOverallRating();
        });
    });
}

//Рендер ползунков оценок
function renderRatingSliders(containerId, ratings) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  
  ratings.forEach(rating => {
    const slider = document.createElement('div');
    slider.className = 'rating-item';
    
    slider.innerHTML = `
      <label class="rating-label">${rating.label}</label>
      <input type="range" 
             id="${rating.id}Rating" 
             min="${rating.min}" 
             max="${rating.max}" 
             value="${rating.value}" 
             step="1"
             class="rating-range">
      <div class="rating-value-display">
        <span>${rating.min}</span>
        <span class="rating-number">${rating.value}</span>
        <span>${rating.max}</span>
      </div>
    `;
    
    const input = slider.querySelector('input');
    const valueDisplay = slider.querySelector('.rating-number');
    
    input.addEventListener('input', function() {
      valueDisplay.textContent = this.value;
      updateOverallRating();
    });
    
    container.appendChild(slider);
  });
}

function updateOverallRating() {
    const sliders = document.querySelectorAll('.rating-slider');
    const values = Array.from(sliders).map(slider => parseFloat(slider.value));

    if (values.length === 0) return;

    // Среднее арифметическое
    const arithmeticMean = values.reduce((a, b) => a + b, 0) / values.length;

    // Среднее геометрическое
    const product = values.reduce((a, b) => a * b, 1);
    const geometricMean = Math.pow(product, 1 / values.length);

    // Итоговый рейтинг
    const host_rating = 0.5 * (arithmeticMean + geometricMean);

    // Отображение
    const ratingValue = document.querySelector('.overall-rating-cards .rating-value');
    if (ratingValue) {
        ratingValue.textContent = Number.isInteger(host_rating)
            ? host_rating.toString()
            : host_rating.toFixed(1);
    }
}



////////////////////                                      ////////////////////
////////////////////                                      ////////////////////
////////////////////             УВЕДОМЛЕНИЯ              ////////////////////
////////////////////                                      ////////////////////
////////////////////                                      ////////////////////

function showLoginNotification(username) {
    const notification = document.createElement('div');
    notification.className = 'login-notification';
    notification.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 10px;">
            <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.86" stroke="#4ade80" stroke-width="2" stroke-linecap="round"/>
            <path d="M22 4L12 14.01L9 11.01" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Добро пожаловать, ${username}!
    `;
    
    document.body.appendChild(notification);
    
    // Удаляем уведомление после анимации
    setTimeout(() => {
        notification.remove();
    }, 10000);
}

function showNotification(message, type = 'success') {
  // Добавляем уведомление в очередь
  notificationQueue.push({ message, type });
  
  // Если не показываем уведомление сейчас, запускаем показ
  if (!isShowingNotification) {
    showNextNotification();
  }
}

function showNextNotification() {
  if (notificationQueue.length === 0) {
    isShowingNotification = false;
    return;
  }

  isShowingNotification = true;
  const { message, type } = notificationQueue.shift();
  
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Позиционируем уведомление с учетом уже показанных
  positionNotification(notification);
  
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => {
      notification.remove();
      showNextNotification(); // Показываем следующее уведомление
    }, 300);
  }, 3000);
}

function positionNotification(notification) {
  const notifications = document.querySelectorAll('.notification:not(.fade-out)');
  const bottomOffset = 20; // Отступ от нижнего края
  const notificationHeight = 60; // Высота одного уведомления
  const margin = 10; // Отступ между уведомлениями
  
  let topPosition = bottomOffset;
  
  notifications.forEach(existingNotification => {
    topPosition += existingNotification.offsetHeight + margin;
  });
  
  notification.style.bottom = `${topPosition}px`;
}

function showSuccessNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'success-notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
}

function bufferToImage(buffer) {
  try {
    // приводим к Uint8Array, если нужно
    const arr = buffer instanceof Uint8Array
      ? buffer
      : (buffer.data ? new Uint8Array(buffer.data) : new Uint8Array(buffer));
    // конвертация в base64
    let binary = '';
    for (let i = 0; i < arr.length; i++) {
      binary += String.fromCharCode(arr[i]);
    }
    const b64 = window.btoa(binary);
    return `data:image/jpeg;base64,${b64}`;
  } catch (e) {
    console.error('bufferToImage error:', e);
    return 'images/default-avatar.png';
  }
}

// ====== FAVORITES FUNCTIONALITY ======

// Инициализация кнопки избранного
async function initFavoriteButton(releaseId) {
  const favoriteBtn = document.getElementById('favoriteBtn');
  if (!favoriteBtn) return;
  
  console.log('Initializing favorite button for release:', releaseId);
  console.log('Button before reset:', favoriteBtn.classList.contains('active'));
  
  // Сбрасываем состояние кнопки перед проверкой
  favoriteBtn.classList.remove('active');
  //favoriteBtn.title = 'Добавить в избранное';
  favoriteBtn.style.background = '';
  favoriteBtn.style.borderColor = '';
  
  console.log('Button after reset:', favoriteBtn.classList.contains('active'));
  
  // Получаем текущего пользователя
  const currentUser = getCurrentUser();
  if (!currentUser) {
    favoriteBtn.style.display = 'none';
    return;
  }
  
  try {
    // Проверяем, в избранном ли релиз
    const { isFavorite } = await window.electronAPI.isFavorite(currentUser.id, releaseId);
    console.log('Is favorite result:', isFavorite);
    updateFavoriteButton(favoriteBtn, isFavorite);
    
    // Добавляем обработчик клика
    favoriteBtn.onclick = async () => {
      await toggleFavorite(currentUser.id, releaseId, favoriteBtn);
    };
  } catch (err) {
    console.error('Ошибка инициализации кнопки избранного:', err);
    favoriteBtn.style.display = 'none';
  }
}

// Обновление внешнего вида кнопки избранного
function updateFavoriteButton(button, isFavorite) {
  if (isFavorite) {
    button.classList.add('active');
    button.title = 'Удалить из избранного';
  } else {
    button.classList.remove('active');
    button.title = 'Добавить в избранное';
  }
}

// Переключение статуса избранного
async function toggleFavorite(userId, releaseId, button) {
  try {
    const isCurrentlyFavorite = button.classList.contains('active');
    
    let result;
    if (isCurrentlyFavorite) {
      result = await window.electronAPI.removeFromFavorites(userId, releaseId);
    } else {
      result = await window.electronAPI.addToFavorites(userId, releaseId);
    }
    
    if (result.success) {
      updateFavoriteButton(button, !isCurrentlyFavorite);
      showNotification(result.message, 'success');
    } else {
      showNotification(result.message, 'error');
    }
  } catch (err) {
    console.error('Ошибка переключения избранного:', err);
    showNotification('Произошла ошибка при изменении избранного', 'error');
  }
}

// Загрузка и отображение избранных релизов для полной страницы
async function loadUserFavorites() {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  
  try {
    const favorites = await window.electronAPI.getUserFavorites(currentUser.id);
    renderFavorites(favorites);
  } catch (err) {
    console.error('Ошибка загрузки избранного:', err);
    showNotification('Не удалось загрузить избранное', 'error');
  }
}

// Загрузка избранных релизов для профиля (показываем закрепленные + до 5 обычных)
async function loadProfileFavorites() {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  
  try {
    const favorites = await window.electronAPI.getUserFavorites(currentUser.id);
    
    // Разделяем на закрепленные и обычные
    const pinnedFavorites = favorites.filter(fav => fav.is_pinned);
    const regularFavorites = favorites.filter(fav => !fav.is_pinned);
    
    // Показываем все закрепленные + до 5 обычных (максимум 6 всего)
    const maxRegular = Math.max(0, 6 - pinnedFavorites.length);
    const displayFavorites = [...pinnedFavorites, ...regularFavorites.slice(0, maxRegular)];
    
    renderProfileFavorites(displayFavorites);
    
    // Добавляем обработчик для кнопки "Показать все"
    const viewAllBtn = document.getElementById('viewAllFavoritesBtn');
    if (viewAllBtn) {
      viewAllBtn.onclick = () => {
        showAllFavorites();
      };
    }
  } catch (err) {
    console.error('Ошибка загрузки избранного для профиля:', err);
  }
}

// Отображение избранных релизов в профиле (компактный вид)
function renderProfileFavorites(favorites) {
  const grid = document.getElementById('favoritesGrid');
  const empty = document.getElementById('favoritesEmpty');
  
  if (!grid || !empty) return;
  
  if (!favorites || favorites.length === 0) {
    grid.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  
  grid.style.display = 'grid';
  empty.style.display = 'none';
  grid.innerHTML = '';
  
  favorites.forEach(release => {
    const card = document.createElement('div');
    card.className = 'release-card';
    
    const imageUrl = release.image ? bufferToImage(release.image) : null;
    
    card.innerHTML = `
      <div class="release-image-container">
        ${imageUrl ? 
          `<img src="${imageUrl}" class="release-image" alt="${release.title || 'Release image'}">` : 
          `<div class="release-image"></div>`
        }
        <div class="release-rating">${renderRating(release.host_rating)}</div>
        <button class="pin-btn ${release.is_pinned ? 'pinned' : ''}" title="${release.is_pinned ? 'Открепить' : 'Закрепить'}" data-release-id="${release.id}">
          <img src="images/heart-color.png" alt="${release.is_pinned ? 'Открепить' : 'Закрепить'}" class="pin-icon">
        </button>
      </div>
      <div class="release-info">
        <h3 class="release-title" title="${release.title || 'Без названия'}">
          ${release.title || 'Без названия'}
        </h3>
        <div class="release-artists" title="${release.artist_names || release.artist_name || 'Исполнитель не указан'}"></div>
      </div>
    `;
    
    // Создаем кликабельные ссылки артистов
    const artistContainer = card.querySelector('.release-artists');
    if (release.artist_names && release.artist_ids) {
      createArtistLinks(release.artist_names, release.artist_ids, artistContainer);
    } else {
      artistContainer.textContent = release.artist_name || 'Исполнитель не указан';
    }
    
    // Обработчик клика по карточке релиза
    card.addEventListener('click', (e) => {
      // Не открываем релиз, если кликнули по артисту или кнопке открепления
      if (!e.target.closest('.artist-link') && !e.target.closest('.pin-btn')) {
        handleReleaseClick(release.id);
      }
    });
    
    // Обработчик кнопки закрепления/открепления
    const pinBtn = card.querySelector('.pin-btn');
    pinBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleFavoritePinFromProfile(release.id, card, pinBtn);
    });
    
    grid.appendChild(card);
  });
}

// Переключение закрепления избранного релиза из профиля
async function toggleFavoritePinFromProfile(releaseId, cardElement, pinButton) {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  
  try {
    const result = await window.electronAPI.toggleFavoritePin(currentUser.id, releaseId);
    
    if (result.success) {
      showNotification(result.message, 'success');
      
      // Обновляем внешний вид кнопки
      if (result.isPinned) {
        pinButton.classList.add('pinned');
        pinButton.title = 'Открепить';
        pinButton.querySelector('.pin-icon').alt = 'Открепить';
      } else {
        pinButton.classList.remove('pinned');
        pinButton.title = 'Закрепить';
        pinButton.querySelector('.pin-icon').alt = 'Закрепить';
      }
      
      // Перезагружаем профиль, чтобы обновить порядок (закрепленные сверху)
      loadProfileFavorites();
    } else {
      showNotification(result.message, 'error');
    }
  } catch (err) {
    console.error('Ошибка переключения закрепления:', err);
    showNotification('Произошла ошибка при изменении закрепления', 'error');
  }
}

// Переключение закрепления релиза из профиля (старая функция для совместимости)
async function togglePinFromProfile(releaseId, cardElement) {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  
  try {
    const result = await window.electronAPI.togglePinRelease(currentUser.id, releaseId);
    
    if (result.success) {
      showNotification(result.message, 'success');
      
      // Удаляем карточку из профиля, если релиз откреплен
      if (!result.isPinned) {
        cardElement.remove();
        
        // Проверяем, остались ли еще закрепленные релизы
        const remainingCards = document.querySelectorAll('#favoritesGrid .release-card');
        if (remainingCards.length === 0) {
          document.getElementById('favoritesGrid').style.display = 'none';
          document.getElementById('favoritesEmpty').style.display = 'block';
        }
      }
    } else {
      showNotification(result.message, 'error');
    }
  } catch (err) {
    console.error('Ошибка переключения закрепления:', err);
    showNotification('Произошла ошибка при изменении закрепления', 'error');
  }
}

// Переключение закрепления избранного релиза с полной страницы
async function toggleFavoritePinFromFullPage(releaseId, pinButton) {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  
  try {
    const result = await window.electronAPI.toggleFavoritePin(currentUser.id, releaseId);
    
    if (result.success) {
      showNotification(result.message, 'success');
      
      // Обновляем внешний вид кнопки
      if (result.isPinned) {
        pinButton.classList.add('pinned');
        pinButton.title = 'Открепить';
        pinButton.querySelector('.pin-icon').alt = 'Открепить';
      } else {
        pinButton.classList.remove('pinned');
        pinButton.title = 'Закрепить';
        pinButton.querySelector('.pin-icon').alt = 'Закрепить';
      }
      
      // Перезагружаем список, чтобы обновить порядок (закрепленные сверху)
      loadUserFavorites();
    } else {
      showNotification(result.message, 'error');
    }
  } catch (err) {
    console.error('Ошибка переключения закрепления:', err);
    showNotification('Произошла ошибка при изменении закрепления', 'error');
  }
}

// Показать полную страницу избранного
function showAllFavorites() {
  // Скрываем все страницы
  document.getElementById('mainPageContent').style.display = 'none';
  document.getElementById('allReleasesPage').style.display = 'none';
  document.getElementById('searchContainer').style.display = 'none';
  document.getElementById('favoritesContainer').style.display = 'block';
  document.getElementById('releasePage').style.display = 'none';
  document.getElementById('artistPage').style.display = 'none';
  document.getElementById('rateReleasePage').style.display = 'none';
  document.getElementById('profile-page').style.display = 'none';
  
  // Снимаем активные классы с кнопок
  document.querySelectorAll('.icon-btn[data-page]').forEach(b => b.classList.remove('active'));
  
  // Загружаем все избранные релизы
  loadUserFavorites();
}

// Отображение избранных релизов
function renderFavorites(favorites) {
  const container = document.getElementById('favoritesList');
  if (!container) return;
  
  if (!favorites || favorites.length === 0) {
    container.innerHTML = '<p style="color: #bbb; text-align: center;">У вас пока нет избранных релизов</p>';
    return;
  }
  
  container.innerHTML = '';
  favorites.forEach(release => {
    const card = document.createElement('div');
    card.className = 'release-card';
    
    const imageUrl = release.image ? bufferToImage(release.image) : null;
    
    card.innerHTML = `
      <div class="release-image-container">
        ${imageUrl ? 
          `<img src="${imageUrl}" class="release-image" alt="${release.title || 'Release image'}">` : 
          `<div class="release-image"></div>`
        }
        <button class="pin-btn ${release.is_pinned ? 'pinned' : ''}" title="${release.is_pinned ? 'Открепить' : 'Закрепить'}" data-release-id="${release.id}">
          <img src="images/heart-color.png" alt="${release.is_pinned ? 'Открепить' : 'Закрепить'}" class="pin-icon">
        </button>
      </div>
      <div class="release-info">
        <div class="text-container">
          <h3 class="release-title" title="${release.title || 'Без названия'}">
            ${release.title || 'Без названия'}
          </h3>
          <div class="release-artists" title="${release.artist_names || release.artist_name || 'Исполнитель не указан'}"></div>
          <div class="release-meta">
            <span class="release-type">${release.type || 'N/A'}</span>
          </div>
        </div>
        <div class="ratings-container">
          <div class="release-meta_two">
            <div class="release-rating">${renderRating(release.host_rating)}</div>
          </div>
        </div>
      </div>
    `;
    
    // Создаем кликабельные ссылки артистов
    const artistContainer = card.querySelector('.release-artists');
    if (release.artist_names && release.artist_ids) {
      createArtistLinks(release.artist_names, release.artist_ids, artistContainer);
    } else {
      artistContainer.textContent = release.artist_name || 'Исполнитель не указан';
    }
    
    // Обработчик клика по карточке релиза
    card.addEventListener('click', (e) => {
      // Не открываем превью, если кликнули по артисту или кнопке закрепления
      if (!e.target.closest('.artist-link') && !e.target.closest('.pin-btn')) {
        handleReleaseClick(release.id);
      }
    });
    
    // Обработчик кнопки закрепления/открепления
    const pinBtn = card.querySelector('.pin-btn');
    pinBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleFavoritePinFromFullPage(release.id, pinBtn);
    });
    
    container.appendChild(card);
  });
}

// ====== ARTIST FAVORITES FUNCTIONALITY ======

// Загрузка избранных артистов для профиля (показываем закрепленные + до 5 обычных)
async function loadProfileArtistFavorites() {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  
  try {
    const favorites = await window.electronAPI.getUserArtistFavorites(currentUser.id);
    
    // Разделяем на закрепленные и обычные
    const pinnedFavorites = favorites.filter(fav => fav.is_pinned);
    const regularFavorites = favorites.filter(fav => !fav.is_pinned);
    
    // Показываем все закрепленные + до 5 обычных (максимум 6 всего)
    const maxRegular = Math.max(0, 6 - pinnedFavorites.length);
    const displayFavorites = [...pinnedFavorites, ...regularFavorites.slice(0, maxRegular)];
    
    renderProfileArtistFavorites(displayFavorites);
    
    // Добавляем обработчик для кнопки "Показать все"
    const viewAllBtn = document.getElementById('viewAllArtistFavoritesBtn');
    if (viewAllBtn) {
      viewAllBtn.onclick = () => {
        showAllArtistFavorites();
      };
    }
  } catch (err) {
    console.error('Ошибка загрузки избранных артистов для профиля:', err);
  }
}

// Загрузка оцененных релизов для профиля
async function loadProfileRatedReleases() {
  const currentUser = getCurrentUser();
  console.log('loadProfileRatedReleases called, currentUser:', currentUser);
  if (!currentUser) {
    console.log('No current user found, returning');
    return;
  }
  
  try {
    console.log('Loading rated releases for user ID:', currentUser.id);
    console.log('User isAdmin:', currentUser.isAdmin, 'isAdminLevel2:', currentUser.isAdminLevel2);
    
    // Для авторов (is_admin = 2) загружаем релизы с их авторскими оценками
    let ratedReleases;
    if (currentUser.isAdminLevel2) {
      console.log('Loading author ratings for admin user');
      ratedReleases = await window.electronAPI.getUserRatedReleases(currentUser.id);
    } else {
      console.log('Loading regular user ratings');
      ratedReleases = await window.electronAPI.getUserRatedReleases(currentUser.id);
    }
    
    console.log('Loaded rated releases:', ratedReleases.length, ratedReleases);
    
    if (!ratedReleases || ratedReleases.length === 0) {
      console.log('No rated releases found for user');
      const avgRatingElement = document.getElementById('ownAverageRating');
      if (avgRatingElement) {
        avgRatingElement.textContent = '-';
      }
      return;
    }
    
    // Обновляем статистику
    const totalRatingsElement = document.getElementById('ownTotalRatings');
    const avgRatingElement = document.getElementById('ownAverageRating');
    
    console.log('Elements found:', {
      totalRatingsElement: !!totalRatingsElement,
      avgRatingElement: !!avgRatingElement
    });
    
    if (totalRatingsElement) {
      totalRatingsElement.textContent = ratedReleases.length;
    }
    
    // Вычисляем среднюю оценку пользователя
    if (ratedReleases.length > 0) {
        console.log('Sample release data:', ratedReleases[0]);
        const validScores = ratedReleases.filter(release => {
          const score = Number(release.user_score);
          console.log('Checking release:', release.title, 'user_score:', release.user_score, 'converted:', score, 'type:', typeof release.user_score);
          return !isNaN(score) && score > 0;
        });
        console.log('Valid scores:', validScores.length, validScores);
        if (validScores.length > 0) {
            const totalScore = validScores.reduce((sum, release) => sum + Number(release.user_score), 0);
            const averageScore = totalScore / validScores.length;
            console.log('Calculated average score:', averageScore);
            if (avgRatingElement) {
              avgRatingElement.textContent = averageScore.toFixed(1);
              console.log('Set average rating to:', averageScore.toFixed(1));
            } else {
              console.error('ownAverageRating element not found!');
            }
        } else {
            console.log('No valid scores, setting to -');
            if (avgRatingElement) {
              avgRatingElement.textContent = '-';
            }
        }
    } else {
        console.log('No rated releases, setting to -');
        if (avgRatingElement) {
          avgRatingElement.textContent = '-';
        }
    }
    
    // Сохраняем все релизы для возможности показать их все
    window.allRatedReleases = ratedReleases;
    
    // Отображаем оцененные релизы (первые 5)
    renderOwnRatedReleases(ratedReleases, false);
    
    // Для администраторов показываем дополнительную информацию
    if (currentUser.isAdminLevel2) {
      console.log('Admin user detected - showing author ratings');
      // Обновляем заголовок секции для авторов
      const sectionTitle = document.querySelector('#ownRatedReleases h3');
      if (sectionTitle) {
        sectionTitle.textContent = 'Оценённые релизы (как автор)';
      }
    }
    
  } catch (err) {
    console.error('Ошибка загрузки оцененных релизов для профиля:', err);
    showNotification('Не удалось загрузить оцененные релизы', 'error');
  }
}

// Отображение оцененных релизов в собственном профиле
function renderOwnRatedReleases(releases, showAll = false) {
  const container = document.getElementById('ownRatedReleases');
  if (!container) return;
  
  container.innerHTML = '';

  if (!releases || releases.length === 0) {
    container.innerHTML = '<p style="color: #bbb; text-align: center;">Вы пока не оценили ни одного релиза</p>';
    return;
  }

  // Определяем, сколько релизов показывать
  const releasesToShow = showAll ? releases : releases.slice(0, 5);
  const hasMore = releases.length > 5;

  releasesToShow.forEach(release => {
    const card = document.createElement('div');
    card.className = 'release-card';
    
    const base64Image = release.image 
        ? `data:image/jpeg;base64,${arrayBufferToBase64(release.image)}`
        : 'images/default-cover.png';

    card.innerHTML = `
        <div class="release-image-container">
            <img src="${base64Image}" class="release-image" alt="${release.title || 'Release image'}">
            <div class="release-rating">${renderRating(release.user_score)}</div>
        </div>
        <div class="release-info">
            <h3 class="release-title" title="${release.title || 'Без названия'}">
                ${release.title || 'Без названия'}
            </h3>
            <div class="release-artists" title="${release.artist_names || 'Исполнитель не указан'}"></div>
        </div>
    `;
    
    // Создаем кликабельные ссылки артистов
    const artistContainer = card.querySelector('.release-artists');
    if (release.artist_names) {
        artistContainer.textContent = release.artist_names;
    } else {
        artistContainer.textContent = 'Исполнитель не указан';
    }

    // Добавляем обработчик клика для перехода к релизу
    card.addEventListener('click', () => {
        handleReleaseClick(release.id);
    });

    container.appendChild(card);
  });

  // Добавляем кнопку "Посмотреть всё" если есть больше релизов и мы не показываем все
  if (hasMore && !showAll) {
    const showAllButton = document.createElement('button');
    showAllButton.className = 'show-all-button';
    showAllButton.textContent = `Посмотреть всё (${releases.length})`;
    showAllButton.style.cssText = `
      width: 100%;
      padding: 12px;
      margin-top: 15px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
    `;
    
    showAllButton.addEventListener('mouseenter', () => {
      showAllButton.style.transform = 'translateY(-2px)';
      showAllButton.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
    });
    
    showAllButton.addEventListener('mouseleave', () => {
      showAllButton.style.transform = 'translateY(0)';
      showAllButton.style.boxShadow = 'none';
    });
    
    showAllButton.addEventListener('click', () => {
      renderOwnRatedReleases(releases, true);
    });
    
    container.appendChild(showAllButton);
  }
}

// Отображение избранных артистов в профиле (компактный вид)
function renderProfileArtistFavorites(favorites) {
  const grid = document.getElementById('artistFavoritesGrid');
  const empty = document.getElementById('artistFavoritesEmpty');
  
  if (!grid || !empty) return;
  
  if (!favorites || favorites.length === 0) {
    grid.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  
  grid.style.display = 'grid';
  empty.style.display = 'none';
  grid.innerHTML = '';
  
  favorites.forEach(artist => {
    const card = document.createElement('div');
    card.className = 'artist-card';
    
    // Используем кэшированный аватар или дефолтный
    let avatarUrl = 'images/default-avatar.png';
    if (artist.avatar_cache && artist.avatar_cache.length > 0) {
      try {
        avatarUrl = bytesToObjectURL(artist.avatar_cache, 'image/png');
      } catch (err) {
        console.error('Error creating avatar URL:', err);
        avatarUrl = 'images/default-avatar.png';
      }
    } else if (artist.avatar) {
      avatarUrl = bufferToImage(artist.avatar);
    }
    
    card.innerHTML = `
      <div class="artist-avatar-container">
        <img src="${avatarUrl}" class="artist-avatar" alt="${artist.name}" onerror="this.src='images/default-avatar.png'">
        <button class="pin-btn ${artist.is_pinned ? 'pinned' : ''}" title="${artist.is_pinned ? 'Открепить' : 'Закрепить'}" data-artist-id="${artist.id}">
          <img src="images/heart-color.png" alt="${artist.is_pinned ? 'Открепить' : 'Закрепить'}" class="pin-icon">
        </button>
      </div>
      <div class="artist-info">
        <h3 class="artist-name" title="${artist.name}">${artist.name}</h3>
      </div>
    `;
    
    // Обработчик клика по карточке артиста
    card.addEventListener('click', (e) => {
      // Не открываем страницу артиста, если кликнули по кнопке закрепления
      if (!e.target.closest('.pin-btn')) {
        handleArtistClick(artist.id, artist.name);
      }
    });
    
    // Обработчик кнопки закрепления/открепления
    const pinBtn = card.querySelector('.pin-btn');
    pinBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleArtistFavoritePinFromProfile(artist.id, card, pinBtn);
    });
    
    grid.appendChild(card);
    
    // Если нет кэшированного аватара, пытаемся загрузить и кэшировать его
    if (!artist.avatar) {
      loadAndCacheArtistAvatar(artist.id, artist.name);
    }
  });
}

// Переключение закрепления избранного артиста из профиля
async function toggleArtistFavoritePinFromProfile(artistId, cardElement, pinButton) {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  
  try {
    const result = await window.electronAPI.toggleArtistFavoritePin(currentUser.id, artistId);
    
    if (result.success) {
      showNotification(result.message, 'success');
      
      // Обновляем внешний вид кнопки
      if (result.isPinned) {
        pinButton.classList.add('pinned');
        pinButton.title = 'Открепить';
        pinButton.querySelector('.pin-icon').alt = 'Открепить';
      } else {
        pinButton.classList.remove('pinned');
        pinButton.title = 'Закрепить';
        pinButton.querySelector('.pin-icon').alt = 'Закрепить';
      }
      
      // Перезагружаем профиль, чтобы обновить порядок (закрепленные сверху)
      loadProfileArtistFavorites();
    } else {
      showNotification(result.message, 'error');
    }
  } catch (err) {
    console.error('Ошибка переключения закрепления артиста:', err);
    showNotification('Произошла ошибка при изменении закрепления', 'error');
  }
}

// Показать полную страницу избранных артистов
function showAllArtistFavorites() {
  // Скрываем все страницы
  document.getElementById('mainPageContent').style.display = 'none';
  document.getElementById('allReleasesPage').style.display = 'none';
  document.getElementById('searchContainer').style.display = 'none';
  document.getElementById('favoritesContainer').style.display = 'none';
  document.getElementById('artistFavoritesContainer').style.display = 'block';
  document.getElementById('releasePage').style.display = 'none';
  document.getElementById('artistPage').style.display = 'none';
  document.getElementById('rateReleasePage').style.display = 'none';
  document.getElementById('profile-page').style.display = 'none';
  
  // Снимаем активные классы с кнопок
  document.querySelectorAll('.icon-btn[data-page]').forEach(b => b.classList.remove('active'));
  
  // Загружаем все избранные артисты
  loadUserArtistFavorites();
}

// Загрузка и отображение избранных артистов для полной страницы
async function loadUserArtistFavorites() {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  
  try {
    const favorites = await window.electronAPI.getUserArtistFavorites(currentUser.id);
    renderArtistFavorites(favorites);
  } catch (err) {
    console.error('Ошибка загрузки избранных артистов:', err);
    showNotification('Не удалось загрузить избранных артистов', 'error');
  }
}

// Отображение избранных артистов (полная страница)
function renderArtistFavorites(favorites) {
  const container = document.getElementById('artistFavoritesList');
  if (!container) return;
  
  if (!favorites || favorites.length === 0) {
    container.innerHTML = '<p style="color: #bbb; text-align: center;">У вас пока нет избранных артистов</p>';
    return;
  }
  
  container.innerHTML = '';
  favorites.forEach(artist => {
    const card = document.createElement('div');
    card.className = 'artist-card';
    
    // Используем кэшированный аватар или дефолтный
    let avatarUrl = 'images/default-avatar.png';
    if (artist.avatar_cache && artist.avatar_cache.length > 0) {
      try {
        avatarUrl = bytesToObjectURL(artist.avatar_cache, 'image/png');
      } catch (err) {
        console.error('Error creating avatar URL:', err);
        avatarUrl = 'images/default-avatar.png';
      }
    } else if (artist.avatar) {
      avatarUrl = bufferToImage(artist.avatar);
    }
    
    card.innerHTML = `
      <div class="artist-avatar-container">
        <img src="${avatarUrl}" class="artist-avatar" alt="${artist.name}" onerror="this.src='images/default-avatar.png'">
        <button class="pin-btn ${artist.is_pinned ? 'pinned' : ''}" title="${artist.is_pinned ? 'Открепить' : 'Закрепить'}" data-artist-id="${artist.id}">
          <img src="images/heart-color.png" alt="${artist.is_pinned ? 'Открепить' : 'Закрепить'}" class="pin-icon">
        </button>
      </div>
      <div class="artist-info">
        <h3 class="artist-name" title="${artist.name}">${artist.name}</h3>
      </div>
    `;
    
    // Обработчик клика по карточке артиста
    card.addEventListener('click', (e) => {
      // Не открываем страницу артиста, если кликнули по кнопке закрепления
      if (!e.target.closest('.pin-btn')) {
        handleArtistClick(artist.id, artist.name);
      }
    });
    
    // Обработчик кнопки закрепления/открепления
    const pinBtn = card.querySelector('.pin-btn');
    pinBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleArtistFavoritePinFromFullPage(artist.id, pinBtn);
    });
    
    container.appendChild(card);
    
    // Если нет кэшированного аватара, пытаемся загрузить и кэшировать его
    if (!artist.avatar) {
      loadAndCacheArtistAvatar(artist.id, artist.name);
    }
  });
}

// Переключение закрепления избранного артиста с полной страницы
async function toggleArtistFavoritePinFromFullPage(artistId, pinButton) {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  
  try {
    const result = await window.electronAPI.toggleArtistFavoritePin(currentUser.id, artistId);
    
    if (result.success) {
      showNotification(result.message, 'success');
      
      // Обновляем внешний вид кнопки
      if (result.isPinned) {
        pinButton.classList.add('pinned');
        pinButton.title = 'Открепить';
        pinButton.querySelector('.pin-icon').alt = 'Открепить';
      } else {
        pinButton.classList.remove('pinned');
        pinButton.title = 'Закрепить';
        pinButton.querySelector('.pin-icon').alt = 'Закрепить';
      }
      
      // Перезагружаем список, чтобы обновить порядок (закрепленные сверху)
      loadUserArtistFavorites();
    } else {
      showNotification(result.message, 'error');
    }
  } catch (err) {
    console.error('Ошибка переключения закрепления артиста:', err);
    showNotification('Произошла ошибка при изменении закрепления', 'error');
  }
}

// Вспомогательная функция для создания кликабельных ссылок артистов
function createArtistLinks(artistNames, artistIds, container) {
  try {
  if (!artistNames || !artistIds) {
    container.textContent = 'Исполнитель не указан';
    return;
  }
  
  const names = artistNames.split(', ');
  const ids = artistIds;
  
  // Очищаем контейнер и добавляем класс для стилизации
  container.innerHTML = '';
  container.classList.remove('artist-link'); // Убираем класс кнопки с контейнера
  container.classList.add('artist-container');
  
  names.forEach((name, index) => {
    const artistId = ids[index] ? ids[index].trim() : null;
    
    const artistLink = document.createElement('span');
    artistLink.className = 'artist-link';
    artistLink.textContent = name.trim();
    
    if (artistId) {
      artistLink.setAttribute('data-artist-id', artistId);
    } else {
      artistLink.setAttribute('data-artist-name', name.trim());
    }
    
    container.appendChild(artistLink);
    
    // Добавляем запятую между артистами (кроме последнего)
    if (index < names.length - 1) {
      const comma = document.createElement('span');
      comma.className = 'artist-separator';
      comma.textContent = ', ';
      container.appendChild(comma);
    }
  });
  } catch (error) {
    console.error('Ошибка в createArtistLinks:', error);
    container.textContent = 'Исполнитель не указан';
  }
}

// Обработчик клика по артисту
async function handleArtistClick(artistId, artistName) {
    try {
        // Показываем страницу артиста с загрузкой
        showArtistPageLoading();
        
        // Очищаем визуальные поля
        resetArtistPage();

        const artistData = await window.electronAPI.getArtistDetails(artistId);
        const releases = await window.electronAPI.getArtistReleases(artistId);

        // Кэшируем аватар, если он есть
        if (artistData && artistData.avatarData) {
            const currentUser = getCurrentUser();
            if (currentUser) {
                try {
                    console.log('Caching avatar from handleArtistClick');
                    await window.electronAPI.cacheArtistAvatar(currentUser.id, artistId, artistData.avatarData);
                    console.log('Avatar cached from handleArtistClick');
                } catch (cacheError) {
                    console.error('Failed to cache avatar in handleArtistClick:', cacheError);
                    // Не показываем ошибку пользователю, так как это не критично
                }
            }
        }

        await showArtistPage(artistData, releases);
    } catch (err) {
        hideArtistPageLoading();
        showNotification('Ошибка загрузки данных артиста', 'error');
        console.error('Artist load error:', err);
    }
}

document.getElementById('submitRatingBtn').addEventListener('click', async function() {
  if (!selectedReleaseForRating) return;
  const user = getCurrentUser();
  if (!user) {
    showNotification('Войдите, чтобы оценивать релизы', 'error');
    return;
  }
  const userId = user.id;

  const ratings = {};
  document.querySelectorAll('.rating-slider').forEach(slider => {
    const key = slider.dataset.rating;
    ratings[`${key}`] = parseFloat(slider.value);
  });

  try {
    // Проверяем, является ли пользователь администратором уровня 2
    const currentUser = getCurrentUser();
    console.log('=== DEBUG RATING SUBMISSION ===');
    console.log('Current user:', currentUser);
    console.log('User isAdmin:', currentUser?.isAdmin);
    console.log('User isAdminLevel2:', currentUser?.isAdminLevel2);
    
    const isAdminLevel2 = currentUser && currentUser.isAdminLevel2;
    console.log('Final isAdminLevel2 check:', isAdminLevel2);
    
    let result;
    if (isAdminLevel2) {
      // Если пользователь - администратор уровня 2, используем submitRating (оценка автора)
      console.log('User is admin level 2, using submitRating');
      result = await window.electronAPI.submitRating({
      releaseId: selectedReleaseForRating.id,
      userId: userId,
      ratings: ratings
    });
    } else {
      // Обычный пользователь, используем submitUserRating
      console.log('User is regular user, using submitUserRating');
      result = await window.electronAPI.submitUserRating({
        releaseId: selectedReleaseForRating.id,
        userId: userId,
        ratings: ratings
      });
    }

    if (result.success) {
      // Показываем соответствующее уведомление в зависимости от типа оценки
      if (isAdminLevel2) {
        showNotification(`Оценка автора сохранена!`, 'success');
      } else {
        showNotification(`Пользовательская оценка сохранена! Ваша оценка: ${result.user_score.toFixed(1)}/10`, 'success');
      }

      // Если мы находимся на странице релиза, обновляем её с новыми данными
      if (currentRelease) {
        // Обновляем данные релиза с новым средним пользовательским рейтингом (только для обычных пользователей)
        if (!isAdminLevel2 && result.average_user_rating !== null) {
          currentRelease.average_user_rating = result.average_user_rating;
        }
        renderReleasePage(currentRelease);
        
        // Переходим на страницу релиза
        showReleasePage();
      } else {
        // Иначе переходим на главную страницу
      document.getElementById('mainPageContent').style.display = 'block';
      document.getElementById('rateReleasePage').style.display = 'none';
      document.getElementById('releaseSearchInput').value = '';
      document.querySelector('.releases-scroll-container').style.display = 'block';
      if (cachedReleases) {
        renderReleases(cachedReleases);
        }
      }
    } else {
      showNotification('Ошибка при сохранении', 'error');
    }
  } catch (err) {
    console.error('Ошибка отправки оценки:', err);
    showNotification('Ошибка при отправке', 'error');
  }
});

function resetArtistPage() {
    document.getElementById('artistAlbums').innerHTML = '';
    document.getElementById('artistSingles').innerHTML = '';

    document.querySelector('.artist-avatar').src = 'images/default-avatar.png';
    document.querySelector('.artist-name').textContent = '';
    document.querySelector('.artist-releases-count').textContent = '0';
    document.querySelector('.artist-rating').textContent = '-';
    
    // Reset banner background
    const banner = document.querySelector('.artist-banner');
    if (banner) {
        banner.style.background = 'linear-gradient(135deg, #7830B7 0%, #5e2592 50%, #3a1f5c 100%)';
    }
}


// Показать загрузку страницы артиста
function showArtistPageLoading() {
    // Скрываем все возможные страницы
    document.getElementById('mainPageContent').style.display = 'none';
    document.getElementById('searchContainer').style.display = 'none';
    document.getElementById('favoritesContainer').style.display = 'none';
    document.getElementById('releasePage').style.display = 'none';
    document.getElementById('artistPage').style.display = 'block';
    
    // Показываем загрузку
    document.getElementById('artistPageLoading').style.display = 'flex';
    document.querySelector('.artist-content-wrapper').style.display = 'none';
    
    // Снимаем активные классы с кнопок
    document.querySelectorAll('.icon-btn[data-page]').forEach(b => b.classList.remove('active'));
}

// Скрыть загрузку страницы артиста
function hideArtistPageLoading() {
    document.getElementById('artistPageLoading').style.display = 'none';
    document.querySelector('.artist-content-wrapper').style.display = 'block';
}

// Показать страницу артиста
async function showArtistPage(artistData, releases) {
    // Скрываем загрузку и показываем контент
    hideArtistPageLoading();
    
    // Скрываем все возможные страницы
    document.getElementById('mainPageContent').style.display = 'none';
    document.getElementById('searchContainer').style.display = 'none';
    document.getElementById('favoritesContainer').style.display = 'none';
    document.getElementById('releasePage').style.display = 'none';
    document.getElementById('artistPage').style.display = 'block';
    
    // Снимаем активные классы с кнопок
    document.querySelectorAll('.icon-btn[data-page]').forEach(b => b.classList.remove('active'));
    
    // Рендерим данные артиста
    await renderArtistPage(artistData, releases);
}

// Рендер страницы артиста
async function renderArtistPage(artistData, releases) {
    if (!artistData || !releases) {
        showNotification('Данные артиста не загружены', 'error');
        return;
    }
    
    // Устанавливаем аватар
    const avatarElement = document.querySelector('.artist-avatar');
    
    console.log('Artist data for avatar:', {
        id: artistData.id,
        name: artistData.name,
        hasAvatar: !!artistData.avatar,
        hasAvatarData: !!artistData.avatarData,
        avatarUrl: artistData.avatar
    });
    
    // Функция для применения цветов после загрузки аватара
    const applyColorsAfterLoad = () => {
        if (avatarElement.complete && avatarElement.naturalWidth > 0) {
            applyArtistBannerColors(avatarElement);
        } else {
            avatarElement.addEventListener('load', () => {
                applyArtistBannerColors(avatarElement);
            });
        }
    };

    // Сначала пытаемся использовать кэшированный аватар
    const currentUser = getCurrentUser();
    if (currentUser && artistData.avatarData) {
        try {
            const blob = new Blob([artistData.avatarData], { type: 'image/jpeg' });
            const imageUrl = URL.createObjectURL(blob);
            avatarElement.src = imageUrl;
            avatarElement.onerror = () => {
                // Если кэшированный аватар не загрузился, пробуем URL
    avatarElement.src = artistData.avatar || 'images/default-avatar.png';
    avatarElement.onerror = () => {
        avatarElement.src = 'images/default-avatar.png';
    };
                applyColorsAfterLoad();
            };
            applyColorsAfterLoad();
        } catch (err) {
            console.error('Error creating avatar blob:', err);
            avatarElement.src = artistData.avatar || 'images/default-avatar.png';
            avatarElement.onerror = () => {
                avatarElement.src = 'images/default-avatar.png';
            };
            applyColorsAfterLoad();
        }
    } else if (currentUser) {
        // Если нет avatarData, пытаемся получить кэшированный аватар из базы
        try {
            const cachedAvatar = await window.electronAPI.getCachedArtistAvatar(currentUser.id, artistData.id);
            if (cachedAvatar.success && cachedAvatar.avatar) {
                const blob = new Blob([cachedAvatar.avatar], { type: 'image/jpeg' });
                const imageUrl = URL.createObjectURL(blob);
                avatarElement.src = imageUrl;
                avatarElement.onerror = () => {
                    avatarElement.src = artistData.avatar || 'images/default-avatar.png';
                    avatarElement.onerror = () => {
                        avatarElement.src = 'images/default-avatar.png';
                    };
                    applyColorsAfterLoad();
                };
                applyColorsAfterLoad();
            } else {
                // Используем URL аватара или дефолтный
                avatarElement.src = artistData.avatar || 'images/default-avatar.png';
                avatarElement.onerror = () => {
                    avatarElement.src = 'images/default-avatar.png';
                };
                applyColorsAfterLoad();
            }
        } catch (err) {
            console.error('Error getting cached avatar:', err);
            avatarElement.src = artistData.avatar || 'images/default-avatar.png';
            avatarElement.onerror = () => {
                avatarElement.src = 'images/default-avatar.png';
            };
            applyColorsAfterLoad();
        }
    } else {
        // Используем URL аватара или дефолтный
        avatarElement.src = artistData.avatar || 'images/default-avatar.png';
        avatarElement.onerror = () => {
            avatarElement.src = 'images/default-avatar.png';
        };
        applyColorsAfterLoad();
    }
    
    // Устанавливаем имя артиста
    document.querySelector('.artist-name').textContent = artistData.name;
    
    // Устанавливаем статистику
    document.querySelector('.artist-releases-count').textContent = releases.length;
    document.querySelector('.artist-rating').textContent = artistData.average_rating || '-';
    
    // Разделяем релизы на альбомы и синглы
    const albums = releases.filter(r => r.type === 'Альбом');
    const singles = releases.filter(r => r.type === 'Сингл');
    
    // Рендерим альбомы
    renderArtistReleases(albums, 'artistAlbums');
    
    // Рендерим синглы
    renderArtistReleases(singles, 'artistSingles');
    
    // Инициализируем кнопку избранного артиста
    initArtistFavoriteButton(artistData.id);
    
    // Применяем цвет из аватара, если есть
    // if (artistData.avatar) {
    //     applyArtistColor(avatarElement);
    // } else {
    //     applyArtistColor('#7830B7');
    // }
}

// Инициализация кнопки избранного артиста
async function initArtistFavoriteButton(artistId) {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  
  const button = document.getElementById('artistFavoriteBtn');
  if (!button) return;
  
  // Сбрасываем состояние кнопки перед проверкой
  button.classList.remove('active');
  //button.title = 'Добавить в избранное';
  button.style.background = '';
  button.style.borderColor = '';
  
  try {
    // Проверяем, в избранном ли артист
    const result = await window.electronAPI.isArtistFavorite(currentUser.id, artistId);
    updateArtistFavoriteButton(button, result.isFavorite);
    
    // Добавляем обработчик клика
    button.onclick = () => toggleArtistFavorite(currentUser.id, artistId, button);
  } catch (err) {
    console.error('Ошибка инициализации кнопки избранного артиста:', err);
  }
}

// Обновление внешнего вида кнопки избранного артиста
function updateArtistFavoriteButton(button, isFavorite) {
  if (isFavorite) {
    button.classList.add('active');
    button.title = 'Удалить из избранного';
    button.querySelector('.artist-favorite-icon').alt = 'Удалить из избранного';
  } else {
    button.classList.remove('active');
    button.title = 'Добавить в избранное';
    button.querySelector('.artist-favorite-icon').alt = 'Добавить в избранное';
  }
}

// Переключение избранного артиста
async function toggleArtistFavorite(userId, artistId, button) {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    // Проверяем текущий статус
    const isCurrentlyFavorite = await window.electronAPI.isArtistFavorite(userId, artistId);
    
    let result;
    if (isCurrentlyFavorite.isFavorite) {
      result = await window.electronAPI.removeArtistFromFavorites(userId, artistId);
    } else {
      result = await window.electronAPI.addArtistToFavorites(userId, artistId);
      
      // Если успешно добавили в избранное, кэшируем аватар
      if (result.success) {
        await cacheArtistAvatar(userId, artistId);
      }
    }
    
    if (result.success) {
      showNotification(result.message, 'success');
      updateArtistFavoriteButton(button, !isCurrentlyFavorite.isFavorite);
    } else {
      showNotification(result.message, 'error');
    }
  } catch (err) {
    console.error('Ошибка переключения избранного артиста:', err);
    showNotification('Произошла ошибка при изменении избранного', 'error');
  }
}

// Кэширование аватара артиста
async function cacheArtistAvatar(userId, artistId) {
  try {
    console.log('Starting avatar cache for user:', userId, 'artist:', artistId);
    
    // Получаем данные артиста
    const artistData = await window.electronAPI.getArtistDetails(artistId);
    console.log('Artist data received:', artistData ? 'yes' : 'no', 'avatarData:', artistData?.avatarData ? 'yes' : 'no');
    
    if (artistData && artistData.avatarData) {
      console.log('Avatar data size:', artistData.avatarData.length);
      // Кэшируем аватар в базе данных
      await window.electronAPI.cacheArtistAvatar(userId, artistId, artistData.avatarData);
      console.log('Avatar cached successfully');
    } else {
      console.log('No avatar data to cache');
    }
  } catch (err) {
    console.error('Ошибка кэширования аватара артиста:', err);
    console.error('Error details:', err.message);
  }
}

// Загрузка и кэширование аватара артиста в фоне
async function loadAndCacheArtistAvatar(artistId, artistName) {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    // Получаем данные артиста
    const artistData = await window.electronAPI.getArtistDetails(artistId);
    
    if (artistData && artistData.avatarData) {
      // Кэшируем аватар в базе данных
      await window.electronAPI.cacheArtistAvatar(currentUser.id, artistId, artistData.avatarData);
      
      // Обновляем отображение аватара в профиле
      updateArtistAvatarInProfile(artistId, artistData.avatarData);
    }
  } catch (err) {
    console.error('Ошибка загрузки и кэширования аватара артиста:', err);
  }
}

// Обновление аватара артиста в профиле
function updateArtistAvatarInProfile(artistId, avatarData) {
  const avatarImg = document.querySelector(`[data-artist-id="${artistId}"] .artist-avatar`);
  if (avatarImg && avatarData) {
    const avatarUrl = bufferToImage(avatarData);
    avatarImg.src = avatarUrl;
  }
}

// Применить динамические цвета баннера на основе аватара артиста
async function applyArtistBannerColors(avatarElement) {
    try {
        const banner = document.querySelector('.artist-banner');
        const overlay = document.querySelector('.artist-banner-overlay');
        
        if (!banner || !overlay || !avatarElement) {
            return;
        }
        
        // Создаем временный canvas для извлечения цветов
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Устанавливаем размеры canvas
        canvas.width = avatarElement.naturalWidth || avatarElement.width;
        canvas.height = avatarElement.naturalHeight || avatarElement.height;
        
        // Рисуем изображение на canvas
        ctx.drawImage(avatarElement, 0, 0);
        
        // Получаем данные изображения
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Вычисляем средний цвет
        let r = 0, g = 0, b = 0;
        const pixelCount = data.length / 4;
        
        for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
        }
        
        r = Math.floor(r / pixelCount);
        g = Math.floor(g / pixelCount);
        b = Math.floor(b / pixelCount);
        
        // Создаем цветовые варианты
        const primaryColor = `rgb(${r}, ${g}, ${b})`;
        const secondaryColor = `rgb(${Math.floor(r * 0.7)}, ${Math.floor(g * 0.7)}, ${Math.floor(b * 0.7)})`;
        const tertiaryColor = `rgb(${Math.floor(r * 0.5)}, ${Math.floor(g * 0.5)}, ${Math.floor(b * 0.5)})`;
        
        // Применяем градиент к баннеру
        banner.style.background = `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 50%, ${tertiaryColor} 100%)`;
        
        // Применяем более темный оверлей для лучшей читаемости
        overlay.style.background = `linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.6) 100%)`;
        
        console.log('Applied dynamic banner colors:', { primaryColor, secondaryColor, tertiaryColor });
        
    } catch (error) {
        console.error('Error applying artist banner colors:', error);
        // Fallback к дефолтным цветам
        const banner = document.querySelector('.artist-banner');
        if (banner) {
            banner.style.background = 'linear-gradient(135deg, #7830B7 0%, #5e2592 50%, #3a1f5c 100%)';
        }
    }
}

// Применить цвет артиста к заголовку (legacy function)
function applyArtistColor(source) {
    const header = document.querySelector('.artist-header');
    
    if (typeof source === 'string') {
        // Если передан цвет напрямую
        header.style.background = `linear-gradient(135deg, ${source} 0%, ${darkenColor(source, 20)} 100%)`;
        return;
    }
    
    // Если передан элемент изображения
    getAverageColorFromImage(source)
        .then(color => {
            header.style.background = `linear-gradient(135deg, ${color} 0%, ${darkenColor(color, 20)} 100%)`;
        })
        .catch(() => {
            header.style.background = `linear-gradient(135deg, #7830B7 0%, #5e2592 100%)`;
        });
}

// Показать загрузку страницы пользователя
function showUserProfilePageLoading() {
    // Скрываем все возможные страницы
    document.getElementById('mainPageContent').style.display = 'none';
    document.getElementById('searchContainer').style.display = 'none';
    document.getElementById('favoritesContainer').style.display = 'none';
    document.getElementById('releasePage').style.display = 'none';
    document.getElementById('artistPage').style.display = 'none';
    document.getElementById('profile-page').style.display = 'none';
    document.getElementById('userProfilePage').style.display = 'block';

    // Показываем загрузку
    document.getElementById('userProfilePageLoading').style.display = 'flex';
    document.querySelector('#userProfilePage .profile-page').style.display = 'none';
    
    // Снимаем активные классы с кнопок
    document.querySelectorAll('.icon-btn[data-page]').forEach(b => b.classList.remove('active'));
}

// Скрыть загрузку страницы пользователя
function hideUserProfilePageLoading() {
    document.getElementById('userProfilePageLoading').style.display = 'none';
    document.querySelector('#userProfilePage .profile-page').style.display = 'block';
}

// Показать загрузку страницы профиля
function showProfilePageLoading() {
    // Показываем страницу профиля
    showPage('profile-page');
    
    // Показываем загрузку
    document.getElementById('profilePageLoading').style.display = 'flex';
    document.querySelector('.profile-content-wrapper').style.display = 'none';
}

// Скрыть загрузку страницы профиля
function hideProfilePageLoading() {
    document.getElementById('profilePageLoading').style.display = 'none';
    document.querySelector('.profile-content-wrapper').style.display = 'block';
}

// Показать страницу пользователя
async function showUserProfilePage(userId) {
    try {
        // Показываем загрузку
        showUserProfilePageLoading();
        
        console.log('Loading user profile for ID:', userId);
        
        // Получаем данные пользователя
        const userData = await window.electronAPI.getUserById(userId);
        if (!userData) {
            showNotification('Пользователь не найден', 'error');
            hideUserProfilePageLoading();
            return;
        }
        
        console.log('User data loaded:', userData);
        
        // Получаем все данные пользователя параллельно
        const [ratedReleases, favorites, artistFavorites] = await Promise.all([
            window.electronAPI.getUserRatedReleases(userId),
            window.electronAPI.getUserFavorites(userId),
            window.electronAPI.getUserArtistFavorites(userId)
        ]);
        
        console.log('All user data loaded:', { ratedReleases, favorites, artistFavorites });
        
        // Скрываем загрузку и показываем контент
        hideUserProfilePageLoading();
        
        // Скрываем все возможные страницы
        document.getElementById('mainPageContent').style.display = 'none';
        document.getElementById('searchContainer').style.display = 'none';
        document.getElementById('favoritesContainer').style.display = 'none';
        document.getElementById('releasePage').style.display = 'none';
        document.getElementById('artistPage').style.display = 'none';
        document.getElementById('profile-page').style.display = 'none';
        document.getElementById('userProfilePage').style.display = 'block';
    
    // Снимаем активные классы с кнопок
    document.querySelectorAll('.icon-btn[data-page]').forEach(b => b.classList.remove('active'));

        // Рендерим данные пользователя
        renderUserProfilePage(userData, ratedReleases, favorites, artistFavorites);
        
    } catch (err) {
        hideUserProfilePageLoading();
        showNotification('Ошибка загрузки профиля пользователя', 'error');
        console.error('User profile load error:', err);
    }
}

// Рендер страницы пользователя
function renderUserProfilePage(userData, ratedReleases, favorites, artistFavorites) {
    if (!userData) {
        showNotification('Данные пользователя не загружены', 'error');
        return;
    }
    
    console.log('Rendering user profile for:', userData.displayName, 'ID:', userData.id);
    console.log('User data:', {
        id: userData.id,
        displayName: userData.displayName,
        hasAvatar: !!userData.avatarBytes,
        hasBanner: !!userData.bannerBytes,
        avatarSize: userData.avatarBytes ? userData.avatarBytes.length : 0,
        bannerSize: userData.bannerBytes ? userData.bannerBytes.length : 0
    });
    
    // Очищаем предыдущие blob URL для предотвращения конфликтов
    const avatarElement = document.getElementById('userProfileAvatar');
    const bannerElement = document.querySelector('#userProfilePage .profile-header');
    
    // Сбрасываем аватар
    if (avatarElement.src && avatarElement.src.startsWith('blob:')) {
        URL.revokeObjectURL(avatarElement.src);
    }
    
    // Сбрасываем баннер
    if (bannerElement.style.backgroundImage && bannerElement.style.backgroundImage.includes('blob:')) {
        const currentBg = bannerElement.style.backgroundImage;
        const blobUrl = currentBg.match(/url\(([^)]+)\)/);
        if (blobUrl && blobUrl[1].startsWith('blob:')) {
            URL.revokeObjectURL(blobUrl[1]);
        }
    }
    
    // Устанавливаем аватар
    if (userData.avatarBytes && userData.avatarBytes.length > 0) {
        try {
            console.log('Creating avatar URL for user:', userData.displayName, 'ID:', userData.id);
            const avatarUrl = bytesToObjectURL(userData.avatarBytes, userData.avatarMime || 'image/png');
            avatarElement.src = avatarUrl;
            console.log('Avatar URL created for user', userData.id, ':', avatarUrl);
            avatarElement.onerror = () => {
                console.log('Avatar load error for user', userData.id, ', using default');
                avatarElement.src = 'images/default-avatar.png';
            };
        } catch (err) {
            console.error('Error creating user avatar URL for user', userData.id, ':', err);
            avatarElement.src = 'images/default-avatar.png';
        }
    } else {
        console.log('No avatar data for user', userData.id, ', using default');
        avatarElement.src = 'images/default-avatar.png';
    }
    
    // Устанавливаем баннер
    if (userData.bannerBytes && userData.bannerBytes.length > 0) {
        try {
            console.log('Creating banner URL for user:', userData.displayName, 'ID:', userData.id);
            const bannerUrl = bytesToObjectURL(userData.bannerBytes, userData.bannerMime || 'image/png');
            bannerElement.style.backgroundImage = `url(${bannerUrl})`;
            console.log('Banner URL created for user', userData.id, ':', bannerUrl);
        } catch (err) {
            console.error('Error creating user banner URL for user', userData.id, ':', err);
        }
    } else {
        console.log('No banner data for user', userData.id, ', using default background');
        bannerElement.style.backgroundImage = '';
    }
    
    // Устанавливаем имя пользователя
    document.getElementById('userProfileName').textContent = userData.displayName;
    
    // Устанавливаем дату регистрации
    document.getElementById('userProfileRegDate').textContent = userData.registrationDate ? 
        new Date(userData.registrationDate).toLocaleDateString('ru-RU') : '-';
    
    // Устанавливаем информацию "Обо мне"
    const aboutText = document.getElementById('userAboutText');
    if (userData.about && userData.about.trim()) {
        aboutText.textContent = userData.about;
        aboutText.style.fontStyle = 'normal';
        aboutText.style.color = 'rgba(255,255,255,0.8)';
    } else {
        aboutText.textContent = 'Пользователь пока не добавил описание';
        aboutText.style.fontStyle = 'italic';
        aboutText.style.color = 'rgba(255,255,255,0.5)';
    }
    
    // Устанавливаем уровень и прогресс (пока используем фиксированные значения)
    const level = 1; // Пока нет системы уровней
    const levelProgress = 0; // Пока нет системы опыта
    
    document.getElementById('userLevelBar').style.width = `${levelProgress}%`;
    document.getElementById('userLevelPercentage').textContent = `${Math.round(levelProgress)}%`;
    
    // Устанавливаем статистику
    document.getElementById('userTotalRatings').textContent = ratedReleases.length;
    
    // Вычисляем среднюю оценку пользователя
    console.log('Calculating average rating for user:', userData.displayName, 'ratedReleases:', ratedReleases.length);
    if (ratedReleases.length > 0) {
        console.log('Sample release data for other user:', ratedReleases[0]);
        const validScores = ratedReleases.filter(release => {
          const score = Number(release.user_score);
          console.log('Checking other user release:', release.title, 'user_score:', release.user_score, 'converted:', score, 'type:', typeof release.user_score);
          return !isNaN(score) && score > 0;
        });
        console.log('Valid scores count for other user:', validScores.length);
        if (validScores.length > 0) {
            const totalScore = validScores.reduce((sum, release) => sum + Number(release.user_score), 0);
            const averageScore = totalScore / validScores.length;
            console.log('Average score calculated for other user:', averageScore);
            const avgElement = document.getElementById('userAverageRating');
            if (avgElement) {
                avgElement.textContent = averageScore.toFixed(1);
                console.log('Average rating set for other user to:', averageScore.toFixed(1));
        } else {
                console.error('userAverageRating element not found!');
        }
    } else {
            console.log('No valid scores for other user, setting to -');
            const avgElement = document.getElementById('userAverageRating');
            if (avgElement) {
                avgElement.textContent = '-';
            } else {
                console.error('userAverageRating element not found!');
            }
        }
    } else {
        console.log('No rated releases for other user, setting to -');
        const avgElement = document.getElementById('userAverageRating');
        if (avgElement) {
            avgElement.textContent = '-';
        } else {
            console.error('userAverageRating element not found!');
        }
    }
    
    // Генерируем значки на основе активности пользователя
    generateUserBadges(ratedReleases.length, userData.registrationDate);
    
    // Рендерим все секции
    renderUserFavorites(favorites);
    renderUserArtistFavorites(artistFavorites);
    renderUserRatedReleases(ratedReleases);
}

// Генерация значков пользователя
function generateUserBadges(ratingCount, registrationDate) {
    const badgesContainer = document.getElementById('userBadges');
    badgesContainer.innerHTML = '';
    
    const badges = [];
    
    // Значок за количество оценок
    if (ratingCount >= 100) {
        badges.push({ icon: 'images/music-color.png', title: 'Оценил 100+ релизов' });
    } else if (ratingCount >= 50) {
        badges.push({ icon: 'images/music-color.png', title: 'Оценил 50+ релизов' });
    } else if (ratingCount >= 10) {
        badges.push({ icon: 'images/music-color.png', title: 'Оценил 10+ релизов' });
    }
    
    // Значок за дату регистрации
    if (registrationDate) {
        const regYear = new Date(registrationDate).getFullYear();
        if (regYear <= 2023) {
            badges.push({ icon: 'images/star-color.png', title: `Участник с ${regYear}` });
        }
    }
    
    // Значок за активность
    if (ratingCount >= 25) {
        badges.push({ icon: 'images/bookmark-color.png', title: 'Активный участник' });
    }
    
    // Добавляем значки в контейнер
    badges.forEach(badge => {
        const badgeElement = document.createElement('div');
        badgeElement.className = 'badge';
        badgeElement.title = badge.title;
        badgeElement.innerHTML = `<img src="${badge.icon}" alt="${badge.title}">`;
        badgesContainer.appendChild(badgeElement);
    });
}

// Рендер избранных релизов пользователя
function renderUserFavorites(favorites) {
    const grid = document.getElementById('userFavoritesGrid');
    const empty = document.getElementById('userFavoritesEmpty');
    
    if (!grid || !empty) return;
    
    if (!favorites || favorites.length === 0) {
        grid.style.display = 'none';
        empty.style.display = 'block';
        return;
    }
    
    grid.style.display = 'grid';
    empty.style.display = 'none';
    grid.innerHTML = '';
    
    // Показываем только 5 закрепленных релизов
    const pinnedFavorites = favorites.filter(fav => fav.is_pinned).slice(0, 5);
    
    pinnedFavorites.forEach(release => {
        const card = document.createElement('div');
        card.className = 'release-card';
        
        const base64Image = release.image 
            ? `data:image/jpeg;base64,${arrayBufferToBase64(release.image)}`
            : 'images/default-cover.png';
        
        card.innerHTML = `
            <div class="release-image-container">
                <img src="${base64Image}" class="release-image" alt="${release.title || 'Release image'}">
                <div class="release-rating">${renderRating(release.host_rating)}</div>
            </div>
            <div class="release-info">
                <h3 class="release-title" title="${release.title || 'Без названия'}">
                    ${release.title || 'Без названия'}
                </h3>
                <div class="release-artists" title="${release.artist_names || 'Исполнитель не указан'}"></div>
            </div>
        `;
        
        // Создаем кликабельные ссылки артистов
        const artistContainer = card.querySelector('.release-artists');
        if (release.artist_names) {
            artistContainer.textContent = release.artist_names;
        } else {
            artistContainer.textContent = 'Исполнитель не указан';
        }

        // Добавляем обработчик клика для перехода к релизу
        card.addEventListener('click', () => {
            handleReleaseClick(release.id);
        });

        grid.appendChild(card);
    });
    
    // Добавляем кнопку "посмотреть всё" если есть больше релизов
    if (favorites.length > 5) {
        const viewAllBtn = document.createElement('button');
        viewAllBtn.className = 'view-all-btn';
        viewAllBtn.textContent = 'Посмотреть всё';
        viewAllBtn.addEventListener('click', () => {
            // Переходим на страницу избранного
            showAllFavorites();
        });
        grid.appendChild(viewAllBtn);
    }
}

// Рендер избранных артистов пользователя
function renderUserArtistFavorites(artistFavorites) {
    const grid = document.getElementById('userArtistFavoritesGrid');
    const empty = document.getElementById('userArtistFavoritesEmpty');
    
    if (!grid || !empty) return;
    
    if (!artistFavorites || artistFavorites.length === 0) {
        grid.style.display = 'none';
        empty.style.display = 'block';
        return;
    }
    
    grid.style.display = 'grid';
    empty.style.display = 'none';
    grid.innerHTML = '';
    
    // Показываем только 5 закрепленных артистов
    const pinnedArtists = artistFavorites.filter(artist => artist.is_pinned).slice(0, 5);
    
    pinnedArtists.forEach(artist => {
        const card = document.createElement('div');
        card.className = 'release-card';
        
        let avatarUrl = 'images/default-avatar.png';
        if (artist.avatar_cache) {
            try {
                avatarUrl = bytesToObjectURL(artist.avatar_cache, 'image/png');
            } catch (err) {
                console.error('Error creating artist avatar URL:', err);
            }
        }
        
        card.innerHTML = `
            <div class="release-image-container">
                <img src="${avatarUrl}" class="release-image" alt="${artist.name}">
            </div>
            <div class="release-info">
                <h3 class="release-title" title="${artist.name}">
                    ${artist.name}
                </h3>
            </div>
        `;

        // Добавляем обработчик клика для перехода к артисту
        card.addEventListener('click', () => {
            handleArtistClick(artist.id, artist.name);
        });

        grid.appendChild(card);
    });
    
    // Добавляем кнопку "посмотреть всё" если есть больше артистов
    if (artistFavorites.length > 5) {
        const viewAllBtn = document.createElement('button');
        viewAllBtn.className = 'view-all-btn';
        viewAllBtn.textContent = 'Посмотреть всё';
        viewAllBtn.addEventListener('click', () => {
            // Переходим на страницу избранных артистов
            showAllArtistFavorites();
        });
        grid.appendChild(viewAllBtn);
    }
}

// Рендер оцененных релизов пользователя
function renderUserRatedReleases(releases) {
    const container = document.getElementById('userRatedReleases');
    container.innerHTML = '';

    if (!releases || releases.length === 0) {
        container.innerHTML = '<p style="color: #bbb; text-align: center;">Пользователь пока не оценил ни одного релиза</p>';
        return;
    }

    releases.forEach(release => {
        const card = document.createElement('div');
        card.className = 'release-card';
        
        const base64Image = release.image 
            ? `data:image/jpeg;base64,${arrayBufferToBase64(release.image)}`
            : 'images/default-cover.png';

        card.innerHTML = `
            <div class="release-image-container">
                <img src="${base64Image}" class="release-image" alt="${release.title || 'Release image'}">
                <div class="release-rating">${renderRating(release.user_score)}</div>
            </div>
            <div class="release-info">
                <h3 class="release-title" title="${release.title || 'Без названия'}">
                    ${release.title || 'Без названия'}
                </h3>
                <div class="release-artists" title="${release.artist_names || 'Исполнитель не указан'}"></div>
            </div>
        `;
        
        // Создаем кликабельные ссылки артистов
        const artistContainer = card.querySelector('.release-artists');
        if (release.artist_names) {
            artistContainer.textContent = release.artist_names;
        } else {
            artistContainer.textContent = 'Исполнитель не указан';
        }

        // Добавляем обработчик клика для перехода к релизу
        card.addEventListener('click', () => {
            handleReleaseClick(release.id);
        });

        container.appendChild(card);
    });
}

async function showProfilePage(user) {
    console.log('showProfilePage called with user:', user);
    
    // Показываем загрузку
    showProfilePageLoading();

    try {
    console.log('Rendering profile page for user:', user);
        await renderProfilePage(user);
        
        // Скрываем загрузку и показываем контент
        hideProfilePageLoading();
    } catch (error) {
        console.error('Error loading profile page:', error);
        hideProfilePageLoading();
        showNotification('Ошибка загрузки профиля', 'error');
    }
}

////////////////////                                      ////////////////////
////////////////////                                      ////////////////////
////////////////////             БАФФЕРЫ                  ////////////////////
////////////////////                                      ////////////////////
////////////////////                                      ////////////////////


function bufferLikeToUint8Array(bufLike) {
  // На всякий случай поддержим и форму {data: [...]} (если придёт Buffer-объект)
  if (!bufLike) return null;
  if (bufLike instanceof Uint8Array) return bufLike;
  if (Array.isArray(bufLike)) return new Uint8Array(bufLike);
  if (bufLike.data && Array.isArray(bufLike.data)) return new Uint8Array(bufLike.data);
  return null;
}

function bytesToObjectURL(bytes, mime = 'image/png') {
  const blob = new Blob([bytes], { type: mime || 'image/png' });
  return URL.createObjectURL(blob);
}

// Функция для создания уникального Blob URL с принудительным обновлением
function createUniqueBlobURL(bytes, mime = 'image/png') {
  const blob = new Blob([bytes], { type: mime || 'image/png' });
  return URL.createObjectURL(blob);
}

function readFileAsBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

async function renderProfilePage(user) {
  if (!user) { showNotification('Данные пользователя не загружены', 'error'); return; }

  console.log('renderProfilePage called with user:', user);
  console.log('User data in renderProfilePage:', {
    id: user.id,
    displayName: user.displayName,
    hasAvatar: !!user.avatarBytes,
    hasBanner: !!user.bannerBytes
  });

  const avatarEl = document.getElementById('profileAvatar');
  const nameSpan = document.getElementById('profile-name');
  const bannerEl = document.querySelector('#profile-page .profile-header');
  const abountEl = document.getElementById('aboutSpan');

  console.log('Elements found:', {
    avatarEl: !!avatarEl,
    nameSpan: !!nameSpan,
    bannerEl: !!bannerEl,
    abountEl: !!abountEl
  });

  // Очищаем предыдущие blob URL для предотвращения конфликтов
  if (avatarEl.src && avatarEl.src.startsWith('blob:')) {
    URL.revokeObjectURL(avatarEl.src);
  }
  if (bannerEl.style.backgroundImage && bannerEl.style.backgroundImage.includes('blob:')) {
    const currentBg = bannerEl.style.backgroundImage;
    const blobUrl = currentBg.match(/url\(([^)]+)\)/);
    if (blobUrl && blobUrl[1].startsWith('blob:')) {
      URL.revokeObjectURL(blobUrl[1]);
    }
  }

  // Ник/дата
  nameSpan.textContent = user.displayName;
  if (user.registrationDate) {
    document.getElementById('profileRegDate').textContent =
      new Date(user.registrationDate).toLocaleDateString('ru-RU');
  }

  abountEl.textContent = user.about;

  // Устанавливаем аватар
  if (avatarEl && user.avatarBytes && user.avatarBytes.length > 0) {
    try {
      console.log('Creating avatar URL for own profile:', user.displayName, 'ID:', user.id);
      const avatarUrl = bytesToObjectURL(user.avatarBytes, user.avatarMime || 'image/png');
      avatarEl.src = avatarUrl;
      console.log('Avatar URL created for own profile', user.id, ':', avatarUrl);
      avatarEl.onerror = () => {
        console.log('Avatar load error for own profile', user.id, ', using default');
        avatarEl.src = 'images/default-avatar.png';
      };
    } catch (err) {
      console.error('Error creating avatar URL for own profile', user.id, ':', err);
    avatarEl.src = 'images/default-avatar.png';
  }
  } else if (avatarEl) {
    console.log('No avatar data for own profile', user.id, ', using default');
    avatarEl.src = 'images/default-avatar.png';
  } else {
    console.error('Avatar element not found!');
  }

  // Устанавливаем баннер
  if (bannerEl && user.bannerBytes && user.bannerBytes.length > 0) {
    try {
      console.log('Creating banner URL for own profile:', user.displayName, 'ID:', user.id);
      const bannerUrl = bytesToObjectURL(user.bannerBytes, user.bannerMime || 'image/png');
      bannerEl.style.backgroundImage = `url(${bannerUrl})`;
      console.log('Banner URL created for own profile', user.id, ':', bannerUrl);
    } catch (err) {
      console.error('Error creating banner URL for own profile', user.id, ':', err);
    }
  } else if (bannerEl) {
    console.log('No banner data for own profile', user.id, ', using default background');
    bannerEl.style.backgroundImage = '';
  } else {
    console.error('Banner element not found!');
  }

  // ====== Хендлеры ввода ======
  // Все функции редактирования перенесены на страницу настроек

  // Загружаем все данные профиля асинхронно
  try {
    // Загружаем оцененные релизы для профиля
    await loadProfileRatedReleases();
    
    // Загружаем избранные релизы для профиля
    await loadProfileFavorites();
    
    // Загружаем избранных артистов для профиля
    await loadProfileArtistFavorites();
  } catch (error) {
    console.error('Error loading profile data:', error);
    throw error; // Re-throw to be caught by showProfilePage
  }
}

function getCurrentUser() {
    return currentUser;
}

// ===== CENTRALIZED PAGE NAVIGATION =====

// Список всех страниц в приложении
const ALL_PAGES = [
    'mainPageContent',
    'searchContainer', 
    'favoritesContainer',
    'artistFavoritesContainer',
    'releasePage',
    'artistPage',
    'profile-page',
    'userProfilePage',
    'settingsPage',
    'updatesPage',
    'allReleasesPage',
    'rateReleasePage'
];

// Функция для скрытия всех страниц
function hideAllPages() {
    ALL_PAGES.forEach(pageId => {
        const page = document.getElementById(pageId);
        if (page) {
            page.style.display = 'none';
            // Добавляем класс hidden-page для страниц, которые должны быть скрыты по умолчанию
            if (pageId !== 'mainPageContent') {
                page.classList.add('hidden-page');
            }
        }
    });
}

// Функция для показа конкретной страницы
function showPage(pageId) {
    hideAllPages();
    const page = document.getElementById(pageId);
    if (page) {
        // Убираем класс hidden-page и показываем страницу
        page.classList.remove('hidden-page');
        page.style.display = 'block';
    }
    // Снимаем активные классы с кнопок
    document.querySelectorAll('.icon-btn[data-page]').forEach(b => b.classList.remove('active'));
}

// Функция для показа главной страницы
function showMainPage() {
    showPage('mainPageContent');
    // Устанавливаем активный класс для кнопки "Главная"
    const homeBtn = document.querySelector('.icon-btn[data-page="releases"]');
    if (homeBtn) homeBtn.classList.add('active');
}

// ===== UPDATES PAGE FUNCTIONALITY =====

// Показать страницу обновлений
function showUpdatesPage() {
    console.log('showUpdatesPage called');
    
    // Используем централизованную навигацию
    showPage('updatesPage');
    
    // Настраиваем обработчики событий
    setupUpdatesEventHandlers();
    
    // Проверяем права администратора
    checkAdminRights();
    
    // Загружаем обновления
    loadUpdates();
}

// Загрузка обновлений
async function loadUpdates() {
    const loadingEl = document.getElementById('updatesLoading');
    const containerEl = document.getElementById('updatesContainer');
    const emptyEl = document.getElementById('updatesEmpty');
    
    // Показываем загрузку
    loadingEl.style.display = 'flex';
    containerEl.style.display = 'none';
    emptyEl.style.display = 'none';
    
    try {
        // Загружаем посты из базы данных
        const posts = await window.electronAPI.getPosts();
        
        // Скрываем загрузку
        loadingEl.style.display = 'none';
        
        if (!posts || posts.length === 0) {
            // Показываем пустое состояние
            emptyEl.style.display = 'block';
        } else {
            // Рендерим посты
            renderPosts(posts);
            containerEl.style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading updates:', error);
        loadingEl.style.display = 'none';
        emptyEl.style.display = 'block';
        showNotification('Ошибка загрузки обновлений', 'error');
    }
}

// Рендеринг постов
function renderPosts(posts) {
    const container = document.getElementById('updatesContainer');
    container.innerHTML = '';
    
    // Переворачиваем массив, чтобы новые посты были сверху
    posts.slice().reverse().forEach(post => {
        const postCard = createPostCard(post);
        container.appendChild(postCard);
    });
}

// Создание карточки поста
function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'post-card';
    card.dataset.postId = post.id;
    
    // Форматируем дату (только дата, без времени)
    const postDate = new Date(post.date).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    
    // Проверяем, лайкнул ли пользователь этот пост (будет загружено асинхронно)
    const isLiked = false; // Временно, будет обновлено после загрузки
    
    card.innerHTML = `
        <div class="post-header">
            <img src="${post.authorAvatar || 'images/default-avatar.png'}" 
                 alt="${post.authorName}" 
                 class="post-avatar">
            <div class="post-author">
                <h3 class="post-author-name">${post.authorName}</h3>
                <p class="post-date">${postDate}</p>
            </div>
        </div>
        
        <div class="post-content">
            <div class="post-text">${(post.text || '').replace(/\n/g, '<br>')}</div>
            ${post.image ? `<img src="${post.image}" alt="Post image" class="post-image">` : ''}
        </div>
        
        <div class="post-actions">
            <button class="like-btn ${isLiked ? 'liked' : ''}" data-post-id="${post.id}">
                <svg class="like-icon" viewBox="0 0 24 24" fill="none">
                    <path d="M20.84 4.61C20.3292 4.099 19.7228 3.69364 19.0554 3.41708C18.3879 3.14052 17.6725 2.99817 16.95 2.99817C16.2275 2.99817 15.5121 3.14052 14.8446 3.41708C14.1772 3.69364 13.5708 4.099 13.06 4.61L12 5.67L10.94 4.61C9.9083 3.5783 8.50903 2.9987 7.05 2.9987C5.59096 2.9987 4.19169 3.5783 3.16 4.61C2.1283 5.6417 1.5487 7.04097 1.5487 8.5C1.5487 9.95903 2.1283 11.3583 3.16 12.39L12 21.23L20.84 12.39C21.351 11.8792 21.7563 11.2728 22.0329 10.6053C22.3095 9.93789 22.4518 9.22248 22.4518 8.5C22.4518 7.77752 22.3095 7.06211 22.0329 6.39467C21.7563 5.72723 21.351 5.1208 20.84 4.61Z" 
                          stroke="currentColor" 
                          stroke-width="2" 
                          stroke-linecap="round" 
                          stroke-linejoin="round"
                          fill="${isLiked ? 'currentColor' : 'none'}"/>
                </svg>
                <span class="like-count">${post.likes || 0}</span>
            </button>
        </div>
    `;
    
    // Добавляем обработчик лайка
    const likeBtn = card.querySelector('.like-btn');
    likeBtn.addEventListener('click', () => toggleLike(post.id, likeBtn));
    
    // Загружаем статус лайка и количество асинхронно
    loadPostLikeStatus(post.id, likeBtn);
    
    return card;
}

// Загрузка статуса лайка для поста
async function loadPostLikeStatus(postId, likeBtn) {
    try {
        // Загружаем статус лайка и количество параллельно
        const [isLiked, likeCount] = await Promise.all([
            window.electronAPI.isPostLiked(postId),
            window.electronAPI.getPostLikes(postId)
        ]);
        
        // Обновляем UI
        if (isLiked) {
            likeBtn.classList.add('liked');
        } else {
            likeBtn.classList.remove('liked');
        }
        
        const likeCountElement = likeBtn.querySelector('.like-count');
        likeCountElement.textContent = likeCount;
        
    } catch (error) {
        console.error('Error loading post like status:', error);
    }
}

// Проверка, лайкнул ли пользователь пост
async function isPostLiked(postId) {
    try {
        return await window.electronAPI.isPostLiked(postId);
    } catch (error) {
        console.error('Error checking if post is liked:', error);
        return false;
    }
}

// Переключение лайка
async function toggleLike(postId, likeBtn) {
    const isLiked = await isPostLiked(postId);
    const likeCount = likeBtn.querySelector('.like-count');
    
    try {
        let result;
        if (isLiked) {
            // Убираем лайк
            result = await window.electronAPI.unlikePost(postId);
            likeBtn.classList.remove('liked');
        } else {
            // Добавляем лайк
            result = await window.electronAPI.likePost(postId);
            likeBtn.classList.add('liked');
        }
        
        // Обновляем счетчик лайков из ответа сервера
        if (result && result.likes !== undefined) {
            likeCount.textContent = result.likes;
        }
    } catch (error) {
        console.error('Error toggling like:', error);
        showNotification('Ошибка при обновлении лайка', 'error');
    }
}

// Функции localStorage больше не нужны, используем базу данных

// ===== ADMIN FUNCTIONALITY =====

// Показать форму создания поста
function showCreatePostForm() {
    const form = document.getElementById('createPostForm');
    if (form) {
        form.style.display = 'flex';
        document.getElementById('postText').focus();
    }
}

// Скрыть форму создания поста
function hideCreatePostForm() {
    const form = document.getElementById('createPostForm');
    if (form) {
        form.style.display = 'none';
        // Очищаем форму
        document.getElementById('postForm').reset();
    }
}

// Отправка поста
async function submitPost(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const text = formData.get('text').trim();
    const imageUrl = formData.get('imageUrl').trim();
    
    if (!text) {
        showNotification('Введите текст поста', 'error');
        return;
    }
    
    try {
        const result = await window.electronAPI.createPost({
            text: text,
            imageUrl: imageUrl || null
        });
        
        if (result.success) {
            showNotification('Пост успешно создан!', 'success');
            hideCreatePostForm();
            // Перезагружаем посты
            loadUpdates();
        }
    } catch (error) {
        console.error('Error creating post:', error);
        showNotification('Ошибка при создании поста: ' + error.message, 'error');
    }
}

// Проверка прав администратора и показ кнопки создания поста
async function checkAdminRights() {
    try {
        const isAdmin = await window.electronAPI.isAdmin();
        const createPostBtn = document.getElementById('createPostBtn');
        
        if (createPostBtn) {
            createPostBtn.style.display = isAdmin ? 'flex' : 'none';
        }
    } catch (error) {
        console.error('Error checking admin rights:', error);
    }
}

// ===== SETTINGS PAGE FUNCTIONALITY =====

// Показать страницу настроек
function showSettingsPage(user) {
    console.log('showSettingsPage called with user:', user);
    
    // Используем централизованную навигацию
    showPage('settingsPage');
    
    // Инициализируем настройки
    initializeSettingsPage(user);
}

// Инициализация страницы настроек
function initializeSettingsPage(user) {
    console.log('Initializing settings page for user:', user);
    
    // Заполняем текущие данные
    document.getElementById('settingsNicknameInput').value = user.displayName || '';
    document.getElementById('settingsAboutInput').value = user.about || '';
    
    // Устанавливаем аватар
    const avatarPreview = document.getElementById('settingsAvatarPreview');
    if (user.avatarBytes && user.avatarBytes.length > 0) {
        try {
            const avatarUrl = bytesToObjectURL(user.avatarBytes, user.avatarMime || 'image/png');
            avatarPreview.src = avatarUrl;
    } catch (err) {
            console.error('Error creating avatar URL for settings:', err);
            avatarPreview.src = 'images/default-avatar.png';
        }
    } else {
        avatarPreview.src = 'images/default-avatar.png';
    }
    
    // Устанавливаем баннер
    const bannerPreview = document.getElementById('settingsBannerPreview');
    if (user.bannerBytes && user.bannerBytes.length > 0) {
        try {
            const bannerUrl = bytesToObjectURL(user.bannerBytes, user.bannerMime || 'image/png');
            bannerPreview.style.backgroundImage = `url(${bannerUrl})`;
        } catch (err) {
            console.error('Error creating banner URL for settings:', err);
            bannerPreview.style.backgroundImage = '';
        }
    } else {
        bannerPreview.style.backgroundImage = '';
    }
    
    // Добавляем обработчики событий
    setupSettingsEventHandlers();
}

// Настройка обработчиков событий для страницы настроек
function setupSettingsEventHandlers() {
    // Кнопка "Назад"
    document.getElementById('settingsBackBtn')?.addEventListener('click', () => {
        // Возвращаемся к профилю
        const currentUser = getCurrentUser();
        if (currentUser) {
            showProfilePage(currentUser);
        }
    });
    
    // Аватар
    document.getElementById('settingsAvatarBtn')?.addEventListener('click', () => {
        document.getElementById('settingsAvatarUpload').click();
    });
    
    document.getElementById('settingsAvatarUpload')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

        try {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);

            // Показываем превью
    const localUrl = bytesToObjectURL(bytes, file.type);
            document.getElementById('settingsAvatarPreview').src = localUrl;

            // Сохраняем
      await window.electronAPI.updateUserAvatar({ bytes, mime: file.type || 'image/png' });
      showNotification('Аватар обновлён!');
            
            // Обновляем аватар в профиле
            const profileAvatar = document.getElementById('profileAvatar');
            if (profileAvatar) {
                profileAvatar.src = localUrl;
            }
            
            // Обновляем аватар в навбаре
            const navbarAvatar = document.getElementById('userAvatar').querySelector('img');
            if (navbarAvatar) {
                navbarAvatar.src = localUrl;
            }
            
    } catch (err) {
            console.error('Error updating avatar:', err);
      showNotification('Ошибка при сохранении аватара', 'error');
    }
  });

    // Баннер
    document.getElementById('settingsBannerBtn')?.addEventListener('click', () => {
        document.getElementById('settingsBannerUpload').click();
    });
    
    document.getElementById('settingsBannerUpload')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        try {
            const buf = await file.arrayBuffer();
            const bytes = new Uint8Array(buf);
            
            // Показываем превью
            const localUrl = bytesToObjectURL(bytes, file.type);
            document.getElementById('settingsBannerPreview').style.backgroundImage = `url(${localUrl})`;
            
            // Сохраняем
            await window.electronAPI.updateUserBanner({ bytes, mime: file.type || 'image/png' });
            showNotification('Баннер обновлён!');
            
            // Обновляем баннер в профиле
            const profileBanner = document.querySelector('#profile-page .profile-header');
            if (profileBanner) {
                profileBanner.style.backgroundImage = `url(${localUrl})`;
            }
            
      } catch (err) {
            console.error('Error updating banner:', err);
            showNotification('Ошибка при сохранении баннера', 'error');
        }
    });
    
    // Никнейм
    document.getElementById('settingsNicknameSave')?.addEventListener('click', async () => {
        const newName = document.getElementById('settingsNicknameInput').value.trim();
        if (!newName) {
            showNotification('Введите имя', 'error');
            return;
        }
        
        try {
            await window.electronAPI.updateUserName({ displayName: newName });
            showNotification('Имя обновлено!');
            
            // Обновляем имя в профиле
            const profileName = document.getElementById('profile-name');
            if (profileName) {
                profileName.textContent = newName;
            }
            
            // Обновляем текущего пользователя
            const currentUser = getCurrentUser();
            if (currentUser) {
                currentUser.displayName = newName;
            }
            
        } catch (err) {
            console.error('Error updating name:', err);
            showNotification('Ошибка при сохранении имени', 'error');
        }
    });
    
    // О себе
    document.getElementById('settingsAboutSave')?.addEventListener('click', async () => {
        const newAbout = document.getElementById('settingsAboutInput').value.trim();
        
    try {
      await window.electronAPI.updateUserAbout({ about: newAbout });
            showNotification('Информация "О себе" обновлена!');
            
            // Обновляем информацию в профиле
            const aboutSpan = document.getElementById('aboutSpan');
            if (aboutSpan) {
                aboutSpan.textContent = newAbout || 'Пользователь пока не добавил описание';
                aboutSpan.style.fontStyle = newAbout ? 'normal' : 'italic';
                aboutSpan.style.color = newAbout ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)';
            }
            
            // Обновляем текущего пользователя
            const currentUser = getCurrentUser();
            if (currentUser) {
                currentUser.about = newAbout;
            }
            
        } catch (err) {
            console.error('Error updating about:', err);
            showNotification('Ошибка при сохранении информации', 'error');
        }
    });
    
    // Социальные сети (пока заглушки)
    document.getElementById('settingsDiscordSave')?.addEventListener('click', () => {
        showNotification('Функция Discord будет добавлена позже', 'info');
    });
    
    document.getElementById('settingsTelegramSave')?.addEventListener('click', () => {
        showNotification('Функция Telegram будет добавлена позже', 'info');
    });
}

// Настройка обработчиков событий для страницы обновлений
function setupUpdatesEventHandlers() {
    // Кнопка "Назад"
    document.getElementById('updatesBackBtn')?.addEventListener('click', () => {
        // Возвращаемся к главной странице
        showMainPage();
    });
    
    // Кнопка обновления
    document.getElementById('refreshUpdatesBtn')?.addEventListener('click', () => {
        loadUpdates();
    });
}

// Функция для обновления UI после входа
function updateUIAfterLogin(userData) {
    currentUser = userData;
    const authButtons = document.getElementById('authButtons');
    if (authButtons) authButtons.style.display = 'none';
    
    const userProfile = document.getElementById('userProfile');
    if (userProfile) userProfile.style.display = 'flex';
    
    // Обновляем аватар
    const avatarElement = document.getElementById('userAvatar').querySelector('img');
    if (avatarElement) {
        if (userData.avatarBytes && userData.avatarBytes.length > 0) {
            const avatarUrl = bytesToObjectURL(userData.avatarBytes, userData.avatarMime || 'image/png');
        avatarElement.src = avatarUrl;
        } else {
            avatarElement.src = 'images/default-avatar.png';
        }
        avatarElement.onerror = () => {
            avatarElement.src = 'images/default-avatar.png';
        };
    }

    // Обновляем имя пользователя
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        userNameElement.textContent = userData.displayName || userData.username || 'Пользователь';
    }

    
    // Показываем уведомление
    if (userData.displayName || userData.username) {
        showLoginNotification(userData.displayName || userData.username);
    }
}

async function handleReleaseClick(releaseId) {
  try {
    // Логируем полученные данные
    console.log('Загрузка данных релиза ID:', releaseId);
    currentRelease = await window.electronAPI.getReleaseDetails(releaseId);
    
    // Логируем полученные данные
    console.log('Данные релиза:', currentRelease);
    
    if (!currentRelease) {
      throw new Error('Данные релиза не получены');
    }
    
    // Нормализация данных релиза
    const normalizedRelease = {
      id: currentRelease.id,
      title: currentRelease.title || currentRelease.release_title || 'Без названия',
      artist_name: currentRelease.artist_name || currentRelease.artist_names || 'Исполнитель не указан',
      artist_names: currentRelease.artist_names, // Сохраняем для множественных артистов
      artist_ids: currentRelease.artist_ids,     // Сохраняем для множественных артистов
      release_date: currentRelease.release_date || currentRelease.add_date,
      type: currentRelease.type,
      image: currentRelease.image,
      host_rating: currentRelease.host_rating || currentRelease.average_rating || 0,
      average_user_rating: currentRelease.average_user_rating, // Добавляем средний пользовательский рейтинг
      textValue: currentRelease.textValue || currentRelease.text_rating || 0,
      structureValue: currentRelease.structureValue || currentRelease.structure_rating || 0,
      soundValue: currentRelease.soundValue || currentRelease.sound_rating || 0,
      voiceValue: currentRelease.voiceValue || currentRelease.voice_rating || 0,
      individualityValue: currentRelease.individualityValue || currentRelease.individuality_rating || 0,
      atmosphereValue: currentRelease.atmosphereValue || currentRelease.atmosphere_rating || 0
    };
    
    showReleasePage();
    renderReleasePage(normalizedRelease);
  } catch (err) {
    console.error('Ошибка загрузки:', err);
    showNotification('Не удалось загрузить данные релиза', 'error');
  }
}


// Обновите функцию showReleasePage
function showReleasePage() {
    // Скрываем все элементы главной страницы
    const mainPageContent = document.getElementById('mainPageContent');
    const searchContainer = document.getElementById('searchContainer');
    const favoritesContainer = document.getElementById('favoritesContainer');
    const releasePage = document.getElementById('releasePage');
    const allReleasePage = document.getElementById('allReleasesPage');

    // Проверяем существование элементов перед их изменением
    if (mainPageContent) mainPageContent.style.display = 'none';
    if (searchContainer) searchContainer.style.display = 'none';
    if (favoritesContainer) favoritesContainer.style.display = 'none';
    if (allReleasePage) allReleasePage.style.display = 'none';

    // Снимаем активные классы с кнопок
    document.querySelectorAll('.icon-btn[data-page]').forEach(b => b.classList.remove('active'));

    // Показываем страницу релиза
    if (releasePage) releasePage.style.display = 'block';
}

function hideReleasePage() {
    const releasePage = document.getElementById('releasePage');
    const mainPageContent = document.getElementById('mainPageContent');

    // Отменяем текущую загрузку
    if (lyricsAbortController) {
        lyricsAbortController.abort();
        lyricsAbortController = null;
    }

    if (releasePage) releasePage.style.display = 'none';
    if (mainPageContent) mainPageContent.style.display = 'block';
}

let lyricsAbortController = null;

function renderReleasePage(release) {
  const coverArt = document.querySelector('.release-cover-arts');
  const artistElement = document.querySelector('.release-artistss');
  const dateElement = document.querySelector('.release-dates');
  const typeBadge = document.querySelector('.release-type-badges');
  const titleElement = document.querySelector('.release-page-titles');

  // Установка обложки
  if (coverArt) {
    try {
      if (release.image) {
        const blob = new Blob([release.image], { type: 'image/jpeg' });
        const imageUrl = URL.createObjectURL(blob);
        coverArt.src = imageUrl;
      } else {
        coverArt.src = 'images/default-avatar.png';
      }
    } catch (err) {
      console.error('Ошибка при загрузке обложки:', err);
      coverArt.src = 'images/default-avatar.png';
    }
  }

  // Установка остальных данных
  if (artistElement) {
    if (release.artist_names && release.artist_ids) {
      createArtistLinks(release.artist_names, release.artist_ids, artistElement);
    } else {
      // Fallback для старого формата
      artistElement.textContent = release.artist_name || 'Исполнитель не указан';
    }
  }

  if (dateElement) {
    const date = new Date(release.release_date);
    dateElement.textContent = !isNaN(date) ? date.toLocaleDateString('ru-RU') : 'Дата не указана';
  }

  if (typeBadge) {
    typeBadge.textContent = release.type || '';
  }

  if (titleElement) {
    titleElement.textContent = release.title || 'Без названия';
  }

  // Показываем нужную страницу
  document.querySelectorAll('.hidden-page').forEach(el => el.style.display = 'none');
  document.getElementById('releasePage').style.display = 'block';

  // Рейтинги
  renderRatings('expertRatings', [
    { label: 'Текст', value: release.textValue },
    { label: 'Структура', value: release.structureValue },
    { label: 'Звук', value: release.soundValue },
    { label: 'Вокал', value: release.voiceValue }
  ], 'expert');

  renderRatings('communityRatings', [
    { label: 'Индивидуальность', value: release.individualityValue },
    { label: 'Атмосфера', value: release.atmosphereValue }
  ], 'community');
  
  // Инициализация кнопки избранного
  initFavoriteButton(release.id);

  // Общий рейтинг
  const overallRating = document.querySelector('.ratings-value');
  const hostNum = Number(release.host_rating);
  overallRating.textContent = Number.isFinite(hostNum) ? hostNum.toFixed(1).replace(/\.0$/, '') : '-';

  // Пользовательский рейтинг (turquoise circle)
  const userOverallRating = document.getElementById('userOverallRating');
  if (userOverallRating) {
    const userNum = Number.parseFloat(release.average_user_rating);
    console.log('User rating data:', { 
      raw: release.average_user_rating, 
      parsed: userNum, 
      isFinite: Number.isFinite(userNum) 
    });
    userOverallRating.textContent = Number.isFinite(userNum) ? userNum.toFixed(1).replace(/\.0$/, '') : '-';
  }

  // Показать средний пользовательский рейтинг (если есть контейнер)
  const avgUserRatingEl = document.getElementById('avgUserRating');
  if (avgUserRatingEl) {
    const avgNum = Number.parseFloat(release.average_user_rating);
    avgUserRatingEl.textContent = Number.isFinite(avgNum) ? avgNum.toFixed(1) : '-';
    
    // Обновляем прогресс-бар для средней оценки
    const progressBar = avgUserRatingEl.parentElement.nextElementSibling.querySelector('.rating-progress');
    if (progressBar && Number.isFinite(avgNum)) {
      const percent = (avgNum / 10) * 100;
      progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    }
  }

  // Загружаем и отображаем оценки пользователей
  const userRatingsList = document.getElementById('userRatingsList');
  if (userRatingsList) {
    userRatingsList.innerHTML = '';
    window.electronAPI.getReleaseUserRatings(release.id)
      .then(async rows => {
        if (!rows || rows.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'user-ratings-empty';
          empty.innerHTML = `
            <div class="user-ratings-empty-icon">👥</div>
            <p>Пока нет оценок пользователей</p>
            <p>Будьте первым, кто оценит этот релиз!</p>
          `;
          userRatingsList.appendChild(empty);
          return;
        }
        // Сортируем по дате оценки (новые сначала)
        rows.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        
        // Создаем карточки пользователей асинхронно
        for (const rating of rows) {
          const userCard = await createUserRatingCard(rating);
          userRatingsList.appendChild(userCard);
        }
      })
      .catch((error) => {
        console.error('Ошибка загрузки оценок пользователей:', error);
        const err = document.createElement('div');
        err.className = 'user-ratings-empty';
        err.innerHTML = `
          <div class="user-ratings-empty-icon">⚠️</div>
          <p>Ошибка загрузки оценок</p>
        `;
        userRatingsList.appendChild(err);
      });
  }
}

// Создание красивой карточки пользователя с оценками
async function createUserRatingCard(rating) {
  const card = document.createElement('div');
  card.className = 'user-rating-card';
  
  // Получаем данные пользователя
  const displayName = rating.display_name || 'Анонимный пользователь';
  
  // Создаем HTML для карточки
  card.innerHTML = `
    <div class="user-banner-section">
      <div class="user-banner-gradient"></div>
      <div class="user-avatar-overlay">
        <img src="images/default-avatar.png" class="user-avatar" alt="Аватар пользователя">
        <h3 class="user-nickname user-profile-link" data-user-id="${rating.user_id}">${displayName}</h3>
      </div>
    </div>
    <div class="user-ratings-section">
      <div class="user-ratings-display">
        ${createRatingParameters(rating)}
      </div>
      <div class="user-overall-rating">
        <span class="overall-rating-label">Общая оценка</span>
        <span class="overall-rating-value">${renderRating(rating.score)}</span>
      </div>
    </div>
  `;
  
  // Загружаем аватар и баннер пользователя
  try {
    const userData = await window.electronAPI.getUserById(rating.user_id);
    if (userData) {
      const avatarElement = card.querySelector('.user-avatar');
      const bannerSection = card.querySelector('.user-banner-section');
      
      // Устанавливаем аватар
      if (userData.avatarBytes && userData.avatarBytes.length > 0) {
        try {
          const avatarUrl = bytesToObjectURL(userData.avatarBytes, userData.avatarMime || 'image/png');
          avatarElement.src = avatarUrl;
          avatarElement.onerror = () => {
            avatarElement.src = 'images/default-avatar.png';
          };
        } catch (err) {
          console.error('Error creating avatar URL for user', rating.user_id, ':', err);
          avatarElement.src = 'images/default-avatar.png';
        }
      }
      
      // Устанавливаем баннер
      if (userData.bannerBytes && userData.bannerBytes.length > 0) {
        try {
          const bannerUrl = bytesToObjectURL(userData.bannerBytes, userData.bannerMime || 'image/png');
          const bannerGradient = card.querySelector('.user-banner-gradient');
          bannerGradient.style.backgroundImage = `url(${bannerUrl})`;
        } catch (err) {
          console.error('Error creating banner URL for user', rating.user_id, ':', err);
        }
      }
    }
  } catch (error) {
    console.error('Error loading user data for rating card:', error);
  }
  
  // Добавляем обработчик клика для перехода к профилю пользователя
  const userNameElement = card.querySelector('.user-profile-link');
  userNameElement.addEventListener('click', (e) => {
    e.stopPropagation();
    showUserProfilePage(rating.user_id);
  });
  
  // Добавляем стили для указания, что это кликабельная ссылка
  userNameElement.style.cursor = 'pointer';
  userNameElement.title = 'Перейти к профилю пользователя';
  
  return card;
}

// Создание параметров оценки
function createRatingParameters(rating) {
  const parameters = [
    { label: 'Текст', value: rating.textValue },
    { label: 'Структура', value: rating.structureValue },
    { label: 'Звук', value: rating.soundValue },
    { label: 'Вокал', value: rating.voiceValue },
    { label: 'Индивидуальность', value: rating.individualityValue },
    { label: 'Атмосфера', value: rating.atmosphereValue }
  ];
  
  return parameters.map(param => {
    let value = '-';
    if (param.value !== null && param.value !== undefined && !isNaN(param.value)) {
      value = Number(param.value).toFixed(1);
    }
    return `
      <div class="rating-parameter">
        <span class="rating-parameter-label">${param.label}</span>
        <span class="rating-parameter-value">${value}</span>
      </div>
    `;
  }).join('');
}

function arrayBufferToBase64(buffer) {
  try {
    if (!buffer) return '';
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  } catch (error) {
    console.error('Ошибка конвертации изображения в base64:', error);
    return '';
  }
}

function renderRatings(containerId, ratings, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = ratings.map(rating => {
        const valueNum = Number(rating.value);
        const safePercent = Number.isFinite(valueNum) ? Math.max(0, Math.min(100, (valueNum / 10) * 100)) : 0;
        return `
        <div class="rating-item ${type}">
            <div class="rating-header">
                <span class="rating-label">${rating.label}</span>
                <span class="rating-value">${renderRating(rating.value)}</span>
            </div>
            <div class="rating-bar">
                <div class="rating-progress" style="width: ${safePercent}%"></div>
            </div>
        </div>`;
    }).join('');
}

function showError(context, message) {
    // Удаляем предыдущие ошибки
    document.querySelectorAll('.error-message').forEach(el => el.remove());
    
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    errorElement.style.color = '#ef4444';
    errorElement.style.margin = '10px 0';
    errorElement.style.textAlign = 'center';
    
    if (context === 'email') {
        const emailGroup = document.getElementById('email').closest('.form-group');
        emailGroup.appendChild(errorElement);
    } else if (context === 'confirmation') {
        const form = document.getElementById('confirmationForm');
        if (form.firstChild) {
            form.insertBefore(errorElement, form.firstChild);
        } else {
            form.appendChild(errorElement);
        }
    }
}

let ratingSelectedMonth = new Date().getMonth();
let ratingSelectedYear = new Date().getFullYear();

let recentSelectedMonth = null;
let recentSelectedYear = null;

let monthItems;
let currentYearElement;
let dateModal;

function updateDateModal() {
  currentYearElement.textContent = ratingSelectedYear;
  monthItems.forEach(item => {
    item.classList.remove('selected');
    if (parseInt(item.dataset.month) === ratingSelectedMonth) {
      item.classList.add('selected');
    }
  });
}

function updateMonthHeader() {
  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                     'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  document.getElementById('monthDisplay').textContent = 
    `${monthNames[ratingSelectedMonth]} ${ratingSelectedYear}`;
}

// Флаг для предотвращения повторных вызовов
let isLoadingReleases = false;

async function showAllReleasesPage() {
  // Предотвращаем повторные вызовы
  if (isLoadingReleases) {
    console.log('Загрузка релизов уже выполняется, пропускаем повторный вызов');
    return;
  }
  
  try {
    isLoadingReleases = true;
    
  document.getElementById('mainPageContent').style.display = 'none';
  document.getElementById('releasePage').style.display = 'none';
  document.getElementById('artistPage').style.display = 'none';
  document.getElementById('favoritesContainer').style.display = 'none';
  document.getElementById('rateReleasePage').style.display = 'none';
  document.getElementById('profile-page').style.display = 'none';
  document.getElementById('allReleasesPage').style.display = 'block';

    // Показываем индикатор загрузки
    const loadingElement = document.getElementById('allReleasesLoading');
    const containerElement = document.getElementById('allReleasesContainer');
    
    if (loadingElement) {
      loadingElement.style.display = 'flex';
      loadingElement.style.justifyContent = 'center';
      loadingElement.style.alignItems = 'center';
    }
    if (containerElement) containerElement.style.display = 'none';

    console.log('Загрузка релизов...');
    console.log('Проверяем доступность electronAPI:', !!window.electronAPI);
    console.log('Проверяем доступность getAllReleases:', !!window.electronAPI?.getAllReleases);
    
    console.log('Вызываем window.electronAPI.getAllReleases()...');
    const allReleases = await window.electronAPI.getAllReleases();
    console.log('Получено релизов:', allReleases.length);
    
    window.allReleasesCache = allReleases; // сохраним для фильтрации
    applyFilters();
    
    // Скрываем индикатор загрузки
    if (loadingElement) loadingElement.style.display = 'none';
    if (containerElement) containerElement.style.display = 'block';
  } catch (err) {
    console.error('=== ОШИБКА В showAllReleasesPage ===');
    console.error('Ошибка загрузки всех релизов:', err);
    console.error('Тип ошибки:', typeof err);
    console.error('Сообщение ошибки:', err.message);
    console.error('Stack trace:', err.stack);
    console.error('error loading releases');
    
    const loadingElement = document.getElementById('allReleasesLoading');
    const containerElement = document.getElementById('allReleasesContainer');
    // Центрируем индикатор загрузки при ошибке

    if (loadingElement) loadingElement.style.display = 'none';
    if (containerElement) {
      containerElement.style.display = 'flex';
      containerElement.innerHTML = '<p style="color: #ff6b6b; text-align: center; justify-content: center; align-items: center;">Ошибка загрузки релизов. Попробуйте обновить страницу.</p>';
    }
  } finally {
    isLoadingReleases = false;
  }
}

function applyFilters() {
  loadFilteredReleasesPage(1);
}

function loadFilteredReleasesPage(page = 1) {
  try {
    if (!window.allReleasesCache) {
      console.warn('Кэш релизов пуст');
      return;
    }

    const yearVal = document.getElementById('filterYear')?.value;
    const monthVal = document.getElementById('filterMonth')?.value;
    const typeVal = document.getElementById('filterType')?.value;
    const ratingMinInput = document.getElementById('filterRatingMin');
    const ratingMaxInput = document.getElementById('filterRatingMax');
    const ratingMinRange = document.getElementById('ratingMinRange');
    const ratingMaxRange = document.getElementById('ratingMaxRange');
    const ratingProgress = document.getElementById('ratingRangeProgress');

    const ratingMinVal = ratingMinInput?.value ?? '';
    const ratingMaxVal = ratingMaxInput?.value ?? '';

  let filtered = [...window.allReleasesCache];
    if (yearVal !== "") filtered = filtered.filter(r => new Date(r.add_date).getFullYear() === Number(yearVal));
  if (monthVal !== "") filtered = filtered.filter(r => new Date(r.add_date).getMonth() === Number(monthVal));
  if (typeVal) filtered = filtered.filter(r => r.type === typeVal);
    if (ratingMinVal !== "") filtered = filtered.filter(r => (Number(r.host_rating) || 0) >= Number(ratingMinVal));
    if (ratingMaxVal !== "") filtered = filtered.filter(r => (Number(r.host_rating) || 0) <= Number(ratingMaxVal));

  const pageSize = 10;
  totalPages = Math.ceil(filtered.length / pageSize);
  currentPage = page;
  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize);

  renderReleasesList(pageData, 'allReleasesContainer');
  renderPagination(totalPages, currentPage);
  } catch (error) {
    console.error('Ошибка в loadFilteredReleasesPage:', error);
    const container = document.getElementById('allReleasesContainer');
    if (container) {
      container.innerHTML = '<p style="color: #ff6b6b; text-align: center;">Ошибка фильтрации релизов</p>';
    }
  }
} 


function renderRecentReleases(limit = 10) {
  if (!cachedReleases) {
    console.log('renderRecentReleases: кэш пуст');
    return;
  }

  console.log(`renderRecentReleases: обрабатываем ${cachedReleases.length} релизов`);

  // Если установлен month/year для recent — фильтруем по ним,
  // иначе просто берем последние по дате
  let list = [...cachedReleases];

  if (recentSelectedMonth !== null && recentSelectedYear !== null) {
    list = list.filter(r => {
      const d = new Date(r.add_date);
      return d.getMonth() === recentSelectedMonth && d.getFullYear() === recentSelectedYear;
    });
    console.log(`renderRecentReleases: после фильтрации по месяцу ${recentSelectedMonth}/${recentSelectedYear}: ${list.length} релизов`);
  }

  // Сортируем по add_date (сначала новые)
  list.sort((a, b) => new Date(b.add_date) - new Date(a.add_date));

  const recent = list.slice(0, limit);
  console.log(`renderRecentReleases: отображаем ${recent.length} последних релизов`);

  // 'releasesContainer' — это контейнер, который у тебя сейчас используется для "недавно добавленных".
  renderReleases(recent, 'releasesContainer');
}

function renderPagination(totalPages, currentPage) {
  try {
  const container = document.getElementById('paginationContainer');
    if (!container) {
      console.warn('Контейнер пагинации не найден');
      return;
    }
    
  container.innerHTML = '';

  // Кнопка "Назад"
  if (currentPage > 1) {
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Назад';
    prevBtn.onclick = () => loadFilteredReleasesPage(currentPage - 1);
    container.appendChild(prevBtn);
  }

  // Номера страниц
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 2) {
      const btn = document.createElement('button');
      btn.textContent = i;
      btn.disabled = i === currentPage;
      btn.onclick = () => loadFilteredReleasesPage(i);
      container.appendChild(btn);
    } else if (i === 2 && currentPage > 4) {
      container.appendChild(document.createTextNode('…'));
    } else if (i === totalPages - 1 && currentPage < totalPages - 3) {
      container.appendChild(document.createTextNode('…'));
    }
  }

  // Кнопка "Вперёд"
  if (currentPage < totalPages) {
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Вперёд →';
    nextBtn.onclick = () => loadFilteredReleasesPage(currentPage + 1);
    container.appendChild(nextBtn);
    }
  } catch (error) {
    console.error('Ошибка в renderPagination:', error);
  }
}

function renderReleasesList(releases, containerId) {
  try {
  const container = document.getElementById(containerId);
    if (!container) {
      console.error('Контейнер не найден:', containerId);
      return;
    }
    
  container.innerHTML = '';

  if (!releases || releases.length === 0) {
    container.innerHTML = '<p style="color: #bbb; text-align: center;">Нет релизов</p>';
    return;
  }

    releases.forEach((release, index) => {
      try {
    const card = document.createElement('div');
        card.className = 'rating-card'; // Используем стиль как в рейтинге за месяц

    const base64Image = release.image 
      ? `data:image/jpeg;base64,${arrayBufferToBase64(release.image)}`
      : 'images/default-cover.png';

    card.innerHTML = `
            <div class="rating-image-container">
                <img src="${base64Image}" class="rating-image" alt="cover">
            </div>
            <div class="rating-info">
                <div class="rating-text">
                    <p class="rating-title" title="${release.title || 'Без названия'}">${release.title || 'Без названия'}</p>
                    <div class="rating-artist" title="${release.artist_names || release.artist_name || 'Исполнитель не указан'}"></div>
                </div>
            </div>
            <div class="rating-score-container">
                    <div class="rating" aria-label="Оценка автора ${release.host_rating || '—'}">
                    <span class="dot" aria-hidden="true"></span>
                    ${renderRating(release.host_rating)}
                </div>
                    <div class="rating" aria-label="Средняя оценка пользователей ${release.average_user_rating || '—'}">
                        <span class="dot turquoise-dot" aria-hidden="true"></span>
                        ${renderRating(release.average_user_rating)}
                    </div>
            </div>
        `;

    // Создаем кликабельные ссылки артистов
    const artistContainer = card.querySelector('.rating-artist');
    if (release.artist_names && release.artist_ids) {
      createArtistLinks(release.artist_names, release.artist_ids, artistContainer);
    } else {
      artistContainer.textContent = release.artist_name || 'Исполнитель не указан';
    }

    // открытие модального окна, как в самом первом варианте
    card.addEventListener('click', (e) => {
      // Не открываем релиз, если кликнули по артисту
      if (!e.target.closest('.artist-link')) {
        handleReleaseClick(release.id);
      }
    });

    container.appendChild(card);
      } catch (error) {
        console.error(`Ошибка при создании карточки релиза ${index}:`, error);
        console.error('Данные релиза:', release);
      }
    });
  } catch (error) {
    console.error('Ошибка в renderReleasesList:', error);
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '<p style="color: #ff6b6b; text-align: center;">Ошибка загрузки релизов</p>';
    }
  }
}


// Обработчик успешной регистрации
async function handleSuccessfulRegistration() {
  // Показываем анимацию успеха
  const successModal = document.getElementById('successModal');
  successModal.classList.add('show');
  
  // Ждём завершения анимации (3 секунды)
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Закрываем все модальные окна
  document.getElementById('successModal').classList.remove('show');
  document.getElementById('emailConfirmationModal').classList.remove('show');
  document.getElementById('registrationModal').classList.remove('show');
  
  // Показываем окно входа`
  document.getElementById('loginModal').classList.add('show');
}

// Обработчик формы входа
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const result = await window.electronAPI.loginUser({
            email: document.getElementById('loginEmail').value,
            password: document.getElementById('loginPassword').value
        });
        
        if (result.success) {
            // Сохраняем токен через новый метод
            await window.electronAPI.saveToken(result.token);
            
            document.getElementById('loginModal').classList.remove('show');
            updateUIAfterLogin(result.user);
            document.getElementById('loginForm').reset();
        }
    } catch (err) {
        showNotification(err.message, 'error');
    }
});

// Обработчик для аватарки (открытие dropdown)
document.getElementById('userAvatar')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = document.getElementById('userDropdown');
    dropdown.classList.toggle('show');
});

// Обработчик для выхода
document.getElementById('logoutBtn').addEventListener('click', async () => {
  try {
    await window.electronAPI.logoutUser();
    document.getElementById('authButtons').style.display = 'block';
    document.getElementById('userProfile').style.display = 'none';
    showNotification('Вы успешно вышли из системы');
  } catch (err) {
    showNotification('Ошибка при выходе из системы', 'error');
  }
});

// Закрытие dropdown при клике вне его
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown && !e.target.closest('.user-profile')) {
        dropdown.classList.remove('show');
    }
});

// Обновим обработчик подтверждения регистрации
document.getElementById('confirmationForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const enteredCode = Array.from(document.querySelectorAll('.code-input'))
    .map(input => input.value)
    .join('');
  
  try {
    // Проверяем код
    await window.electronAPI.verifyConfirmationCode({
      email: registrationData.email,
      code: enteredCode
    });
    
    // Регистрируем пользователя
    const result = await window.electronAPI.registerUser(registrationData);
    
    // Показываем анимацию успеха
    await handleSuccessfulRegistration();
    
    // Очищаем форму
    document.getElementById('registrationForm').reset();
    
  } catch (error) {
    console.error('Ошибка подтверждения:', error);
    showError('confirmation', error.message);
  }
});

function renderRatingReleases(releases) { 
    const tracksContainer = document.getElementById('ratingTracks');
    const albumsContainer = document.getElementById('ratingAlbums');

    tracksContainer.innerHTML = '';
    albumsContainer.innerHTML = '';

    console.log(`Рендеринг рейтинга: всего релизов ${releases.length}`);
    console.log('Все релизы:', releases.map(r => ({ title: r.title, type: r.type, rating: r.host_rating })));

    // Разделяем на треки и альбомы
    const tracks = releases
        .filter(r => r.type === 'Сингл')
        .sort((a, b) => (b.host_rating || 0) - (a.host_rating || 0))
        .slice(0, 5);

    const albums = releases
        .filter(r => r.type === 'Альбом')
        .sort((a, b) => (b.host_rating || 0) - (a.host_rating || 0))
        .slice(0, 5);

    console.log(`Найдено треков: ${tracks.length}, альбомов: ${albums.length}`);
    console.log('Альбомы:', albums.map(a => ({ title: a.title, rating: a.host_rating })));

    // Функция для создания карточки
    const createCard = (release, isTop = false, position = null, placeClass = '') => {
        const card = document.createElement('div');
        card.className = 'rating-card' + (isTop ? ' top ' + placeClass : '');

        const imageUrl = release.image ? bufferToImage(release.image) : null;

        // бейдж места
        let badge = '';
        if (position === 1) badge = '<div class="rating-badge gold">1</div>';
        if (position === 2) badge = '<div class="rating-badge silver">2</div>';
        if (position === 3) badge = '<div class="rating-badge bronze">3</div>';

        let image = 'rating-image';
        if ([1, 2, 3].includes(position)) image = 'rating-image-top';

        card.innerHTML = `
            <div class="rating-image-container">
                ${badge}
                ${imageUrl ? `<img src="${imageUrl}" class="${image}" alt="cover">` : 
                '<div class="rating-image" style="background: #1f1f1f;"></div>'}
            </div>
            <div class="rating-info">
                <div class="rating-text">
                    <p class="rating-title" title="${release.title || 'Без названия'}">${release.title || 'Без названия'}</p>
                    <div class="rating-artist" title="${release.artist_names || release.artist_name || 'Исполнитель не указан'}"></div>
                </div>
            </div>
            <div class="rating-score-container">
                <div class="rating" aria-label="Оценка автора ${release.host_rating || '—'}">
                    <span class="dot" aria-hidden="true"></span>
                    ${renderRating(release.host_rating)}
                </div>
                <div class="rating" aria-label="Средняя оценка пользователей ${release.average_user_rating || '—'}">
                    <span class="dot turquoise-dot" aria-hidden="true"></span>
                    ${renderRating(release.average_user_rating)}
                </div>
            </div>
        `;
        
        // Отображаем артистов как обычный текст (без кликабельных кнопок)
        const artistContainer = card.querySelector('.rating-artist');
        artistContainer.textContent = release.artist_names || release.artist_name || 'Исполнитель не указан';
        
        card.addEventListener('click', (e) => {
          handleReleaseClick(release.id);
        });
        return card;
    };

    // Функция для информативного плейсхолдера (если вообще нет данных)
    const createInfoPlaceholder = (text) => {
        const placeholder = document.createElement('div');
        placeholder.className = 'rating-placeholder';
        placeholder.style.height = '100%';
        placeholder.style.minHeight = '240px';
        placeholder.style.flexDirection = 'column';
        placeholder.style.justifyContent = 'center';
        placeholder.style.alignItems = 'center';
        placeholder.style.gap = '12px';
        
        placeholder.innerHTML = `
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity: 0.5;">
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 16V12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 8H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <div style="text-align: center;">
                <div style="font-weight: 600; margin-bottom: 4px;">${text}</div>
                <div style="font-size: 13px; opacity: 0.7;">Попробуйте проверить позже</div>
            </div>
        `;
        
        return placeholder;
    };

    // Универсальная функция рендера (треки / альбомы)
    const renderSection = (items, container, emptyText) => {
        if (items.length > 0) {
            const top3Wrapper = document.createElement('div');
            top3Wrapper.className = 'rating-top3';

            const restWrapper = document.createElement('div');
            restWrapper.className = 'rating-rest';

            const top3 = items.slice(0, 3);

            // расстановка [2] [1] [3]
            if (top3[1]) top3Wrapper.appendChild(createCard(top3[1], true, 2, 'second'));
            else top3Wrapper.appendChild(createTopPlaceholder(2));
            
            if (top3[0]) top3Wrapper.appendChild(createCard(top3[0], true, 1, 'first'));
            else top3Wrapper.appendChild(createTopPlaceholder(1));
            
            if (top3[2]) top3Wrapper.appendChild(createCard(top3[2], true, 3, 'third'));
            else top3Wrapper.appendChild(createTopPlaceholder(3));

            // оставшиеся (4–5 место)
            const rest = items.slice(3);
            rest.forEach(r => restWrapper.appendChild(createCard(r)));

            for (let i = rest.length; i < 2; i++) {
                const ph = document.createElement('div');
                ph.className = 'rating-placeholder';
                ph.textContent = 'Нет данных';
                restWrapper.appendChild(ph);
            }

            container.appendChild(top3Wrapper);
            if (restWrapper.children.length > 0) container.appendChild(restWrapper);
        } else {
            container.appendChild(createInfoPlaceholder(emptyText));
        }
    };

    // Плейсхолдер именно для топ-3
    const createTopPlaceholder = (position) => {
        const ph = document.createElement('div');
        ph.className = 'ratings-card top placeholder-card';
        ph.style.margin = '0px';
        ph.innerHTML = `
            <div class="rating-info">
                <div class="rating-text">
                    <p class="rating-title">Нет данных</p>
                </div>
            </div>
        `;
        return ph;
    };

    renderSection(tracks, tracksContainer, 'Треков за этот месяц нет');
    renderSection(albums, albumsContainer, 'Альбомов за этот месяц нет');
}




function formatDate(dateString) {
    if (!dateString) return 'Дата не указана';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
}

function renderRating(rating) {
    const num = Number(rating);
    if (!Number.isFinite(num)) return '-';
    const formatted = Number.isInteger(num)
        ? num.toFixed(0)
        : num.toFixed(1).replace(/\.0$/, '');
    return formatted;
}

// Функция для рендеринга релизов артиста в стиле рейтинга
function renderArtistReleases(releases, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('Контейнер не найден:', containerId);
        return;
    }
    
    container.innerHTML = '';
    
    if (!releases || releases.length === 0) {
        container.innerHTML = '<p style="color: #bbb; text-align: center; grid-column: 1 / -1;">Нет релизов</p>';
        return;
    }
    
    releases.forEach(release => {
        const card = document.createElement('div');
        card.className = 'artist-release-card';
        
        const imageUrl = release.image ? bufferToImage(release.image) : 'images/default-avatar.png';
        
        card.innerHTML = `
            <div class="rating-image-container">
                <img src="${imageUrl}" class="rating-image" alt="Обложка">
            </div>
            <div class="rating-info">
                <div class="rating-text">
                    <p class="rating-title" title="${release.title || 'Без названия'}">${release.title || 'Без названия'}</p>
                    <div class="rating-artist" title="${release.artist_names || release.artist_name || 'Исполнитель не указан'}"></div>
                </div>
            </div>
            <div class="rating-score-container">
                <div class="rating" aria-label="Оценка автора ${release.host_rating || '—'}">
                    <span class="dot" aria-hidden="true"></span>
                    ${renderRating(release.host_rating)}
                </div>
                <div class="rating" aria-label="Средняя оценка пользователей ${release.average_user_rating || '—'}">
                    <span class="dot turquoise-dot" aria-hidden="true"></span>
                    ${renderRating(release.average_user_rating)}
                </div>
            </div>
        `;
        
        // Создаем кликабельные ссылки артистов
        const artistContainer = card.querySelector('.rating-artist');
        if (release.artist_names && release.artist_ids) {
            const artistNames = release.artist_names.split(', ');
            const artistIds = release.artist_ids.split(', ');
            
            artistNames.forEach((name, index) => {
                if (index > 0) artistContainer.appendChild(document.createTextNode(', '));
                const artistLink = document.createElement('span');
                artistLink.textContent = name.trim();
                artistLink.className = 'artist-link';
                artistLink.style.cursor = 'pointer';
                artistLink.style.color = '#4a9eff';
                artistLink.title = 'Перейти к странице артиста';
                artistLink.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleArtistClick(artistIds[index], name.trim());
                });
                artistContainer.appendChild(artistLink);
            });
        } else {
            artistContainer.textContent = release.artist_names || release.artist_name || 'Исполнитель не указан';
        }
        
        // Добавляем обработчик клика для перехода к странице релиза
        card.addEventListener('click', () => {
            handleReleaseClick(release.id);
        });
        
        container.appendChild(card);
    });
}
// 2. Основная функция отрисовки релизов
function renderReleases(releases, containerId = 'releasesContainer') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('Контейнер не найден:', containerId);
        return;
    }
    
    container.innerHTML = '';
    
    releases.forEach(release => {
        const card = document.createElement('div');
        card.className = 'release-card';
        
        const imageUrl = release.image ? bufferToImage(release.image) : null;
        
        card.innerHTML = `
            <div class="release-image-container">
                ${imageUrl ? 
                    `<img src="${imageUrl}" class="release-image" alt="${release.title || 'Release image'}">` : 
                    `<div class="release-image"></div>`
                }
            </div>
            <div class="release-info">
                <div class="text-container">
                    <h3 class="release-title" title="${release.title || 'Без названия'}">
                        ${release.title || 'Без названия'}
                    </h3>
                    <div class="release-artists" title="${release.artist_names || release.artist_name || 'Исполнитель не указан'}"></div>
                    <div class="release-meta">
                        <span class="release-type">${release.type || 'N/A'}</span>
                    </div>
                </div>
                <div class="ratings-container">
                    <div class="release-meta_two">
                        <div class="rating" aria-label="Оценка автора ${release.host_rating || '—'}">
                            <span class="dot" aria-hidden="true"></span>
                            ${renderRating(release.host_rating)}
                        </div>
                        <div class="rating" aria-label="Средняя оценка пользователей ${release.average_user_rating || '—'}">
                            <span class="dot turquoise-dot" aria-hidden="true"></span>
                            ${renderRating(release.average_user_rating)}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Создаем кликабельные ссылки артистов
        const artistContainer = card.querySelector('.release-artists');
        if (release.artist_names && release.artist_ids) {
          createArtistLinks(release.artist_names, release.artist_ids, artistContainer);
        } else {
          artistContainer.textContent = release.artist_name || 'Исполнитель не указан';
        }
        
        // Обработчик клика по карточке релиза
        card.addEventListener('click', (e) => {
          // Не открываем релиз, если кликнули по артисту
          if (!e.target.closest('.artist-link')) {
            handleReleaseClick(release.id);
          }
        });
        
        container.appendChild(card);
        console.log('Release:', release);
    });
}

// 3. Функции загрузки данных
let cachedReleases = null;
window.currentFilters = {};
let currentPage = 1;
const pageSize = 20;
let totalPages = 1;

async function loadReleasesPage(page = 1, filters = {}) {
  try {
    const { releases, total } = await window.electronAPI.getPagedReleases(page, pageSize, filters);

    renderReleasesList(releases, 'allReleasesContainer');

    totalPages = Math.ceil(total / pageSize);
    currentPage = page;

    renderPagination();
  } catch (err) {
    console.error('Ошибка загрузки релизов:', err);
  }
}

function renderFilteredRating() {
  if (!cachedReleases) return;
  
  const filtered = cachedReleases.filter(release => {
    const date = new Date(release.add_date);
    // JavaScript getMonth() возвращает 0-11, поэтому сравниваем напрямую
    return date.getMonth() === ratingSelectedMonth && 
           date.getFullYear() === ratingSelectedYear;
  });
  
  console.log(`Фильтрация рейтинга: месяц ${ratingSelectedMonth}, год ${ratingSelectedYear}`);
  console.log(`Найдено релизов: ${filtered.length}`);
  console.log('Отфильтрованные релизы:', filtered.map(r => ({ 
    title: r.title, 
    type: r.type,             
    month: new Date(r.add_date).getMonth(),
    year: new Date(r.add_date).getFullYear()
  })));
  
  renderRatingReleases(filtered);
}

async function loadReleases(forceReload = false) {
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    
    // // Если данные есть в кэше и не требуется перезагрузка
    // if (cachedReleases && !forceReload) {
    //       renderRecentReleases();   // блок "Недавно добавленные" — не затрагивает рейтинг
    //       renderFilteredRating();   // блок "Топ рейтинга" — использует ratingSelectedMonth
    //     return;
    // }
    
    try {
        loading.style.display = 'block';
        error.style.display = 'none';
        
        console.log('Загрузка релизов...');
        const releases = await window.electronAPI.getAllReleases();
        console.log('Получено релизов:', releases.length);
        
        // Обновляем кэш
        cachedReleases = releases;
        
        console.log('Кэш обновлен. Текущий месяц:', ratingSelectedMonth, 'год:', ratingSelectedYear);
        console.log('Релизы в кэше по месяцам:', releases.reduce((acc, r) => {
          const month = new Date(r.add_date).getMonth();
          acc[month] = (acc[month] || 0) + 1;
          return acc;
        }, {}));
        
        if (releases.length === 0) {
            loading.textContent = 'Релизы не найдены';
            return;
        }
        
        // // Всегда рендерим из кэша
          renderRecentReleases();   // блок "Недавно добавленные" — не затрагивает рейтинг
          renderFilteredRating();   // блок "Топ рейтинга" — использует ratingSelectedMonth
        
    } catch (err) {
        console.error('Ошибка загрузки:', err);
        error.style.display = 'block';
        error.textContent = `Ошибка: ${err.message}`;
    } finally {
        console.log('Скрываем индикатор загрузки');
        if (loading) {
            loading.style.display = 'none';
            loading.style.visibility = 'hidden';
            loading.classList.add('hidden');
            console.log('Индикатор загрузки скрыт');
        } else {
            console.error('Элемент loading не найден!');
        }
    }
}

async function performSearch(query) {
    try {
        const results = await window.electronAPI.searchReleases(query);
        renderReleases(results, 'searchResults');
    } catch (err) {
        console.error('Ошибка поиска:', err);
    }
}

// Унифицированный поиск с debouncing
const debouncedUnifiedSearch = debounce(async (query) => {
    if (query.length < 2) {
        hideSearchSuggestions();
        return;
    }
    
    try {
        showSearchLoading();
        const results = await window.electronAPI.unifiedSearch(query);
        renderUnifiedSearchResults(results);
    } catch (err) {
        console.error('Ошибка унифицированного поиска:', err);
        hideSearchSuggestions();
    }
}, 300);

// Поиск релизов с debouncing (для страницы оценки)
const debouncedReleaseSearch = debounce(async (query) => {
    if (query.length < 2) {
        hideReleaseSuggestions();
        return;
    }
    
    try {
        showReleaseSearchLoading();
        const results = await window.electronAPI.searchReleases(query);
        renderReleaseSearchResults(results);
    } catch (err) {
        console.error('Ошибка поиска релизов:', err);
        hideReleaseSuggestions();
    }
}, 300); // 300ms debounce delay

// Показать индикатор загрузки
function showSearchLoading() {
    const suggestions = document.getElementById('searchSuggestions');
    if (suggestions) {
        suggestions.innerHTML = '<div class="search-loading">Поиск...</div>';
        suggestions.style.display = 'block';
    }
}

// Скрыть подсказки поиска
function hideSearchSuggestions() {
    const suggestions = document.getElementById('searchSuggestions');
    if (suggestions) {
        suggestions.style.display = 'none';
    }
}

// Показать индикатор загрузки для поиска релизов
function showReleaseSearchLoading() {
    const suggestions = document.getElementById('releaseSuggestions');
    if (suggestions) {
        suggestions.innerHTML = '<div class="suggestion-item loading">Поиск релизов...</div>';
        suggestions.style.display = 'block';
    }
}

// Скрыть подсказки поиска релизов
function hideReleaseSuggestions() {
    const suggestions = document.getElementById('releaseSuggestions');
    if (suggestions) {
        suggestions.style.display = 'none';
    }
}

// Отображение результатов поиска релизов (использует механику unifiedSearch)
function renderReleaseSearchResults(results) {
    const suggestions = document.getElementById('releaseSuggestions');
    if (!suggestions) return;
    
    suggestions.innerHTML = '';
    
    if (results.total === 0) {
        suggestions.innerHTML = '<div class="search-no-results">Релизы не найдены</div>';
        suggestions.style.display = 'block';
        return;
    }
    
    // Отображаем релизы (та же логика, что и в renderUnifiedSearchResults)
    if (results.releases.length > 0) {
        const releaseSection = document.createElement('div');
        releaseSection.className = 'search-section';
        releaseSection.innerHTML = '<div class="search-section-title">Релизы</div>';
        
        results.releases.forEach(release => {
            const releaseItem = document.createElement('div');
            releaseItem.className = 'search-item release-item';
            
            // Создаем обложку или иконку (та же логика, что и в unifiedSearch)
            let coverHtml = '<div class="search-item-icon">🎵</div>';
            if (release.image) {
                try {
                    const blob = new Blob([release.image], { type: 'image/jpeg' });
                    const imageUrl = URL.createObjectURL(blob);
                    coverHtml = `<img class="search-item-cover" src="${imageUrl}" alt="${release.title}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                 <div class="search-item-icon" style="display:none;">🎵</div>`;
                } catch (err) {
                    console.error('Error creating release cover blob:', err);
                }
            }
            
            releaseItem.innerHTML = `
                ${coverHtml}
                <div class="search-item-content">
                    <div class="search-item-title">${release.title}</div>
                    <div class="search-item-subtitle">${release.artist_name}</div>
                </div>
            `;
            
            // Обработчик клика для выбора релиза для оценки
            releaseItem.addEventListener('click', () => {
                selectReleaseForRating(release);
                hideReleaseSuggestions();
            });
            
            releaseSection.appendChild(releaseItem);
        });
        
        suggestions.appendChild(releaseSection);
    }
    
    suggestions.style.display = 'block';
}

// Отображение результатов унифицированного поиска
function renderUnifiedSearchResults(results) {
    const suggestions = document.getElementById('searchSuggestions');
    if (!suggestions) return;
    
    suggestions.innerHTML = '';
    
    if (results.total === 0) {
        suggestions.innerHTML = '<div class="search-no-results">Ничего не найдено</div>';
        suggestions.style.display = 'block';
        return;
    }
    
    // Отображаем артистов
    if (results.artists.length > 0) {
        const artistSection = document.createElement('div');
        artistSection.className = 'search-section';
        artistSection.innerHTML = '<div class="search-section-title">Артисты</div>';
        
        results.artists.forEach(artist => {
            const artistItem = document.createElement('div');
            artistItem.className = 'search-item artist-item';
            
            console.log('Search artist data:', {
                id: artist.id,
                name: artist.name,
                hasAvatar: !!artist.avatar,
                avatarType: artist.avatar ? typeof artist.avatar : 'null'
            });
            
            // Создаем аватар или иконку
            let avatarHtml = '<div class="search-item-icon">🎤</div>';
            if (artist.avatar) {
                try {
                    const blob = new Blob([artist.avatar], { type: 'image/jpeg' });
                    const imageUrl = URL.createObjectURL(blob);
                    avatarHtml = `<img class="search-item-avatar" src="${imageUrl}" alt="${artist.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                  <div class="search-item-icon" style="display:none;">🎤</div>`;
                } catch (err) {
                    console.error('Error creating artist avatar blob:', err);
                }
            }
            
            artistItem.innerHTML = `
                ${avatarHtml}
                <div class="search-item-content">
                    <div class="search-item-title">${artist.name}</div>
                </div>
            `;
            artistItem.addEventListener('click', () => {
                handleArtistClick(artist.id, artist.name);
                hideSearchSuggestions();
            });
            artistSection.appendChild(artistItem);
        });
        
        suggestions.appendChild(artistSection);
    }
    
    // Отображаем релизы
    if (results.releases.length > 0) {
        const releaseSection = document.createElement('div');
        releaseSection.className = 'search-section';
        releaseSection.innerHTML = '<div class="search-section-title">Релизы</div>';
        
        results.releases.forEach(release => {
            const releaseItem = document.createElement('div');
            releaseItem.className = 'search-item release-item';
            
            // Создаем обложку или иконку
            let coverHtml = '<div class="search-item-icon">🎵</div>';
            if (release.image) {
                try {
                    const blob = new Blob([release.image], { type: 'image/jpeg' });
                    const imageUrl = URL.createObjectURL(blob);
                    coverHtml = `<img class="search-item-cover" src="${imageUrl}" alt="${release.title}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                 <div class="search-item-icon" style="display:none;">🎵</div>`;
                } catch (err) {
                    console.error('Error creating release cover blob:', err);
                }
            }
            
            releaseItem.innerHTML = `
                ${coverHtml}
                <div class="search-item-content">
                    <div class="search-item-title">${release.title}</div>
                    <div class="search-item-subtitle">${release.artist_name}</div>
                </div>
            `;
            releaseItem.addEventListener('click', () => {
                handleReleaseClick(release.id);
                hideSearchSuggestions();
            });
            releaseSection.appendChild(releaseItem);
        });
        
        suggestions.appendChild(releaseSection);
    }
    
    suggestions.style.display = 'block';
}

async function checkAuthOnLoad() {
  try {
    const user = await window.electronAPI.checkAuth();
    if (user) {
      updateUIAfterLogin(user);
      getCurrentUser(user);
    }
  } catch (err) {
    console.error('Auth check error:', err);
  }
}


// 4. Инициализация приложения
// 4. Инициализация приложения
document.addEventListener('DOMContentLoaded', async () => {
    // Элементы прелоадера
    const preloader = document.getElementById('preloader');
    const loadingText = document.getElementById('loadingText');
    const logo = document.querySelector('.preloader-logo');

    // Проверка доступности Electron API
    if (!window.electronAPI) {
        console.error('Electron API не доступен!');
        document.getElementById('error').textContent = 'Ошибка: Не удалось подключиться к приложению';
        return;
    }

    // 1. Начинаем загрузку данных СРАЗУ
    const loadPromise = loadReleases(); // Запускаем загрузку, но не ждем завершения

    checkAuthOnLoad();
    
    // 2. Показываем анимацию загрузки
    let dotsInterval = setInterval(() => {
        const dots = loadingText.textContent.match(/\./g) || [];
        loadingText.textContent = 'Загрузка' + '.'.repeat((dots.length % 3) + 1);
    }, 500);

    // 3. Ждем завершения загрузки
    try {
        await loadPromise;
        
        // 4. Когда загрузка завершена, показываем успех
        clearInterval(dotsInterval);
        loadingText.classList.add('success');
        loadingText.innerHTML = 'Успешно загружено <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="margin-left: 8px;"><path d="M20 6L9 17L4 12" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        
        // 5. Ждем 1 секунду перед анимацией завершения
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 6. Запускаем анимацию завершения
        loadingText.classList.add('hide');
       // logo.classList.add('expand');
        
        // 7. Показываем основной интерфейс
        document.body.classList.add('show');
        
        // 8. Убеждаемся, что локальный индикатор загрузки скрыт
        const localLoading = document.getElementById('loading');
        if (localLoading) {
            localLoading.style.display = 'none';
            localLoading.style.visibility = 'hidden';
        }
        
        // 9. Скрываем прелоадер
        setTimeout(() => {
            preloader.classList.add('hide');
            setTimeout(() => {
                preloader.remove();
                // Показываем главную страницу по умолчанию
                showMainPage();
            }, 800);
        }, 800);
        
    } catch (error) {
        // Обработка ошибки загрузки
        clearInterval(dotsInterval);
        loadingText.classList.add('error');
        loadingText.textContent = 'Ошибка загрузки';
        console.error('Ошибка загрузки:', error);
        return;
    }

    // Инициализация остального интерфейса
    initApp();
    
    // Глобальный делегированный обработчик для перехода на страницу артиста
    document.addEventListener('click', async (e) => {
        const linkEl = e.target.closest('[data-artist-id], [data-artist-name], .artist-link');
        if (!linkEl) return;
        
        // Не мешаем другим кликам по кнопкам/контролам
        if (linkEl.tagName === 'BUTTON' || linkEl.closest('button')) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        let artistId = linkEl.dataset.artistId;
        let artistName = linkEl.dataset.artistName || (linkEl.textContent || '').trim();
        
        try {
            if (artistId) {
                await handleArtistClick(Number(artistId), artistName);
                return;
            }
            
            if (artistName) {
                // Пробуем найти артиста по имени
                const results = await window.electronAPI.searchArtists(artistName);
                let match = null;
                if (Array.isArray(results) && results.length > 0) {
                    match = results.find(a => (a.name || '').toLowerCase() === artistName.toLowerCase()) || results[0];
                }
                if (match?.id) {
                    await handleArtistClick(Number(match.id), match.name);
                    return;
                }
            }
            
            showNotification('Артист не найден', 'error');
        } catch (err) {
            console.error('Artist navigation error:', err);
            showNotification('Не удалось открыть страницу артиста', 'error');
        }
    });
});

function showReleasePreview(release) {
  const modal = document.getElementById('releasePreviewModal');
  document.getElementById('previewCover').src = release.image ? bufferToImage(release.image) : 'images/default-avatar.png';
  document.getElementById('previewReleaseTitle').textContent = release.title || 'Без названия';
  
  // Обрабатываем артистов в превью
  const previewArtistElement = document.getElementById('previewArtist');
  if (release.artist_names && release.artist_ids) {
    createArtistLinks(release.artist_names, release.artist_ids, previewArtistElement);
  } else {
    // Fallback для старого формата
    previewArtistElement.textContent = release.artist_name || 'Исполнитель не указан';
  }
  
  document.getElementById('previewType').textContent = release.type || 'Тип не указан';
  document.getElementById('previewRating').textContent = renderRating(release.host_rating);
  document.getElementById('previewUserRating').textContent = renderRating(release.average_user_rating);

  modal.classList.add('show');

  // Кнопка открытия полной страницы
  document.getElementById('openFullReleaseBtn').onclick = () => {
    modal.classList.remove('show');
    handleReleaseClick(release.id); // открыть страницу релиза
  };

  // Закрытие крестиком
  // document.getElementById('closePreviewBtn').onclick = () => {
  //   modal.classList.remove('show');
  // };

  // Закрытие по клику вне окна
  window.onclick = (e) => {
    if (e.target === modal) {
      modal.classList.remove('show');
    }
  };
}


// Инициализация поиска на главной странице
function initHomeSearch() {
    const searchInput = document.querySelector('.search-input');
    const suggestions = document.getElementById('searchSuggestions');
    
    if (!searchInput || !suggestions) return;
    
    // Обработчик ввода с debouncing
    searchInput.addEventListener('input', function() {
        const query = this.value.trim();
        debouncedUnifiedSearch(query);
    });
    
    // Закрытие подсказок при клике вне
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !suggestions.contains(e.target)) {
            suggestions.style.display = 'none';
        }
    });
}

// Функция для отображения подсказок
function renderSearchSuggestions(releases, container) {
    container.innerHTML = '';
    
    if (releases.length === 0) {
        const noResults = document.createElement('div');
        noResults.className = 'suggestion-item';
        noResults.textContent = 'Релизы не найдены';
        container.appendChild(noResults);
        return;
    }
    
    releases.slice(0, 5).forEach(release => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        
        const imageUrl = release.image ? bufferToImage(release.image) : 'images/default-avatar.png';
        
        item.innerHTML = `
            <img src="${imageUrl}" alt="${release.title}">
            <div class="suggestion-info">
                <div class="suggestion-title">${release.title || 'Без названия'}</div>
                <div class="suggestion-artist">${release.artist_names || release.artist_name || 'Исполнитель не указан'}</div>
            </div>
        `;
        
        item.addEventListener('click', () => {
            handleReleaseClick(release.id);
            container.style.display = 'none';
        });
        
        container.appendChild(item);
    });
}

    // Функция инициализации приложения
async function initApp() {
        // Инициализация элементов интерфейса
        document.querySelector('.releases-scroll-container').style.display = 'block';
        document.getElementById('searchContainer').style.display = 'none';
        document.getElementById('favoritesContainer').style.display = 'none';
        document.getElementById('profile-page').style.display = 'none';
        
    document.getElementById('allReleasesPage').style.display = 'none';
        
        ['filterYear','filterMonth','filterType','filterRatingMin','filterRatingMax'].forEach(id => {
        const el = document.getElementById(id);
          if (el) {
            el.addEventListener('change', applyFilters);
          }
        });

        // Связка двойного ползунка рейтинга с числовыми инпутами
        const ratingMinInput = document.getElementById('filterRatingMin');
        const ratingMaxInput = document.getElementById('filterRatingMax');
        const ratingMinRange = document.getElementById('ratingMinRange');
        const ratingMaxRange = document.getElementById('ratingMaxRange');
        const ratingProgress = document.getElementById('ratingRangeProgress');

        function syncRatingProgress() {
          if (!ratingMinRange || !ratingMaxRange || !ratingProgress) return;
          const min = parseFloat(ratingMinRange.min) || 0;
          const max = parseFloat(ratingMaxRange.max) || 10;
          const a = Math.min(parseFloat(ratingMinRange.value), parseFloat(ratingMaxRange.value));
          const b = Math.max(parseFloat(ratingMinRange.value), parseFloat(ratingMaxRange.value));
          const container = document.getElementById('ratingRangeFilter');
          const track = container?.querySelector('.range-track');
          if (track) {
            const trackRect = track.getBoundingClientRect();
            const trackWidth = trackRect.width; // уже с учётом 9px слева/справа
            const leftPx = ((a - min) / (max - min)) * trackWidth;
            const rightPx = ((b - min) / (max - min)) * trackWidth;
            ratingProgress.style.left = (9 + leftPx) + 'px';
            ratingProgress.style.right = (9 + (trackWidth - rightPx)) + 'px';
          } else {
            // Фолбэк в процентах
            const left = ((a - min) / (max - min)) * 100;
            const right = ((b - min) / (max - min)) * 100;
            ratingProgress.style.left = left + '%';
            ratingProgress.style.right = (100 - right) + '%';
          }
        }

        function clamp(val, lo, hi) { return Math.min(hi, Math.max(lo, val)); }

        if (ratingMinRange && ratingMaxRange && ratingMinInput && ratingMaxInput) {
          // Инициализация значений
          if (!ratingMinInput.value) ratingMinInput.value = ratingMinRange.value;
          if (!ratingMaxInput.value) ratingMaxInput.value = ratingMaxRange.value;
          syncRatingProgress();

          // Движение ползунков
          ratingMinRange.addEventListener('input', () => {
            const minVal = parseFloat(ratingMinRange.value);
            const maxVal = parseFloat(ratingMaxRange.value);
            if (minVal > maxVal) ratingMaxRange.value = String(minVal);
            ratingMinInput.value = ratingMinRange.value;
            syncRatingProgress();
          });
          ratingMaxRange.addEventListener('input', () => {
            const minVal = parseFloat(ratingMinRange.value);
            const maxVal = parseFloat(ratingMaxRange.value);
            if (maxVal < minVal) ratingMinRange.value = String(maxVal);
            ratingMaxInput.value = ratingMaxRange.value;
            syncRatingProgress();
          });

          // Ввод чисел
          ratingMinInput.addEventListener('change', () => {
            const lo = parseFloat(ratingMinRange.min) || 0;
            const hi = parseFloat(ratingMinRange.max) || 10;
            const val = clamp(parseFloat(ratingMinInput.value || '0'), lo, hi);
            ratingMinInput.value = String(val);
            if (val > parseFloat(ratingMaxRange.value)) ratingMaxRange.value = String(val);
            ratingMinRange.value = String(val);
            syncRatingProgress();
            applyFilters();
          });
          ratingMaxInput.addEventListener('change', () => {
            const lo = parseFloat(ratingMaxRange.min) || 0;
            const hi = parseFloat(ratingMaxRange.max) || 10;
            const val = clamp(parseFloat(ratingMaxInput.value || '10'), lo, hi);
            ratingMaxInput.value = String(val);
            if (val < parseFloat(ratingMinRange.value)) ratingMinRange.value = String(val);
            ratingMaxRange.value = String(val);
            syncRatingProgress();
            applyFilters();
          });

          // Применение фильтра при отпускании ползунка
          ratingMinRange.addEventListener('change', applyFilters);
          ratingMaxRange.addEventListener('change', applyFilters);
        }

        // Пересчёт при ресайзе окна, чтобы учесть изменение ширины трека
        window.addEventListener('resize', () => {
          syncRatingProgress();
        });

        document.getElementById('profileBtn')?.addEventListener('click', async () => {
            try {
                // Получаем свежие данные пользователя
                const freshUserData = await window.electronAPI.checkAuth();
                if (freshUserData) {
                    console.log('Opening own profile for user:', freshUserData);
                    console.log('Fresh user data details:', {
                        id: freshUserData.id,
                        displayName: freshUserData.displayName,
                        hasAvatar: !!freshUserData.avatarBytes,
                        hasBanner: !!freshUserData.bannerBytes,
                        avatarSize: freshUserData.avatarBytes ? freshUserData.avatarBytes.length : 0,
                        bannerSize: freshUserData.bannerBytes ? freshUserData.bannerBytes.length : 0
                    });
                    showProfilePage(freshUserData);
                } else {
                    showNotification('Ошибка загрузки данных профиля', 'error');
                }
            } catch (err) {
                console.error('Error loading profile data:', err);
                showNotification('Ошибка загрузки данных профиля', 'error');
            }
        });

        // Settings button handler
        document.getElementById('settingsBtn')?.addEventListener('click', async () => {
            try {
                const freshUserData = await window.electronAPI.checkAuth();
                if (freshUserData) {
                    showSettingsPage(freshUserData);
                } else {
                    showNotification('Ошибка загрузки данных профиля', 'error');
                }
            } catch (err) {
                console.error('Error loading settings data:', err);
                showNotification('Ошибка загрузки данных профиля', 'error');
            }
        });

        // Инициализация элементов даты
        monthItems = document.querySelectorAll('.month-item');
        const monthTrigger = document.getElementById('monthTrigger');
        dateModal = document.getElementById('dateModal');
        currentYearElement = document.getElementById('currentYear');
        
        if (!monthTrigger || !dateModal || !currentYearElement || !monthItems.length) {
            console.error('Один из ключевых элементов не найден!');
            return;
        }

        // Обработчики событий для выбора даты
        monthTrigger.addEventListener('click', () => {
            dateModal.classList.add('show');
            updateDateModal();
        });

        document.querySelector('#dateModal .close-btn').addEventListener('click', () => {
            dateModal.classList.remove('show');
        });

        document.getElementById('prevYear').addEventListener('click', () => {
            ratingSelectedYear--;
            updateDateModal();
        });

        document.getElementById('nextYear').addEventListener('click', () => {
            ratingSelectedYear++;
            updateDateModal();
        });

        monthItems.forEach(item => {
            item.addEventListener('click', function() {
                monthItems.forEach(m => m.classList.remove('selected'));
                this.classList.add('selected');
                ratingSelectedMonth = parseInt(this.dataset.month);
            });
        });

        document.getElementById('confirmDate').addEventListener('click', async () => {
            dateModal.classList.remove('show');
            updateMonthHeader();
            console.log('Выбран месяц:', ratingSelectedMonth, 'год:', ratingSelectedYear);
            
            // Если у нас уже есть полный кэш, просто фильтруем его
            if (cachedReleases && cachedReleases.length > 0) {
                console.log('Используем существующий кэш для фильтрации');
                renderFilteredRating();
            } else {
                // Если кэш пуст, загружаем все релизы
                console.log('Кэш пуст, загружаем все релизы');
                try {
                    const releases = await window.electronAPI.getAllReleases();
                    cachedReleases = releases;
                    renderFilteredRating();
                } catch (err) {
                    console.error('Ошибка загрузки релизов:', err);
                    showNotification('Не удалось загрузить релизы', 'error');
                }
            }
        });

        // Первоначальная загрузка релизов уже выполнена в прелоадере
        // await loadReleases(); // Убираем дублирующий вызов
        
        // Обновление заголовка месяца
         updateMonthHeader();

        initHomeSearch();

        document.querySelectorAll('.icon-btn[data-page]').forEach(btn => {
            btn.addEventListener('click', function() {
                if (this.classList.contains('active')) return;
                
                const page = this.dataset.page;
                
                if (page === 'add-release') {
                    document.getElementById('addReleaseModal').classList.add('show');
                    return;
                }
                
                
                document.querySelectorAll('.icon-btn[data-page]').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                document.getElementById('mainPageContent').style.display = 'none';
                
                document.getElementById('allReleasesPage').style.display = 'none';
                document.getElementById('searchContainer').style.display = 'none';
                document.getElementById('favoritesContainer').style.display = 'none';
                document.getElementById('releasePage').style.display = 'none';
                document.getElementById('artistPage').style.display = 'none';
                document.getElementById('rateReleasePage').style.display = 'none'; // Добавлено
                document.getElementById('profile-page').style.display = 'none'; // Добавлено
                document.querySelector('.releases-scroll-container').style.display = 'none';
                
                switch(page) {
                    case 'releases':
                        document.getElementById('mainPageContent').style.display = 'block';
                        document.querySelector('.releases-scroll-container').style.display = 'block';
                        // if (cachedReleases) {
                        //     renderReleases(cachedReleases);
                        // }
                        break;
                    case 'search':
                        document.getElementById('mainPageContent').style.display = 'block';
                        document.getElementById('searchContainer').style.display = 'block';
                        break;
                    case 'rate-release':
                        showRateReleasePage();
                        break;
                    case 'all-releases':
                        console.log('Клик по кнопке "Все релизы", isLoadingReleases:', isLoadingReleases);
                        if (!isLoadingReleases) {
                        showAllReleasesPage();
                        } else {
                            console.log('Загрузка уже выполняется, пропускаем клик');
                        }
                        break;
                    case 'updates':
                        showUpdatesPage();
                        break;
                    case 'artist-favorites':
                        showAllArtistFavorites();
                        break;

                }
            });
        });

    }

////////////////////                                      ////////////////////
////////////////////                                      ////////////////////
////////////////////             РЕГ                      ////////////////////
////////////////////                                      ////////////////////
////////////////////                                      ////////////////////



document.addEventListener('DOMContentLoaded', () => {
    
    // Обработчик кнопки регистрации
    document.querySelector('.reg-btn')?.addEventListener('click', () => {
        const modal = document.getElementById('registrationModal');
        modal.classList.add('show');
        document.getElementById('email').focus();
    });

    document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.getElementById('loginModal').classList.remove('show');
    }
    });

    // Закрытие модального окна логина по крестику
    document.querySelector('#loginModal .close-btn')?.addEventListener('click', () => {
        const modal = document.getElementById('loginModal');
        modal.classList.remove('show');
    });

    window.addEventListener('click', (event) => {
    const modal = document.getElementById('loginModal');
    if (event.target === modal) {
        modal.classList.remove('show');
    }
    });

    document.querySelector('.login-btn')?.addEventListener('click', () => {
        const modal = document.getElementById('loginModal');
        modal.classList.add('show');
        // Фокусируемся на поле email
        document.getElementById('loginEmail').focus();
    });

    // Закрытие модального окна
    document.querySelector('.close-btn')?.addEventListener('click', () => {
        const modal = document.getElementById('registrationModal');
        modal.classList.remove('show');
    });

    // Закрытие при клике вне модального окна
    window.addEventListener('click', (event) => {
        const modal = document.getElementById('registrationModal');
        if (event.target === modal) {
            modal.classList.remove('show');
        }
    });

    // Валидация формы
    // Обновите обработчик формы регистрации
document.getElementById('registrationForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Сброс ошибок
    document.querySelectorAll('.form-group').forEach(group => {
        group.classList.remove('error');
        const errorMsg = group.querySelector('.error-message');
        if (errorMsg) errorMsg.remove();
    });

    // Получаем данные формы
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const displayName = document.getElementById('displayName').value.trim();
    const terms = document.getElementById('terms').checked;
    const privacy = document.getElementById('privacy').checked;

    // Валидация
    let isValid = true;

    // Проверка email
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        showError('email', 'Введите корректный email');
        showNotification('Пожалуйста, введите корректный email', 'error');
        isValid = false;
    }

    // Проверка имени
    if (!displayName || displayName.length < 3) {
        showError('displayName', 'Имя должно содержать минимум 3 символа');
        showNotification('Имя должно содержать минимум 3 символа', 'error');
        isValid = false;
    } else if (displayName.length > 20) {
        showError('displayName', 'Имя не должно превышать 20 символов');
        showNotification('Имя не должно превышать 20 символов', 'error');
        isValid = false;
    }

    // Проверка пароля
    if (!password || password.length < 6) {
        showError('password', 'Пароль должен содержать минимум 6 символов');
        showNotification('Пароль должен содержать минимум 6 символов', 'error');
        isValid = false;
    }

    // Проверка подтверждения пароля
    if (password !== confirmPassword) {
        showError('confirmPassword', 'Пароли не совпадают');
        showNotification('Пароли не совпадают', 'error');
        isValid = false;
    }

    // Проверка чекбоксов
    if (!terms) {
        showError('terms', 'Необходимо принять пользовательское соглашение');
        showNotification('Необходимо принять пользовательское соглашение', 'error');
        isValid = false;
    }

    if (!privacy) {
        showError('privacy', 'Необходимо согласие на обработку данных');
        showNotification('Необходимо согласие на обработку данных', 'error');
        isValid = false;
    }

    if (!isValid) return;

    // Блокируем кнопку отправки
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Проверка данных...';

    try {
        // Проверяем существование email и displayName
        const { emailExists, displayNameExists } = await window.electronAPI.checkUserExists({ 
            email, 
            displayName 
        });

        if (emailExists) {
            showError('email', 'Пользователь с таким email уже существует');
            showNotification('Пользователь с таким email уже существует', 'error');
            isValid = false;
        }

        if (displayNameExists) {
            showError('displayName', 'Это имя пользователя уже занято');
            showNotification('Это имя пользователя уже занято', 'error');
            isValid = false;
        }

        if (!isValid) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
            return;
        }

        // Если проверки пройдены, сохраняем данные и переходим к подтверждению
        registrationData = { email, displayName, password };
        currentEmail = email;
        
        document.getElementById('userEmailDisplay').textContent = currentEmail;
        document.getElementById('registrationModal').classList.remove('show');
        document.getElementById('emailConfirmationModal').classList.add('show');
        
        // Отправляем код подтверждения
        submitBtn.textContent = 'Отправка кода...';
        
        try {
            const result = await window.electronAPI.sendConfirmationCode(currentEmail);
            
            showNotification('Код подтверждения отправлен на вашу почту');
            
            startResendTimer();
            setupCodeInputs();
        } catch (error) {
            console.error('Ошибка отправки кода:', error);
            showNotification(error.message, 'error');
            document.getElementById('emailConfirmationModal').classList.remove('show');
            document.getElementById('registrationModal').classList.add('show');
        }
    } catch (error) {
        console.error('Ошибка проверки пользователя:', error);
        showNotification('Произошла ошибка при проверке данных. Попробуйте позже.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
});
});

// Обработчик успешной валидации формы
async function handleSuccessfulValidation(formData) {
  try {
    registrationData = formData;
    currentEmail = formData.email;
    
    document.getElementById('userEmailDisplay').textContent = currentEmail;
    document.getElementById('registrationModal').classList.remove('show');
    document.getElementById('emailConfirmationModal').classList.add('show');
    
    const submitBtn = document.querySelector('#confirmationForm .submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправка кода...';
    
    try {
      const result = await window.electronAPI.sendConfirmationCode(currentEmail);
      
      showNotification('Код подтверждения отправлен на вашу почту');
      
      startResendTimer();
      setupCodeInputs();
    } catch (error) {
      console.error('Ошибка отправки кода:', error);
      showNotification(error.message, 'error');
      document.getElementById('emailConfirmationModal').classList.remove('show');
      document.getElementById('registrationModal').classList.add('show');
    }
  } finally {
    const submitBtn = document.querySelector('#confirmationForm .submit-btn');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Подтвердить';
    }
  }
}

// Настройка полей ввода кода подтверждения
function setupCodeInputs() {
    const inputs = document.querySelectorAll('.code-input');
    
    inputs.forEach((input, index) => {
        // Обработчик ввода
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1) {
                if (index < inputs.length - 1) {
                    inputs[index + 1].focus();
                }
            }
        });
        
        // Обработчик удаления
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && e.target.value.length === 0) {
                if (index > 0) {
                    inputs[index - 1].focus();
                }
            }
        });
    });
}

// Таймер для повторной отправки кода
function startResendTimer() {
    let seconds = 60;
    const timerElement = document.getElementById('resendTimer');
    timerElement.classList.remove('active');
    
    const timer = setInterval(() => {
        seconds--;
        timerElement.textContent = `Отправить код повторно (${seconds})`;
        
        if (seconds <= 0) {
            clearInterval(timer);
            timerElement.textContent = 'Отправить код повторно';
            timerElement.classList.add('active');
            
            // Добавляем обработчик клика для повторной отправки
            timerElement.addEventListener('click', resendConfirmationCode);
        }
    }, 1000);
}

// Функция для повторной отправки кода
async function resendConfirmationCode() {
  if (!registrationData) return;
  
  try {
    const result = await window.electronAPI.sendConfirmationCode(registrationData.email);
    
    showNotification('Код подтверждения отправлен повторно');
    
    startResendTimer();
    document.querySelectorAll('.code-input').forEach(input => input.value = '');
    document.querySelector('.code-input').focus();
  } catch (error) {
    console.error('Ошибка повторной отправки:', error);
    showError('confirmation', error.message);
  }
}

// Обработчик формы подтверждения
document.getElementById('confirmationForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const enteredCode = Array.from(document.querySelectorAll('.code-input'))
    .map(input => input.value)
    .join('');
  
  try {
    // Проверяем код
    await window.electronAPI.verifyConfirmationCode({
      email: registrationData.email,
      code: enteredCode
    });
    
    // Регистрируем пользователя
    const result = await window.electronAPI.registerUser(registrationData);
    
    // Закрываем модальные окна
    document.getElementById('emailConfirmationModal').classList.remove('show');
    document.getElementById('registrationModal').classList.remove('show');
    
    // Показываем уведомление об успехе
    showSuccessNotification('Регистрация завершена успешно!');
    
    // Очищаем форму
    document.getElementById('registrationForm').reset();
    
  } catch (error) {
    console.error('Ошибка подтверждения:', error);
    showError('confirmation', error.message);
  }
});

////////////////////                                      ////////////////////
////////////////////                                      ////////////////////
////////////////////       ДОБАВЛЕНИЕ РЕЛИЗА              ////////////////////
////////////////////                                      ////////////////////
////////////////////                                      ////////////////////



document.addEventListener('DOMContentLoaded', () => {

  // Закрытие модального окна
  document.querySelector('#addReleaseModal .close-btn').addEventListener('click', () => {
    document.getElementById('addReleaseModal').classList.remove('show');
  });

  document.getElementById('cancelAddRelease').addEventListener('click', () => {
    document.getElementById('addReleaseModal').classList.remove('show');
  });

  // Загрузка изображения
  document.getElementById('imageUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        const preview = document.getElementById('imagePreview');
        preview.innerHTML = '';
        const img = document.createElement('img');
        img.src = event.target.result;
        preview.appendChild(img);
      };
      reader.readAsDataURL(file);
    }
  });

  // Удаление изображения
  document.getElementById('removeImageBtn').addEventListener('click', function() {
    document.getElementById('imagePreview').innerHTML = `
      <div class="placeholder-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 16L8.586 11.414C8.961 11.039 9.47 10.828 10 10.828C10.53 10.828 11.039 11.039 11.414 11.414L16 16" stroke="#9B9B9B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M14 14L15.586 12.414C15.961 12.039 16.47 11.828 17 11.828C17.53 11.828 18.039 12.039 18.414 12.414L20 14" stroke="#9B9B9B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M19 19H5C3.895 19 3 18.105 3 17V7C3 5.895 3.895 5 5 5H19C20.105 5 21 5.895 21 7V17C21 18.105 20.105 19 19 19Z" stroke="#9B9B9B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M9 10C9.552 10 10 9.552 10 9C10 8.448 9.552 8 9 8C8.448 8 8 8.448 8 9C8 9.552 8.448 10 9 10Z" stroke="#9B9B9B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Загрузите обложку</span>
      </div>
    `;
    document.getElementById('imageUpload').value = '';
  });

  // Выбор типа релиза
  document.querySelectorAll('.type-option').forEach(option => {
    option.addEventListener('click', function() {
      document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('active'));
      this.classList.add('active');
      document.getElementById('releaseType').value = this.dataset.type;
    });
  });

  // Установим активным первый тип по умолчанию
  document.querySelector('.type-option').classList.add('active');

  // Автодополнение артистов
  const artistInput = document.getElementById('artistInput');
  const artistSuggestions = document.getElementById('artistSuggestions');
  const selectedArtists = document.getElementById('selectedArtists');
  const selectedArtistIds = new Set();

  artistInput.addEventListener('input', async function() {
    const query = this.value.trim();
    if (query.length < 2) {
      artistSuggestions.style.display = 'none';
      return;
    }

    try {
      const artists = await window.electronAPI.searchArtists(query);
      artistSuggestions.innerHTML = '';
      
      if (artists.length > 0) {
        artists.forEach(artist => {
          if (!selectedArtistIds.has(artist.id)) {
            const div = document.createElement('div');
            div.className = 'artist-suggestion';
            div.textContent = artist.name;
            div.addEventListener('click', () => {
              addArtist(artist.id, artist.name);
              artistInput.value = '';
              artistSuggestions.style.display = 'none';
            });
            artistSuggestions.appendChild(div);
          }
        });
        artistSuggestions.style.display = 'block';
      } else {
        artistSuggestions.style.display = 'none';
      }
    } catch (err) {
      console.error('Error searching artists:', err);
      artistSuggestions.style.display = 'none';
    }
  });

  // Добавление нового артиста, если не найден
    artistInput.addEventListener('keydown', async function(e) {
    // Проверяем Enter (13) или Space (32)
    if ((e.key === 'Enter' || e.key === ' ') && this.value.trim()) {
        e.preventDefault(); // Предотвращаем стандартное поведение
        
        // Если есть подсказки - выбираем первую
        if (artistSuggestions.style.display === 'block') {
        const firstSuggestion = artistSuggestions.querySelector('.artist-suggestion');
        if (firstSuggestion) {
            firstSuggestion.click();
            return;
        }
        }
        
        // Если подсказок нет - создаем нового артиста
        const artistName = this.value.trim();
        try {
        const artistId = await window.electronAPI.createArtist(artistName);
        addArtist(artistId, artistName);
        this.value = '';
        } catch (err) {
        console.error('Error creating artist:', err);
        showNotification('Ошибка при добавлении артиста', 'error');
        }
    }
    });

  // Закрытие подсказок при клике вне
  document.addEventListener('click', function(e) {
    if (!artistInput.contains(e.target) && !artistSuggestions.contains(e.target)) {
      artistSuggestions.style.display = 'none';
    }
  });

  // Функция добавления артиста
function addArtist(id, name) {
    if (selectedArtistIds.has(id)) return;
    
    selectedArtistIds.add(id);
    
    const tag = document.createElement('div');
    tag.className = 'artist-tag';
    tag.innerHTML = `
      ${name}
      <span class="artist-tag-remove" data-id="${id}">&times;</span>
    `;
    selectedArtists.appendChild(tag);
    
    // Удаление артиста
    tag.querySelector('.artist-tag-remove').addEventListener('click', function() {
      selectedArtistIds.delete(id);
      tag.remove();
    });
  }

  // Отправка формы
  document.getElementById('addReleaseForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const title = document.getElementById('releaseTitle').value.trim();
    const type = document.getElementById('releaseType').value;
    const date = document.getElementById('releaseDate').value;
    const imageFile = document.getElementById('imageUpload').files[0];
    
    if (!title || !date || selectedArtistIds.size === 0) {
      showNotification('Пожалуйста, заполните все обязательные поля', 'error');
      return;
    }
    
    try {
      // Преобразуем изображение в Buffer, если оно есть
      let imageBuffer = null;
      if (imageFile) {
        imageBuffer = await readFileAsBuffer(imageFile);
      }
      
      // Создаем релиз
      const releaseId = await window.electronAPI.createRelease({
        title,
        type,
        date,
        image: imageBuffer,
        artistIds: Array.from(selectedArtistIds)
      });
      
      showNotification('Релиз успешно добавлен!');
      document.getElementById('addReleaseModal').classList.remove('show');
      
      // Обновляем список релизов
      loadReleases(true);
      
      // Очищаем форму
      this.reset();
      selectedArtists.innerHTML = '';
      selectedArtistIds.clear();
      document.getElementById('imagePreview').innerHTML = `
        <div class="placeholder-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 16L8.586 11.414C8.961 11.039 9.47 10.828 10 10.828C10.53 10.828 11.039 11.039 11.414 11.414L16 16" stroke="#9B9B9B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 14L15.586 12.414C15.961 12.039 16.47 11.828 17 11.828C17.53 11.828 18.039 12.039 18.414 12.414L20 14" stroke="#9B9B9B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M19 19H5C3.895 19 3 18.105 3 17V7C3 5.895 3.895 5 5 5H19C20.105 5 21 5.895 21 7V17C21 18.105 20.105 19 19 19Z" stroke="#9B9B9B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9 10C9.552 10 10 9.552 10 9C10 8.448 9.552 8 9 8C8.448 8 8 8.448 8 9C8 9.552 8.448 10 9 10Z" stroke="#9B9B9B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Загрузите обложку</span>
        </div>
      `;
      document.querySelector('.type-option').classList.add('active');
      document.querySelectorAll('.type-option:not(:first-child)').forEach(opt => opt.classList.remove('active'));
      
    } catch (err) {
      console.error('Error adding release:', err);
      showNotification('Ошибка при добавлении релиза', 'error');
    }
  });
});
