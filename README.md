# Мой Личный Хаб — нативное приложение (Capacitor)

PWA-приложение, обёрнутое в нативное Android-приложение через Capacitor.
Поддерживает фоновый шагомер (акселерометр), геолокацию (трекинг маршрута), локальные уведомления.

## Структура
- `www/` — веб-приложение (HTML/CSS/JS)
- `capacitor.config.json` — конфигурация Capacitor
- `.github/workflows/build.yml` — автосборка APK через GitHub Actions

## Локальная сборка (нужен Node.js + Android Studio)
```bash
npm install
npx cap add android
npx cap sync
npx cap open android   # откроет Android Studio
```
В Android Studio: Build → Build APK.

## Сборка через GitHub Actions (без установки)
1. Создайте репозиторий на GitHub и загрузите содержимое этой папки (`lifehub-app`).
2. Вкладка Actions → workflow "Build Android APK" запустится автоматически при push.
3. После завершения скачайте APK из Artifacts (lifehub-debug-apk).

## Установка APK на телефон
1. Скачайте APK на телефон.
2. Разрешите установку из неизвестных источников (Настройки → Безопасность).
3. Установите APK.

## Разрешения
При первом запуске приложение запросит:
- Доступ к датчику движения (шагомер)
- Доступ к геолокации (прогулки)
- Разрешение на уведомления

## Данные
Хранятся локально на устройстве (localStorage). Экспорт/импорт через Настройки.