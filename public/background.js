// background.js

// Открываем страницу расширения при старте Firefox
browser.runtime.onStartup.addListener(() => {
  console.log('Firefox started, opening extension page...');
  openExtensionPage();
});

// Также открываем при установке/обновлении расширения
browser.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed/updated:', details.reason);
  if (details.reason === 'install' || details.reason === 'update') {
    openExtensionPage();
  }
});

// Обработчик клика по иконке расширения
browser.browserAction.onClicked.addListener(() => {
  openExtensionPage();
});

// Функция открытия страницы расширения
async function openExtensionPage() {
  try {
    // Получаем URL страницы новой вкладки расширения
    const extensionPage = browser.runtime.getURL('index.html');
    
    // Проверяем, открыта ли уже эта страница
    const tabs = await browser.tabs.query({ url: extensionPage });
    
    if (tabs.length > 0) {
      // Если страница уже открыта, активируем её
      await browser.tabs.update(tabs[0].id, { active: true });
      await browser.windows.update(tabs[0].windowId, { focused: true });
    } else {
      // Иначе открываем новую вкладку
      await browser.tabs.create({ url: 'index.html' });
    }
  } catch (error) {
    console.error('Error opening extension page:', error);
  }
}

// Обработка контекстного меню (опционально)
browser.contextMenus.create({
  id: "open-bookmarks",
  title: "Открыть панель закладок",
  contexts: ["browser_action"]
});

browser.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "open-bookmarks") {
    openExtensionPage();
  }
});