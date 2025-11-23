// js/apps.js - Расширенный манифест приложений и логика создания иконок
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
        desktop: true,
        taskbar: false
    },
    'Settings': {
        url: 'apps/settings.html',
        icon: 'fas fa-cog',
        desktop: false,
        taskbar: true
    },
    // --- Приложения из магазина (для динамической установки) ---
    'VS Code': {
        url: 'apps/vscode.html',
        icon: 'fas fa-code',
        desktop: false,
        taskbar: false
    },
    'Spotify': {
        url: 'apps/spotify.html',
        icon: 'fab fa-spotify',
        desktop: false,
        taskbar: false
    },
    'WhatsApp': {
        url: 'apps/whatsapp.html',
        icon: 'fab fa-whatsapp',
        desktop: false,
        taskbar: false
    }
};

/**
 * Создание иконок рабочего стола
 */
function initializeDesktopIcons() {
    const desktop = document.getElementById('desktop');
    if (!desktop) return;
    
    // Удаляем старые иконки, чтобы избежать дублирования
    const existingIcons = desktop.querySelectorAll('.desktop-icon');
    existingIcons.forEach(icon => icon.remove());

    for (const appName in window.APP_MANIFEST) {
        const app = window.APP_MANIFEST[appName];
        if (app.desktop) {
            const iconElement = document.createElement('div');
            iconElement.className = 'desktop-icon';
            iconElement.title = appName;
            // Используем parent.openAppWindow, так как эта функция находится в system.js
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
 * Создание иконок на панели задач (Taskbar)
 */
function initializeTaskbarIcons() {
    const taskbarApps = document.getElementById('taskbar-apps');
    if (!taskbarApps) return;
    
    // Удаляем только закрепленные иконки, открытые окна сохраняют свои иконки
    const existingTaskbarIcons = taskbarApps.querySelectorAll('.taskbar-icon:not(.active-app-icon):not(#start-button)');
    existingTaskbarIcons.forEach(icon => icon.remove());


    for (const appName in window.APP_MANIFEST) {
        const app = window.APP_MANIFEST[appName];
        const windowId = appName.replace(/\s/g, '');
        
        // Если приложение закреплено (taskbar: true) и еще не открыто как окно
        if (app.taskbar && !parent.document.getElementById(`taskbar-icon-${windowId}`)) { 
            const iconElement = document.createElement('div');
            iconElement.id = `taskbar-icon-${windowId}`;
            iconElement.className = 'taskbar-icon';
            iconElement.title = appName;
            iconElement.onclick = () => parent.openAppWindow(appName, app.url);
            iconElement.innerHTML = `<i class="${app.icon}"></i>`;
            taskbarApps.appendChild(iconElement);
        }
    }
}
