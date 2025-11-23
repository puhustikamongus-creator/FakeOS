// js/system.js - Финальная версия (Core, IndexedDB, Drag, Resize, Win Key)

/**
 * =================================================================
 * 1. IndexedDB: Файловая система (IDBFileSystem)
 * =================================================================
 */
const DB_NAME = 'Win11FS';
const STORE_NAME = 'Files';
let db;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = (e) => {
            db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('path', 'path', { unique: false });
                store.createIndex('isDeleted', 'isDeleted', { unique: false });
                store.createIndex('parentPath', 'parentPath', { unique: false });
            }
        };

        request.onsuccess = (e) => {
            db = e.target.result;
            console.log('IndexedDB успешно открыта/создана.');
            resolve(db);
        };

        request.onerror = (e) => {
            console.error('Ошибка открытия IndexedDB:', e.target.error);
            reject(e.target.error);
        };
    });
}

function getTransaction(mode = 'readonly') {
    return db.transaction([STORE_NAME], mode).objectStore(STORE_NAME);
}

async function initFileSystem() {
    await openDB();

    const store = getTransaction('readonly');
    const countRequest = store.count();

    countRequest.onsuccess = (event) => {
        if (event.target.result === 0) {
            console.log('Файловая система пуста, инициализация...');
            const writeStore = getTransaction('readwrite');
            
            const initialFolders = [
                { name: 'Рабочий стол', type: 'folder', path: '/', parentPath: '/', isDeleted: false, icon: 'fas fa-desktop' },
                { name: 'Документы', type: 'folder', path: '/', parentPath: '/', isDeleted: false, icon: 'fas fa-file' },
                { name: 'Корзина', type: 'system', path: '/', parentPath: '/', isDeleted: false, icon: 'fas fa-trash' }, 
                { name: 'Мой Файл.txt', type: 'file', path: '/Рабочий стол', parentPath: '/Рабочий стол', content: 'Привет, это WebOS!', isDeleted: false, icon: 'fas fa-file-alt' },
                { name: 'WebOS.jpg', type: 'file', path: '/Рабочий стол', parentPath: '/Рабочий стол', content: 'Base64 image...', isDeleted: false, icon: 'fas fa-file-image' }
            ];

            initialFolders.forEach(folder => writeStore.add(folder));
            writeStore.transaction.oncomplete = () => console.log('Начальные папки созданы.');
        }
    };
}

async function getItemsByPath(path, includeDeleted = false) {
    if (!db) await openDB();
    const store = getTransaction('readonly');
    const pathIndex = store.index('path');
    
    return new Promise((resolve, reject) => {
        const items = [];
        const request = pathIndex.openCursor(IDBKeyRange.only(path));
        
        request.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
                if (includeDeleted || !cursor.value.isDeleted) {
                    items.push(cursor.value);
                }
                cursor.continue();
            } else {
                resolve(items);
            }
        };
        request.onerror = (e) => reject(e.target.error);
    });
}

async function getAllDeletedItems() {
    if (!db) await openDB();
    const store = getTransaction('readonly');
    const deleteIndex = store.index('isDeleted');

    return new Promise((resolve, reject) => {
        const items = [];
        const request = deleteIndex.openCursor(IDBKeyRange.only(true));
        
        request.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
                items.push(cursor.value);
                cursor.continue();
            } else {
                resolve(items);
            }
        };
        request.onerror = (e) => reject(e.target.error);
    });
}

async function sendToRecycleBin(id) {
    if (!db) await openDB();
    const store = getTransaction('readwrite');
    const request = store.get(id);

    return new Promise((resolve) => {
        request.onsuccess = (e) => {
            const item = e.target.result;
            if (item) {
                item.isDeleted = true;
                item.deletedAt = Date.now();
                store.put(item);
                console.log(`Файл ${item.name} отправлен в корзину.`);
            }
            store.transaction.oncomplete = resolve;
        };
    });
}

async function restoreFromRecycleBin(id) {
    if (!db) await openDB();
    const store = getTransaction('readwrite');
    const request = store.get(id);

    return new Promise((resolve) => {
        request.onsuccess = (e) => {
            const item = e.target.result;
            if (item && item.isDeleted) {
                item.isDeleted = false;
                delete item.deletedAt;
                store.put(item);
                console.log(`Файл ${item.name} восстановлен.`);
            }
            store.transaction.oncomplete = resolve;
        };
    });
}

