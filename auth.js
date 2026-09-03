/**
 * auth.js — Система аутентификации калькулятора
 *
 * Пароли хранятся только в виде SHA-256 хэшей. Исходные пароли нигде в коде не фигурируют.
 *
 * Роли:
 *  - admin — логин/пароль администратора (захардкожены хэшем ниже, меняются только через код)
 *  - guest — сотрудник из списка staff.json (управляется через админ-панель "Сотрудники")
 *
 * Открытого входа без пароля больше нет — весь доступ только по логину и паролю.
 */

(function () {
    // SHA-256 хэш пароля администратора. Сам пароль нигде не хранится.
    const ADMIN_LOGIN_HASH = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';
    const ADMIN_PASS_HASH  = 'b8f5e8a1e803c43b521a45115cbb239a405320427b2c4975e052203953d2f407';

    // Сессионная переменная роли (не сохраняется между вкладками намеренно)
    window.APP_ROLE = null;   // 'guest' | 'admin'
    window.APP_STAFF_NAME = null; // имя вошедшего сотрудника (для роли 'guest')

    // ---- Список сотрудников (staff.json) ----
    let STAFF_LIST = [];
    let staffLoadedPromise = null;

    async function loadStaffList() {
        let list = [];
        try {
            const res = await fetch('./staff.json', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                if (data && Array.isArray(data.employees)) {
                    list = data.employees;
                }
            }
        } catch (e) {
            console.warn('staff.json не загрузился:', e);
        }
        // Черновик из админки (если есть) имеет приоритет — как и у материалов.
        try {
            const draft = localStorage.getItem('mobistroy_staff_draft');
            if (draft) {
                const parsed = JSON.parse(draft);
                if (parsed && Array.isArray(parsed.employees)) {
                    list = parsed.employees;
                }
            }
        } catch (e) { /* ignore corrupt draft */ }
        STAFF_LIST = list;
        return STAFF_LIST;
    }

    function ensureStaffLoaded() {
        if (!staffLoadedPromise) {
            staffLoadedPromise = loadStaffList();
        }
        return staffLoadedPromise;
    }
    ensureStaffLoaded(); // начинаем загрузку сразу, не дожидаясь попытки входа

    // Публичный API для админ-панели (app.js) — управление списком сотрудников
    window.STAFF_API = {
        getList: () => STAFF_LIST,
        setList: (list) => { STAFF_LIST = list; },
        reload: async () => { staffLoadedPromise = null; return ensureStaffLoaded(); },
        saveDraft: () => {
            localStorage.setItem('mobistroy_staff_draft', JSON.stringify({ employees: STAFF_LIST }));
        },
        clearDraft: () => { localStorage.removeItem('mobistroy_staff_draft'); }
    };

    const loginScreen  = document.getElementById('loginScreen');
    const appContainer = document.getElementById('appContainer');
    const adminBadge   = document.getElementById('adminBadge');
    const adminToggleBtn = document.getElementById('adminToggleBtn');
    const materialsToggleBtn = document.getElementById('materialsToggleBtn');
    const syncToggleBtn = document.getElementById('syncToggleBtn');
    const staffToggleBtn = document.getElementById('staffToggleBtn');
    const btnLogout    = document.getElementById('btnLogout');

    const btnAdminLogin    = document.getElementById('btnAdminLogin');
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
    window.sha256ForAuth = sha256; // тот же хэш переиспользуем в админ-панели при создании сотрудников

    /** Запуск приложения с заданной ролью */
    function launchApp(role, staffName) {
        window.APP_ROLE = role;
        window.APP_STAFF_NAME = staffName || null;
        loginScreen.style.display  = 'none';
        appContainer.style.display = 'block';

        if (role === 'admin') {
            adminBadge.style.display     = 'inline-flex';
            adminToggleBtn.style.display = 'inline-flex';
            if (materialsToggleBtn) materialsToggleBtn.style.display = 'inline-flex';
            if (syncToggleBtn) syncToggleBtn.style.display = 'inline-flex';
            if (staffToggleBtn) staffToggleBtn.style.display = 'inline-flex';
        } else {
            adminBadge.style.display     = 'none';
            adminToggleBtn.style.display = 'none';
            if (materialsToggleBtn) materialsToggleBtn.style.display = 'none';
            if (syncToggleBtn) syncToggleBtn.style.display = 'none';
            if (staffToggleBtn) staffToggleBtn.style.display = 'none';
        }
    }

    // --- Вход (проверяется и против администратора, и против списка сотрудников) ---
    async function attemptLogin() {
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
                return;
            }

            await ensureStaffLoaded();
            const staffMatch = STAFF_LIST.find(s => s.loginHash === loginHash && s.passHash === passHash);
            if (staffMatch) {
                loginError.style.display = 'none';
                launchApp('guest', staffMatch.name);
                return;
            }

            loginError.textContent = 'Неверный логин или пароль';
            loginError.style.display = 'block';
            adminPasswordInput.value = '';
            adminPasswordInput.focus();
        } finally {
            btnAdminLogin.disabled = false;
            btnAdminLogin.textContent = 'Войти';
        }
    }

    btnAdminLogin.addEventListener('click', attemptLogin);

    adminPasswordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') attemptLogin();
    });
    adminLoginInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') attemptLogin();
    });

    // --- Выход ---
    btnLogout.addEventListener('click', () => {
        window.APP_ROLE = null;
        window.APP_STAFF_NAME = null;
        adminLoginInput.value = '';
        adminPasswordInput.value = '';
        loginError.style.display = 'none';
        appContainer.style.display = 'none';
        loginScreen.style.display  = 'flex';
    });

})();
