// js/apps.js

/**
 * Определения приложений для Windows 11 WebOS.
 * Этот объект используется system.js для создания окон и иконок на панели задач.
 *
 * Формат:
 * 'Имя Приложения': {
 * url: 'apps/имя_файла.html',
 * icon: 'FontAwesome_Class',
 * desktop: true, // Добавлять ли иконку на рабочий стол по умолчанию
 * taskbar: true  // Добавлять ли иконку на панель задач по умолчанию
 * }
 */
window.APP_MANIFEST = {
    'File Explorer': {
        url: 'apps/explorer.html',
        icon: 'fas fa-folder',
        desktop: true,
        taskbar: true
    },
    'Edge Browser': {
        url: 'apps/browser.html',
        icon: 'fab fa-edge',
        desktop: true,
        taskbar: true
    },
    'Telegram': {
        url: 'apps/telegram.html',
        icon: 'fab fa-telegram-plane',
        desktop: true,
        taskbar: true
    },
    'Microsoft Store': {
        url: 'apps/store.html',
        icon: 'fas fa-store',
        desktop: true,
        taskbar: true
    },
    'Recycle Bin': {
        url: 'apps/recycle-bin.html',
        icon: 'fas fa-trash',
        desktop: true, // Иконка на рабочем столе
        taskbar: false
    },
    'VS Code': {
        url: 'apps/vscode.html', // Нужно создать этот файл
        icon: 'fas fa-code',
        desktop: false,
        taskbar: false
    },
    'Settings': {
        url: 'apps/settings.html', // Нужно создать этот файл
        icon: 'fas fa-cog',
        desktop: false,
        taskbar: false
    }
};

/**
 * Функция для создания иконок рабочего стола на основе APP_MANIFEST.
 * Вызывается из desktop.html
 */
function initializeDesktopIcons() {
    const desktop = document.getElementById('desktop');
    if (!desktop) return;

    for (const appName in window.APP_MANIFEST) {
        const app = window.APP_MANIFEST[appName];
        if (app.desktop) {
            const iconElement = document.createElement('div');
            iconElement.className = 'desktop-icon';
            iconElement.title = appName;
            iconElement.onclick = () => parent.openAppWindow(appName, app.url);
            iconElement.innerHTML = `
                <i class="${app.icon}"></i>
                <span>${appName}</span>
            `;
            desktop.appendChild(iconElement);
        }
    }
}

/**
 * Функция для создания иконок на панели задач на основе APP_MANIFEST.
 * Вызывается из desktop.html
 */
function initializeTaskbarIcons() {
    const taskbarApps = document.getElementById('taskbar-apps');
    if (!taskbarApps) return;
    
    for (const appName in window.APP_MANIFEST) {
        const app = window.APP_MANIFEST[appName];
        if (app.taskbar) {
            const iconElement = document.createElement('div');
            iconElement.id = `taskbar-icon-${appName.replace(/\s/g, '')}`;
            iconElement.className = 'taskbar-icon';
            iconElement.title = appName;
            iconElement.onclick = () => parent.openAppWindow(appName, app.url);
            iconElement.innerHTML = `<i class="${app.icon}"></i>`;
            taskbarApps.appendChild(iconElement);
        }
    }
}