async function deletePermanently(id) {
    if (!db) await openDB();
    const store = getTransaction('readwrite');
    store.delete(id);
    return new Promise((resolve) => {
        store.transaction.oncomplete = resolve;
    });
}

async function renameItem(id, newName) {
    if (!db) await openDB();
    const store = getTransaction('readwrite');
    const request = store.get(id);

    return new Promise((resolve) => {
        request.onsuccess = (e) => {
            const item = e.target.result;
            if (item) {
                item.name = newName;
                store.put(item);
                console.log(`Файл переименован в ${newName}.`);
            }
            store.transaction.oncomplete = resolve;
        };
    });
}


/**
 * =================================================================
 * 2. Windows Manager (Управление окнами, Drag & Resize, Win Key)
 * =================================================================
 */

window.activeWindows = {};
window.windowZIndex = 100;
window.desktop = null;

let dragItem = null;
let offset = { x: 0, y: 0 };
let resizeItem = null;
let resizeDir = '';
const MIN_WIDTH = 300;
const MIN_HEIGHT = 200;
let isStartMenuOpen = false;

document.addEventListener('DOMContentLoaded', () => {
    const desktopElement = document.getElementById('desktop');
    if (desktopElement) {
        window.desktop = desktopElement;
        initFileSystem();
        setupWinKeyHandler();
    }
    // Глобальные слушатели для перетаскивания и изменения размера
    document.addEventListener('mousemove', (e) => {
        if (dragItem) doDrag(e);
        if (resizeItem) doResize(e);
    });
    document.addEventListener('mouseup', (e) => {
        if (dragItem) endDrag(e);
        if (resizeItem) endResize(e);
    });
});

/** Обработчик нажатия клавиши Win */
function setupWinKeyHandler() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Meta' || e.key === 'OS') {
            e.preventDefault();
            toggleStartMenu();
        }
    });
}

/** Переключение Меню Пуск */
function toggleStartMenu() {
    const startMenu = document.getElementById('start-menu');
    const startButton = document.getElementById('start-button');
    if (!startMenu || !startButton) return;

    if (isStartMenuOpen) {
        startMenu.style.transform = 'translateX(-50%) translateY(100%)';
        startMenu.style.opacity = '0';
        startButton.classList.remove('active');
        setTimeout(() => { startMenu.style.display = 'none'; }, 300);
    } else {
        // Закрываем все контекстные меню перед открытием Пуск
        document.querySelectorAll('.context-menu').forEach(menu => menu.style.display = 'none');
        
        startMenu.style.display = 'flex';
        startMenu.offsetHeight; 
        startMenu.style.transform = 'translateX(-50%) translateY(0)';
        startMenu.style.opacity = '1';
        startButton.classList.add('active');
        const searchInput = document.getElementById('search-input-start');
        if(searchInput) searchInput.focus();
    }
    isStartMenuOpen = !isStartMenuOpen;
}


// --- Drag & Drop/Resize Functions (Оставлены как в предыдущих ответах) ---
function startDrag(e, windowId) {
    e.preventDefault();
    const targetWindow = window.activeWindows[windowId];
    if (targetWindow.maximized) return;

    dragItem = targetWindow.element;
    activateWindow(windowId);

    offset.x = e.clientX - dragItem.offsetLeft;
    offset.y = e.clientY - dragItem.offsetTop;

    dragItem.style.cursor = 'grabbing';
}

function doDrag(e) {
    let newX = e.clientX - offset.x;
    let newY = e.clientY - offset.y;

    newX = Math.max(0, Math.min(newX, window.innerWidth - dragItem.offsetWidth));
    newY = Math.max(0, Math.min(newY, window.innerHeight - dragItem.offsetHeight - 48));

    dragItem.style.left = newX + 'px';
    dragItem.style.top = newY + 'px';
}

function endDrag() {
    if (dragItem) {
        dragItem.style.cursor = 'grab';
        dragItem = null;
    }
}

