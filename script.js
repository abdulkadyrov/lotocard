// Состояние приложения
let state = {
    screen: 'menu', // 'menu' или 'game'
    selectedCount: 0,
    cards: [], // карточки для подготовки
    gameCards: [], // карточки в игре
    favorites: [], // избранные карточки
    markedCells: {}, // отмеченные клетки по id карточки
    wonRows: {}, // засчитанные ряды по id карточки
    panels: {
        count: false,
        search: false,
        favorites: false
    }
};

// Загрузка из localStorage
function loadFromStorage() {
    const fav = localStorage.getItem('loto-favorites');
    if (fav) {
        state.favorites = JSON.parse(fav);
    }
}

// Сохранение в localStorage
function saveToStorage() {
    localStorage.setItem('loto-favorites', JSON.stringify(state.favorites));
}

// Генерация шаблона карточки (маска заполнения)
function generateMask() {
    const mask = Array(3).fill().map(() => Array(9).fill(false));
    const positions = [];
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 9; col++) {
            positions.push([row, col]);
        }
    }
    // Выбираем 15 случайных позиций
    const selected = [];
    while (selected.length < 15) {
        const idx = Math.floor(Math.random() * positions.length);
        const pos = positions.splice(idx, 1)[0];
        selected.push(pos);
        mask[pos[0]][pos[1]] = true;
    }
    // Проверяем, чтобы в каждом ряду было ровно 5 заполненных
    for (let row = 0; row < 3; row++) {
        const filled = mask[row].filter(cell => cell).length;
        if (filled !== 5) {
            return generateMask(); // Рекурсивно генерируем заново
        }
    }
    return mask;
}

// Генерация чисел для карточки
function generateNumbers(mask) {
    const numbers = Array(3).fill().map(() => Array(9).fill(null));
    const ranges = [
        [1, 9], [10, 19], [20, 29], [30, 39], [40, 49],
        [50, 59], [60, 69], [70, 79], [80, 90]
    ];
    for (let col = 0; col < 9; col++) {
        const colNumbers = [];
        for (let row = 0; row < 3; row++) {
            if (mask[row][col]) {
                colNumbers.push(row);
            }
        }
        if (colNumbers.length > 0) {
            const [min, max] = ranges[col];
            const available = [];
            for (let n = min; n <= max; n++) {
                available.push(n);
            }
            // Перемешиваем и выбираем
            for (let i = available.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [available[i], available[j]] = [available[j], available[i]];
            }
            colNumbers.sort((a, b) => a - b); // Сортируем ряды по возрастанию
            for (let i = 0; i < colNumbers.length; i++) {
                numbers[colNumbers[i]][col] = available[i];
            }
        }
    }
    return numbers;
}

// Создание карточки
function createCard() {
    const mask = generateMask();
    const numbers = generateNumbers(mask);
    return {
        id: Date.now() + Math.random(),
        mask,
        numbers,
        marked: Array(3).fill().map(() => Array(9).fill(false)),
        wonRows: [false, false, false],
        favorite: false
    };
}

// Перегенерация карточки (с новым шаблоном)
function regenerateCard(card) {
    let newMask;
    let attempts = 0;
    do {
        newMask = generateMask();
        attempts++;
    } while (JSON.stringify(newMask) === JSON.stringify(card.mask) && attempts < 10); // Избегаем повторения шаблона
    const newNumbers = generateNumbers(newMask);
    card.mask = newMask;
    card.numbers = newNumbers;
    card.marked = Array(3).fill().map(() => Array(9).fill(false));
    card.wonRows = [false, false, false];
    return card;
}

