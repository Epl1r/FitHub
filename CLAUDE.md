# FitHub — мини-приложение Telegram

Полная карта проекта (облачная функция, бот, оплаты, хранилище, статистика) — в закрытом репозитории
Epl1r/FitHub-server, файл CLAUDE.md. Перед утверждениями про бота или сервер — читать код там.

## Этот репозиторий
- `index.html` — всё приложение одним файлом (HTML, CSS, JS). Публикуется GitHub Pages: https://epl1r.github.io/FitHub/
- `privacy.html` — политика конфиденциальности.

## Устройство index.html
- Вкладки: `tab-home`, `tab-cal`, `tab-train`, `tab-food`, `tab-profile`; нижнее меню `nav [data-tab]`.
- Данные пользователя — в localStorage (ключи `fithub_*`, например `fithub_lifts` — веса по упражнениям,
  `fithub_theme` — тема), копия — в Telegram CloudStorage.
- Сервер: константа `AI_ENDPOINT` (облачная функция Yandex). Действия: chat, digest_now, feedback, reminders,
  seen, stat, а также фото еды без action.
- Статистика: `track(событие)` → Яндекс Метрика (113832857) и action `stat` в функцию.
- Карточка «Сводка для автора» (id `ownerCard`) видна только владельцу (Telegram id 5517755450).
- Арни: чат с ИИ через action `chat`; заготовленные ответы — массив `RULES`, функция `localAnswer`.

## Как выкладывать
Правка → проверка в Playwright (эмуляция iPhone 13, тёмная и светлая тема, без ошибок в консоли) → коммит
и push в main → проверить, что https://epl1r.github.io/FitHub/ отдаёт новую версию.