function startResize(e, windowId, direction) {
    e.preventDefault();
    const targetWindow = window.activeWindows[windowId];
    if (targetWindow.maximized) return;

    resizeItem = targetWindow.element;
    resizeDir = direction;
    activateWindow(windowId);
    
    resizeItem.startX = e.clientX;
    resizeItem.startY = e.clientY;
    resizeItem.startW = resizeItem.offsetWidth;
    resizeItem.startH = resizeItem.offsetHeight;
    resizeItem.startL = resizeItem.offsetLeft;
    resizeItem.startT = resizeItem.offsetTop;

    document.body.style.cursor = direction === 'n' || direction === 's' ? 'ns-resize' : (direction === 'e' || direction === 'w' ? 'ew-resize' : 'nwse-resize');
}

function doResize(e) {
    let dx = e.clientX - resizeItem.startX;
    let dy = e.clientY - resizeItem.startY;
    let newW = resizeItem.startW;
    let newH = resizeItem.startH;
    let newL = resizeItem.startL;
    let newT = resizeItem.startT;

    if (resizeDir.includes('e')) {
        newW = Math.max(MIN_WIDTH, resizeItem.startW + dx);
    }
    if (resizeDir.includes('s')) {
        newH = Math.max(MIN_HEIGHT, resizeItem.startH + dy);
    }
    if (resizeDir.includes('w')) {
        newW = Math.max(MIN_WIDTH, resizeItem.startW - dx);
        if (newW > MIN_WIDTH) newL = resizeItem.startL + dx;
    }
    if (resizeDir.includes('n')) {
        newH = Math.max(MIN_HEIGHT, resizeItem.startH - dy);
        if (newH > MIN_HEIGHT) newT = resizeItem.startT + dy;
    }

    if (newW > MIN_WIDTH) resizeItem.style.width = newW + 'px';
    if (newH > MIN_HEIGHT) resizeItem.style.height = newH + 'px';
    if (newL !== resizeItem.startL) resizeItem.style.left = newL + 'px';
    if (newT !== resizeItem.startT) resizeItem.style.top = newT + 'px';
}

function endResize() {
    if (resizeItem) {
        resizeItem = null;
        resizeDir = '';
        document.body.style.cursor = 'default';
    }
}

// --- Window Management Functions ---

function openAppWindow(appName, appUrl) {
    const windowId = appName.replace(/\s/g, ''); 
    if (window.activeWindows[windowId]) {
        activateWindow(windowId);
        return;
    }

    window.windowZIndex++;
    const initialX = 100 + (Object.keys(window.activeWindows).length % 5) * 20;
    const initialY = 50 + (Object.keys(window.activeWindows).length % 5) * 20;
    
    const newWindow = document.createElement('div');
    newWindow.id = windowId;
    newWindow.className = 'app-window';
    newWindow.style.left = `${initialX}px`;
    newWindow.style.top = `${initialY}px`;
    newWindow.style.zIndex = window.windowZIndex;

    const appEntry = window.APP_MANIFEST[appName];
    const icon = appEntry ? appEntry.icon : 'fas fa-cogs';

    newWindow.innerHTML = `
        <div class="titlebar" onmousedown="startDrag(event, '${windowId}')">
            <div class="title-text"><i class="${icon}"></i> ${appName}</div>
            <div class="controls">
                <button onclick="minimizeWindow('${windowId}')" class="control-btn"><i class="fas fa-minus"></i></button>
                <button onclick="maximizeWindow('${windowId}')" class="control-btn"><i class="far fa-square"></i></button>
                <button onclick="closeWindow('${windowId}')" class="control-btn close"><i class="fas fa-times"></i></button>
            </div>
        </div>
        <div class="window-content-wrapper">
            <iframe src="${appUrl}" frameborder="0" class="app-iframe"></iframe>
        </div>
        <div class="resize-handle n" onmousedown="startResize(event, '${windowId}', 'n')"></div>
        <div class="resize-handle e" onmousedown="startResize(event, '${windowId}', 'e')"></div>
        <div class="resize-handle s" onmousedown="startResize(event, '${windowId}', 's')"></div>
        <div class="resize-handle w" onmousedown="startResize(event, '${windowId}', 'w')"></div>
        <div class="resize-handle nw" onmousedown="startResize(event, '${windowId}', 'nw')"></div>
        <div class="resize-handle ne" onmousedown="startResize(event, '${windowId}', 'ne')"></div>
        <div class="resize-handle sw" onmousedown="startResize(event, '${windowId}', 'sw')"></div>
        <div class="resize-handle se" onmousedown="startResize(event, '${windowId}', 'se')"></div>
    `;

    window.desktop.appendChild(newWindow);
    window.activeWindows[windowId] = {
        element: newWindow,
        maximized: false,
        lastX: initialX,
        lastY: initialY,
        lastW: newWindow.offsetWidth,
        lastH: newWindow.offsetHeight,
    };
    
    newWindow.addEventListener('mousedown', () => activateWindow(windowId));
    
    // Создаем иконку на панели задач, если её там еще нет (для запуска из меню)
    const taskbarApps = document.getElementById('taskbar-apps');
    if (taskbarApps && !document.getElementById(`taskbar-icon-${windowId}`)) {
        const taskIcon = document.createElement('div');
        taskIcon.id = `taskbar-icon-${windowId}`;
        taskIcon.className = 'taskbar-icon';
        taskIcon.title = appName;
        taskIcon.innerHTML = `<i class="${icon}"></i>`;
        taskIcon.onclick = () => toggleWindow(windowId);
        taskbarApps.appendChild(taskIcon);
    }
    
    activateWindow(windowId);
}