// Рендер карточки
function renderCard(card, container, isGame = false) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    cardDiv.dataset.id = card.id;

    const grid = document.createElement('div');
    grid.className = 'card-grid';

    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 9; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            if (card.mask[row][col]) {
                cell.textContent = card.numbers[row][col];
                cell.dataset.row = row;
                cell.dataset.col = col;
                if (isGame && card.marked[row][col]) {
                    cell.classList.add('marked');
                }
                if (isGame) {
                    cell.addEventListener('click', () => toggleMark(card.id, row, col));
                }
            } else {
                cell.classList.add('empty');
            }
            grid.appendChild(cell);
        }
    }

    cardDiv.appendChild(grid);

    if (!isGame) {
        const actions = document.createElement('div');
        actions.className = 'card-actions';

        const favoriteBtn = document.createElement('button');
        favoriteBtn.textContent = card.favorite ? 'УБРАТЬ ИЗ ИЗБРАННОГО' : 'В ИЗБРАННОЕ';
        favoriteBtn.addEventListener('click', () => toggleFavorite(card));
        actions.appendChild(favoriteBtn);

        const regenerateBtn = document.createElement('button');
        regenerateBtn.textContent = 'ПЕРЕГЕНЕРИРОВАТЬ';
        regenerateBtn.addEventListener('click', () => {
            regenerateCard(card);
            renderMenu();
            showToast('Карточка перегенерирована');
        });
        actions.appendChild(regenerateBtn);

        cardDiv.appendChild(actions);
    }

    container.appendChild(cardDiv);
}

// Рендер главного меню
function renderMenu() {
    const preview = document.getElementById('cards-preview');
    preview.innerHTML = '';
    state.cards.forEach(card => renderCard(card, preview));
    document.getElementById('selected-count').textContent = `Выбрано: ${state.selectedCount}`;
    document.getElementById('start-game-btn').disabled = state.selectedCount === 0;
}

// Рендер экрана игры
function renderGame() {
    const gameCards = document.getElementById('game-cards');
    gameCards.innerHTML = '';
    state.gameCards.forEach(card => renderCard(card, gameCards, true));
}

// Переключение экрана
function switchScreen(screen) {
    state.screen = screen;
    document.getElementById('main-menu').classList.toggle('hidden', screen !== 'menu');
    document.getElementById('game-screen').classList.toggle('hidden', screen !== 'game');
}

// Переключение панели
function togglePanel(panel, open) {
    state.panels[panel] = open;
    document.getElementById(`${panel}-panel`).classList.toggle('open', open);
    document.getElementById(`${panel}-panel`).classList.toggle('hidden', !open);
}

// Выбор количества карточек
function selectCount(count) {
    state.selectedCount = count;
    state.cards = [];
    for (let i = 0; i < count; i++) {
        state.cards.push(createCard());
    }
    renderMenu();
    togglePanel('count', false);
}

// Начало игры
function startGame() {
    state.gameCards = state.cards.map(card => ({ ...card, marked: Array(3).fill().map(() => Array(9).fill(false)), wonRows: [false, false, false] }));
    state.markedCells = {};
    state.wonRows = {};
    switchScreen('game');
    renderGame();
}

// Перезапуск игры
function restartGame() {
    state.gameCards.forEach(card => {
        card.marked = Array(3).fill().map(() => Array(9).fill(false));
        card.wonRows = [false, false, false];
    });
    state.markedCells = {};
    state.wonRows = {};
    renderGame();
}

// Возврат в меню
function backToMenu() {
    switchScreen('menu');
}

// Переключение отметки клетки
function toggleMark(cardId, row, col) {
    const card = state.gameCards.find(c => c.id === cardId);
    if (!card || !card.mask[row][col]) return;
    card.marked[row][col] = !card.marked[row][col];
    renderGame();
    checkWin(card);
}

// Проверка выигрыша
function checkWin(card) {
    for (let row = 0; row < 3; row++) {
        if (card.wonRows[row]) continue;
        const markedInRow = card.marked[row].filter((marked, col) => card.mask[row][col] && marked).length;
        if (markedInRow === 5) {
            card.wonRows[row] = true;
            showWinModal();
            return;
        }
    }
}

// Показ модального окна победы
function showWinModal() {
    document.getElementById('win-modal').classList.remove('hidden');
}

// Скрытие модального окна
function hideWinModal() {
    document.getElementById('win-modal').classList.add('hidden');
}

// Продолжить игру
function continueGame() {
    hideWinModal();
}

