/**
 * auth.js — Система аутентификации калькулятора
 *
 * Пароль хранится только в виде SHA-256 хэша.
 * Исходный пароль нигде в коде не фигурирует — безопасно для GitHub.
 *
 * Логин: admin
 * Хэш пароля (SHA-256): хранится ниже
 */

(function () {
    // SHA-256 хэш пароля. Сам пароль нигде не хранится.
    const ADMIN_LOGIN_HASH = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';
    const ADMIN_PASS_HASH  = 'b8f5e8a1e803c43b521a45115cbb239a405320427b2c4975e052203953d2f407';

    // Сессионная переменная роли (не сохраняется между вкладками намеренно)
    window.APP_ROLE = null; // 'guest' | 'admin'

    const loginScreen  = document.getElementById('loginScreen');
    const appContainer = document.getElementById('appContainer');
    const adminBadge   = document.getElementById('adminBadge');
    const adminToggleBtn = document.getElementById('adminToggleBtn');
    const btnLogout    = document.getElementById('btnLogout');

    const btnGuestLogin    = document.getElementById('btnGuestLogin');
    const btnShowAdminForm = document.getElementById('btnShowAdminForm');
    const btnCancelAdmin   = document.getElementById('btnCancelAdmin');
    const btnAdminLogin    = document.getElementById('btnAdminLogin');
    const adminLoginForm   = document.getElementById('adminLoginForm');
    const adminLoginInput  = document.getElementById('adminLoginInput');
    const adminPasswordInput = document.getElementById('adminPasswordInput');
    const loginError       = document.getElementById('loginError');

    /** SHA-256 через Web Crypto API (встроен во все современные браузеры) */
    async function sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /** Запуск приложения с заданной ролью */
    function launchApp(role) {
        window.APP_ROLE = role;
        loginScreen.style.display  = 'none';
        appContainer.style.display = 'block';

        if (role === 'admin') {
            adminBadge.style.display     = 'inline-flex';
            adminToggleBtn.style.display = 'inline-flex';
        } else {
            adminBadge.style.display     = 'none';
            adminToggleBtn.style.display = 'none';
        }
    }

    // --- Войти как гость ---
    btnGuestLogin.addEventListener('click', () => {
        launchApp('guest');
    });

    // --- Показать форму входа администратора ---
    btnShowAdminForm.addEventListener('click', () => {
        adminLoginForm.style.display = 'block';
        btnShowAdminForm.style.display = 'none';
        adminLoginInput.focus();
    });

    btnCancelAdmin.addEventListener('click', () => {
        adminLoginForm.style.display = 'none';
        btnShowAdminForm.style.display = 'block';
        loginError.style.display = 'none';
        adminLoginInput.value = '';
        adminPasswordInput.value = '';
    });

    // --- Войти как администратор ---
    async function attemptAdminLogin() {
        const login = adminLoginInput.value.trim();
        const pass  = adminPasswordInput.value;

        if (!login || !pass) {
            loginError.textContent = 'Введите логин и пароль';
            loginError.style.display = 'block';
            return;
        }

        btnAdminLogin.disabled = true;
        btnAdminLogin.textContent = 'Проверка...';

        try {
            const loginHash = await sha256(login);
            const passHash  = await sha256(pass);

            if (loginHash === ADMIN_LOGIN_HASH && passHash === ADMIN_PASS_HASH) {
                loginError.style.display = 'none';
                launchApp('admin');
            } else {
                loginError.textContent = 'Неверный логин или пароль';
                loginError.style.display = 'block';
                adminPasswordInput.value = '';
                adminPasswordInput.focus();
            }
        } finally {
            btnAdminLogin.disabled = false;
            btnAdminLogin.textContent = 'Войти';
        }
    }

    btnAdminLogin.addEventListener('click', attemptAdminLogin);

    adminPasswordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') attemptAdminLogin();
    });

    // --- Выход ---
    btnLogout.addEventListener('click', () => {
        window.APP_ROLE = null;
        adminLoginInput.value = '';
        adminPasswordInput.value = '';
        loginError.style.display = 'none';
        adminLoginForm.style.display = 'none';
        btnShowAdminForm.style.display = 'block';
        appContainer.style.display = 'none';
        loginScreen.style.display  = 'flex';
    });

})();