function activateWindow(windowId) {
    if (!window.activeWindows[windowId]) return;

    document.querySelectorAll('#taskbar-center .taskbar-icon').forEach(icon => icon.classList.remove('active'));
    document.querySelectorAll('.app-window').forEach(win => win.classList.remove('active'));

    window.windowZIndex++;
    
    const win = window.activeWindows[windowId];
    win.element.classList.add('active');
    win.element.style.zIndex = window.windowZIndex;
    
    const taskIcon = document.getElementById(`taskbar-icon-${windowId}`);
    if (taskIcon) taskIcon.classList.add('active');
}

function closeWindow(windowId) {
    const win = window.activeWindows[windowId];
    if (win) {
        win.element.remove();
        const taskIcon = document.getElementById(`taskbar-icon-${windowId}`);
        if (taskIcon) taskIcon.remove();
        
        delete window.activeWindows[windowId];
        
        const remaining = Object.keys(window.activeWindows);
        if (remaining.length > 0) activateWindow(remaining[remaining.length - 1]);
        
        // Пересоздаем иконки панели задач, чтобы вернуть закрепленные
        window.initializeTaskbarIcons();
    }
}

function minimizeWindow(windowId) {
    const win = window.activeWindows[windowId];
    if (win) {
        win.element.style.display = 'none';
        win.element.classList.remove('active');
        const taskIcon = document.getElementById(`taskbar-icon-${windowId}`);
        if (taskIcon) taskIcon.classList.remove('active');
    }
}

function toggleWindow(windowId) {
    const win = window.activeWindows[windowId];
    if (!win) return;

    if (win.element.style.display === 'none' || !win.element.classList.contains('active')) {
        win.element.style.display = 'block';
        activateWindow(windowId);
    } else {
        minimizeWindow(windowId);
    }
}

function maximizeWindow(windowId) {
    const win = window.activeWindows[windowId];
    if (!win) return;

    if (win.maximized) {
        win.element.style.top = `${win.lastY}px`;
        win.element.style.left = `${win.lastX}px`;
        win.element.style.width = `${win.lastW}px`;
        win.element.style.height = `${win.lastH}px`;
        win.element.style.borderRadius = '8px';
        win.element.style.transition = 'width 0.2s, height 0.2s, top 0.2s, left 0.2s';
    } else {
        win.lastX = win.element.offsetLeft;
        win.lastY = win.element.offsetTop;
        win.lastW = win.element.offsetWidth;
        win.lastH = win.element.offsetHeight;

        win.element.style.transition = 'width 0.2s, height 0.2s, top 0.2s, left 0.2s';
        win.element.style.top = '0';
        win.element.style.left = '0';
        win.element.style.width = '100%';
        win.element.style.height = 'calc(100% - 48px)';
        win.element.style.borderRadius = '0';
    }
    win.maximized = !win.maximized;
    activateWindow(windowId);
    setTimeout(() => { win.element.style.transition = ''; }, 200);
}