// Перезапуск из модального
function restartFromModal() {
    hideWinModal();
    restartGame();
}

// Переключение избранного
function toggleFavorite(card) {
    card.favorite = !card.favorite;
    if (card.favorite) {
        if (!state.favorites.find(f => f.id === card.id)) {
            state.favorites.push({ ...card });
        }
        showToast('Карточка добавлена в избранное');
    } else {
        state.favorites = state.favorites.filter(f => f.id !== card.id);
        showToast('Карточка удалена из избранного');
    }
    saveToStorage();
    renderMenu();
    renderGame();
    renderFavorites();
}

// Рендер избранных
function renderFavorites() {
    const list = document.getElementById('favorites-list');
    list.innerHTML = '';
    if (state.favorites.length === 0) {
        list.innerHTML = '&lt;p&gt;Избранных карточек нет&lt;/p&gt;';
        return;
    }
    state.favorites.forEach(card => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        renderCard(card, cardDiv);
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'УБРАТЬ';
        removeBtn.addEventListener('click', () => {
            card.favorite = false;
            state.favorites = state.favorites.filter(f => f.id !== card.id);
            saveToStorage();
            renderFavorites();
            showToast('Карточка удалена из избранного');
        });
        cardDiv.appendChild(removeBtn);
        list.appendChild(cardDiv);
    });
}

// Поиск числа
function searchNumber(num) {
    if (num < 1 || num > 90) {
        showToast('Число должно быть от 1 до 90');
        return;
    }
    let found = false;
    state.gameCards.forEach(card => {
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 9; col++) {
                if (card.numbers[row][col] === num) {
                    card.marked[row][col] = true;
                    found = true;
                }
            }
        }
    });
    if (found) {
        showToast(`Число ${num} найдено и отмечено`);
        renderGame();
        state.gameCards.forEach(card => checkWin(card));
    } else {
        showToast(`Число ${num} не найдено`);
    }
}

// Показ уведомления
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Обработчики событий
document.addEventListener('DOMContentLoaded', () => {
    loadFromStorage();
    renderMenu();

    // Главное меню
    document.getElementById('select-count-btn').addEventListener('click', () => togglePanel('count', true));
    document.getElementById('start-game-btn').addEventListener('click', startGame);

    // Панель количества
    document.querySelectorAll('#count-panel .count-buttons button').forEach(btn => {
        btn.addEventListener('click', () => selectCount(parseInt(btn.dataset.count)));
    });
    document.getElementById('close-count-panel').addEventListener('click', () => togglePanel('count', false));

    // Экран игры
    document.getElementById('search-btn').addEventListener('click', () => togglePanel('search', true));
    document.getElementById('restart-btn').addEventListener('click', restartGame);
    document.getElementById('back-to-menu-btn').addEventListener('click', backToMenu);

    // Панель поиска
    document.getElementById('search-input').addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });
    document.querySelectorAll('#search-panel .keypad button[data-key]').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById('search-input');
            if (input.value.length < 2) {
                input.value += btn.dataset.key;
            }
        });
    });
    document.getElementById('clear-search').addEventListener('click', () => {
        document.getElementById('search-input').value = '';
    });
    document.getElementById('backspace-search').addEventListener('click', () => {
        const input = document.getElementById('search-input');
        input.value = input.value.slice(0, -1);
    });
    document.getElementById('check-search').addEventListener('click', () => {
        const num = parseInt(document.getElementById('search-input').value);
        if (!isNaN(num)) {
            searchNumber(num);
            document.getElementById('search-input').value = '';
        }
    });
    document.getElementById('close-search-panel').addEventListener('click', () => togglePanel('search', false));

    // Избранные
    document.getElementById('favorites-btn').addEventListener('click', () => {
        renderFavorites();
        togglePanel('favorites', true);
    });
    document.getElementById('close-favorites-panel').addEventListener('click', () => togglePanel('favorites', false));

    // Модальное
    document.getElementById('continue-btn').addEventListener('click', continueGame);
    document.getElementById('restart-modal-btn').addEventListener('click', restartFromModal);

    // Регистрация service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js');
    }
});