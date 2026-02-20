<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import BookmarkButton from './components/BookmarkButton.vue'
import FolderSection from './components/FolderSection.vue'

const currentTime = ref('')
const currentDate = ref('')
const error = ref('')
const loading = ref(true)
const availableFolders = ref([])
const selectedFolderId = ref(null)

const rootBookmarks = ref([])
const rootFolders = ref([])

const settings = ref({
  theme: 'purple',
  backgroundType: 'theme',
  backgroundColor: '#1a1a2e',
  backgroundImage: '',
  backgroundBlur: 10,
  cardBlur: 10,
  bookmarksPerRow: 6,
  isLightTheme: false,
  rootFolderId: null,
  hideEmptyFolders: false,
  compactMode: false  // Новый параметр: компактный режим
})

const customFavicons = ref({})
const contextMenu = ref({ show: false, x: 0, y: 0, bookmark: null })
const faviconUrlInput = ref('')
const showFaviconUrlInput = ref(false)
const showSettings = ref(false)

const themes = { 
  purple: { primary: '#7b2cbf', accent: '#a855f7', bg: '#1a1a2e', bgLight: '#f3e8ff' },
  blue: { primary: '#1e3a8a', accent: '#3b82f6', bg: '#0f172a', bgLight: '#dbeafe' },
  green: { primary: '#14532d', accent: '#22c55e', bg: '#052e16', bgLight: '#dcfce7' },
  pink: { primary: '#831843', accent: '#ec4899', bg: '#3b0724', bgLight: '#fce7f3' },
  gray: { primary: '#374151', accent: '#9ca3af', bg: '#111827', bgLight: '#f3f4f6' },
  yellow: { primary: '#713f12', accent: '#eab308', bg: '#282206', bgLight: '#fef9c3' },
  red: { primary: '#7f1d1d', accent: '#ef4444', bg: '#2a0a0a', bgLight: '#fee2e2' }
}

const currentTheme = computed(() => themes[settings.value.theme] || themes.purple)

const appBackground = computed(() => {
  if (settings.value.backgroundType === 'image' && settings.value.backgroundImage) {
    return {
      backgroundImage: `url(${settings.value.backgroundImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed'
    }
  } else if (settings.value.backgroundType === 'color') {
    return { backgroundColor: settings.value.backgroundColor }
  } else {
    return { 
      backgroundColor: settings.value.isLightTheme 
        ? currentTheme.value.bgLight 
        : currentTheme.value.bg 
    }
  }
})

const containerWidth = computed(() => {
  const bookmarkWidth = 220
  const gap = 16
  const padding = 80
  return (settings.value.bookmarksPerRow * bookmarkWidth) + ((settings.value.bookmarksPerRow - 1) * gap) + padding
})

const textColor = computed(() => settings.value.isLightTheme ? '#1f2937' : '#eaeaea')
const textColorSecondary = computed(() => settings.value.isLightTheme ? 'rgba(31, 41, 55, 0.7)' : 'rgba(234, 234, 234, 0.7)')
const accentColor = computed(() => currentTheme.value.accent)

const cardBg = computed(() => {
  if (settings.value.backgroundType === 'image') {
    return settings.value.isLightTheme 
      ? 'rgba(255, 255, 255, 0.75)' 
      : 'rgba(0, 0, 0, 0.4)'
  }
  return settings.value.isLightTheme 
    ? 'rgba(255, 255, 255, 0.6)' 
    : 'rgba(255, 255, 255, 0.03)'
})

const cardBorder = computed(() => settings.value.isLightTheme 
  ? 'rgba(31, 41, 55, 0.15)' 
  : 'rgba(255, 255, 255, 0.08)')

// Computed свойства для компактного режима
const containerGap = computed(() => settings.value.compactMode ? '0px' : '10px')
const folderSectionBg = computed(() => settings.value.compactMode ? 'transparent' : 'rgba(255,255,255,0.03)')
const folderSectionBorder = computed(() => settings.value.compactMode ? 'none' : '1px solid var(--card-border)')
const folderSectionPadding = computed(() => settings.value.compactMode ? '20px 20px 5px 20px' : '20px')
const rootSectionBg = computed(() => {
  if (settings.value.compactMode) return 'transparent'
  return `color-mix(in srgb, ${currentTheme.value.accent} 8%, transparent)`
})
const rootSectionBorder = computed(() => {
  if (settings.value.compactMode) return 'none'
  return `1px solid color-mix(in srgb, ${currentTheme.value.accent} 20%, transparent)`
})

const updateTime = () => {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  currentDate.value = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
}

const loadSettings = async () => {
  try {
    const result = await browser.storage.local.get(['settings', 'customFavicons'])
    if (result.settings) {
      settings.value = { ...settings.value, ...result.settings }
      if (settings.value.rootFolderId) selectedFolderId.value = settings.value.rootFolderId
    }
    if (result.customFavicons) {
      customFavicons.value = result.customFavicons
    }
  } catch (err) { console.error('Error loading settings:', err) }
}

const saveSettings = async () => {
  try {
    await browser.storage.local.set({ 
      settings: { ...settings.value, rootFolderId: selectedFolderId.value } 
    })
  } catch (err) { console.error('Error saving settings:', err) }
}

const saveCustomFavicons = async () => {
  try {
    const faviconsToSave = JSON.parse(JSON.stringify(customFavicons.value))
    await browser.storage.local.set({ customFavicons: faviconsToSave })
    console.log('Custom favicons saved:', Object.keys(faviconsToSave).length)
  } catch (err) { console.error('Error saving custom favicons:', err) }
}

watch(() => customFavicons.value, (newVal) => {
  console.log('customFavicons changed:', Object.keys(newVal).length)
  saveCustomFavicons()
}, { deep: true })

watch(settings, saveSettings, { deep: true })
watch(selectedFolderId, saveSettings)

const getAvailableFolders = async () => {
  try {
    const tree = await browser.bookmarks.getTree()
    const root = tree[0]
    availableFolders.value = (root.children || [])
      .filter(node => !node.url)
      .map(node => ({
        id: node.id,
        title: node.title || 'Без названия',
        childrenCount: node.children?.length || 0
      }))
    if (!selectedFolderId.value && availableFolders.value.length > 0) {
      const toolbarFolder = availableFolders.value.find(f => f.title.includes('Панель') || f.title.includes('Toolbar') || f.title.includes('Избранного'))
      selectedFolderId.value = toolbarFolder ? toolbarFolder.id : availableFolders.value[0].id
    }
  } catch (err) { console.error('Error getting folders:', err) }
}

const loadRootContent = async () => {
  try {
    loading.value = true
    if (!selectedFolderId.value) {
      await getAvailableFolders()
      if (!selectedFolderId.value) { error.value = 'Нет доступных папок с закладками'; return }
    }
    
    const children = await browser.bookmarks.getChildren(selectedFolderId.value)
    rootBookmarks.value = children.filter(item => item.url)
    
    let folders = children.filter(item => !item.url)
    
    if (settings.value.hideEmptyFolders) {
      const nonEmptyFolders = []
      for (const folder of folders) {
        try {
          const folderChildren = await browser.bookmarks.getChildren(folder.id)
          if (folderChildren.length > 0) {
            nonEmptyFolders.push(folder)
          }
        } catch (e) {
          nonEmptyFolders.push(folder)
        }
      }
      folders = nonEmptyFolders
    }
    
    rootFolders.value = folders
    error.value = ''
  } catch (err) {
    error.value = err.message
    console.error('Error loading bookmarks:', err)
  } finally { loading.value = false }
}

const handleImageUpload = (event) => {
  const file = event.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      settings.value.backgroundImage = e.target.result
      settings.value.backgroundType = 'image'
    }
    reader.readAsDataURL(file)
  }
}

const changeFolder = async (folderId) => { selectedFolderId.value = folderId; await loadRootContent() }
const changeBackgroundType = (type) => { settings.value.backgroundType = type }
const changeTheme = (themeKey) => {
  settings.value.theme = themeKey
  if (settings.value.backgroundType === 'theme') {
    settings.value.backgroundColor = settings.value.isLightTheme ? themes[themeKey].bgLight : themes[themeKey].bg
  }
}

const toggleHideEmptyFolders = async () => {
  settings.value.hideEmptyFolders = !settings.value.hideEmptyFolders
  await loadRootContent()
}

// Новый тумблер компактного режима
const toggleCompactMode = () => {
  settings.value.compactMode = !settings.value.compactMode
}

const showContextMenu = (event, bookmark) => {
  if (!bookmark.url) return
  contextMenu.value = { show: true, x: event.clientX, y: event.clientY, bookmark: bookmark }
  showFaviconUrlInput.value = false
  faviconUrlInput.value = ''
}

const hideContextMenu = () => { contextMenu.value.show = false; showFaviconUrlInput.value = false }

const handleCustomFaviconUpload = (event) => {
  const file = event.target.files[0]
  if (file && contextMenu.value.bookmark) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const newFavicons = { ...customFavicons.value }
      newFavicons[contextMenu.value.bookmark.id] = e.target.result
      customFavicons.value = newFavicons
      console.log('Added favicon for bookmark:', contextMenu.value.bookmark.id)
      hideContextMenu()
    }
    reader.readAsDataURL(file)
  }
}

const addFaviconFromUrl = () => {
  if (faviconUrlInput.value && contextMenu.value.bookmark) {
    const newFavicons = { ...customFavicons.value }
    newFavicons[contextMenu.value.bookmark.id] = faviconUrlInput.value
    customFavicons.value = newFavicons
    console.log('Added favicon URL for bookmark:', contextMenu.value.bookmark.id)
    hideContextMenu()
  }
}

const removeCustomFavicon = () => {
  if (contextMenu.value.bookmark) {
    const newFavicons = { ...customFavicons.value }
    delete newFavicons[contextMenu.value.bookmark.id]
    customFavicons.value = newFavicons
    hideContextMenu()
  }
}

const openBookmarkInNewTab = () => {
  if (contextMenu.value.bookmark?.url) { browser.tabs.create({ url: contextMenu.value.bookmark.url }); hideContextMenu() }
}

const copyBookmarkUrl = () => {
  if (contextMenu.value.bookmark?.url) { navigator.clipboard.writeText(contextMenu.value.bookmark.url); hideContextMenu() }
}

onMounted(() => {
  updateTime()
  setInterval(updateTime, 1000)
  loadSettings().then(() => { getAvailableFolders().then(() => { loadRootContent() }) })
  document.addEventListener('click', hideContextMenu)
})
</script>

<template>
  <div class="app-wrapper">
    <div class="background-layer" :style="[{ filter: settings.backgroundType === 'image' ? `blur(${settings.backgroundBlur}px)` : 'none' }, appBackground]"></div>
    
    <div class="app-container" :style="{
      '--text-color': textColor,
      '--text-color-secondary': textColorSecondary,
      '--accent-color': accentColor,
      '--card-bg': cardBg,
      '--card-border': cardBorder,
      '--card-blur': settings.cardBlur + 'px',
      '--theme-accent': accentColor,
      '--theme-primary': currentTheme.primary,
      '--container-gap': containerGap,
      '--folder-bg': folderSectionBg,
      '--folder-border': folderSectionBorder,
      '--folder-padding': folderSectionPadding,
      '--root-bg': rootSectionBg,
      '--root-border': rootSectionBorder
    }" @click="hideContextMenu">
      
      <button class="settings-btn" @click.stop="showSettings = !showSettings">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </button>
      
      <transition name="fade">
        <div v-if="showSettings" class="settings-panel" @click.stop>
          <h3>Настройки</h3>
          
          <div class="setting-group">
            <label>Тема интерфейса</label>
            <div class="theme-toggle">
              <button :class="['theme-toggle-btn', { active: !settings.isLightTheme }]" @click="settings.isLightTheme = false">🌙 Тёмная</button>
              <button :class="['theme-toggle-btn', { active: settings.isLightTheme }]" @click="settings.isLightTheme = true">☀️ Светлая</button>
            </div>
          </div>
          
          <!-- Новый тумблер режима отображения -->
          <div class="setting-group">
            <label>Режим отображения</label>
            <div class="theme-toggle">
              <button :class="['theme-toggle-btn', { active: !settings.compactMode }]" @click="toggleCompactMode">Обычный</button>
              <button :class="['theme-toggle-btn', { active: settings.compactMode }]" @click="toggleCompactMode">Компактный</button>
            </div>
          </div>
          
          <div class="setting-group">
            <label>Корневая папка закладок</label>
            <select v-model="selectedFolderId" @change="changeFolder(selectedFolderId)" class="folder-select">
              <option v-for="folder in availableFolders" :key="folder.id" :value="folder.id">{{ folder.title }} ({{ folder.childrenCount }})</option>
            </select>
          </div>
          
          <div class="setting-group">
            <label>Цветовая тема</label>
            <div class="theme-selector">
              <button v-for="(theme, key) in themes" :key="key" :class="['theme-btn', { active: settings.theme === key }]" :style="{ background: theme.primary }" @click="changeTheme(key)"/>
            </div>
          </div>

          <div class="setting-group">
            <label>Фон</label>
            <div class="bg-selector">
              <button :class="{ active: settings.backgroundType === 'theme' }" @click="changeBackgroundType('theme')">Тема</button>
              <button :class="{ active: settings.backgroundType === 'color' }" @click="changeBackgroundType('color')">Цвет</button>
              <button :class="{ active: settings.backgroundType === 'image' }" @click="changeBackgroundType('image')">Картинка</button>
            </div>
            <div v-if="settings.backgroundType === 'color'" class="color-picker">
              <input type="color" v-model="settings.backgroundColor" />
            </div>
            <div v-if="settings.backgroundType === 'image'" class="image-picker">
              <input type="file" accept="image/*" @change="handleImageUpload" />
            </div>
            <div v-if="settings.backgroundType === 'image'" class="blur-picker">
              <label>Размытие фона: {{ settings.backgroundBlur }}px</label>
              <input type="range" min="0" max="50" step="1" v-model.number="settings.backgroundBlur" class="blur-slider"/>
            </div>
          </div>
          
          <div class="setting-group">
            <label>Закладок в ряду: {{ settings.bookmarksPerRow }}</label>
            <input type="range" min="3" max="10" step="1" v-model.number="settings.bookmarksPerRow" class="width-slider"/>
          </div>

          <div class="setting-group">
            <label>Размытие карточек: {{ settings.cardBlur }}px</label>
            <input type="range" min="0" max="30" step="1" v-model.number="settings.cardBlur" class="blur-slider"/>
          </div>

          <div class="setting-group">
            <label>Скрывать пустые папки</label>
            <div class="theme-toggle">
              <button :class="['theme-toggle-btn', { active: !settings.hideEmptyFolders }]" @click="toggleHideEmptyFolders">Показать все</button>
              <button :class="['theme-toggle-btn', { active: settings.hideEmptyFolders }]" @click="toggleHideEmptyFolders">Скрыть пустые</button>
            </div>
          </div>

          <button class="close-settings" @click="showSettings = false">Закрыть</button>
        </div>
      </transition>

      <transition name="fade">
        <div v-if="contextMenu.show" class="context-menu" :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }" @click.stop>
          <div class="context-menu-header">
            <span class="context-menu-title">{{ contextMenu.bookmark?.title }}</span>
          </div>
          <div class="context-menu-items">
            <button class="context-menu-item" @click="openBookmarkInNewTab">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              Открыть в новой вкладке
            </button>
            <button class="context-menu-item" @click="copyBookmarkUrl">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Копировать ссылку
            </button>
            <div class="context-menu-divider"></div>
            
            <div v-if="showFaviconUrlInput" class="favicon-url-input">
              <input type="text" v-model="faviconUrlInput" placeholder="URL иконки..." @keyup.enter="addFaviconFromUrl"/>
              <div class="favicon-url-buttons">
                <button @click="addFaviconFromUrl">Добавить</button>
                <button @click="showFaviconUrlInput = false">Отмена</button>
              </div>
            </div>
            
            <button v-else class="context-menu-item" @click="showFaviconUrlInput = true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              Добавить favicon по ссылке
            </button>
            
            <label class="context-menu-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span>Загрузить favicon файлом</span>
              <input type="file" accept="image/*" @change="handleCustomFaviconUpload" style="display: none;"/>
            </label>
            
            <button v-if="contextMenu.bookmark && customFavicons[contextMenu.bookmark.id]" class="context-menu-item danger" @click="removeCustomFavicon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              Удалить кастомный favicon
            </button>
          </div>
        </div>
      </transition>

      <div class="content" :style="{ maxWidth: containerWidth + 'px' }">
        <div class="time-section">
          <h1 class="time" :style="{ textShadow: `0 0 40px ${currentTheme.accent}40` }">{{ currentTime }}</h1>
          <p class="date">{{ currentDate }}</p>
        </div>
        <div v-if="loading" class="loading">Загрузка закладок...</div>
        <div v-else-if="error" class="error">❌ {{ error }}</div>
        <div v-else class="bookmarks-container">
          <div v-if="rootBookmarks.length > 0" class="folder-section root-section">
            <div class="section-title-wrapper">
              <h2 class="section-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" :stroke="accentColor" stroke-width="2" style="vertical-align: middle; margin-right: 6px;"><path d="M19 21l-7 -5l-7 5v-14a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2z"/></svg>
                Закладки
              </h2>
              <div class="section-divider" :style="{ background: accentColor }"></div>
            </div>
            <div class="bookmarks-grid">
              <BookmarkButton v-for="bookmark in rootBookmarks" :key="bookmark.id" :bookmark="bookmark" :is-folder="false" :theme="currentTheme" :custom-favicons="customFavicons" @contextmenu="showContextMenu"/>
            </div>
          </div>
          <FolderSection v-for="folder in rootFolders" :key="folder.id" :folder="folder" :theme="currentTheme" :custom-favicons="customFavicons" @bookmark-contextmenu="showContextMenu"/>
          <div v-if="rootBookmarks.length === 0 && rootFolders.length === 0" class="empty-state">
            <p>В этой папке нет закладок</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; overflow-x: hidden; color: var(--text-color, #eaeaea); }

.app-wrapper { position: relative; min-height: 100vh; overflow: hidden; }
.background-layer { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: -2; transform: scale(1.1); }
.app-container { min-height: 100vh; padding: 40px; transition: color 0.3s ease; background: color-mix(in srgb, var(--card-bg), transparent 80%); position: relative; z-index: 1; }

.settings-btn { position: fixed; top: 20px; right: 20px; width: 50px; height: 50px; border-radius: 50%; border: 1px solid var(--card-border); background: var(--card-bg); color: var(--text-color); cursor: pointer; z-index: 100; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px); }
.settings-btn:hover { transform: rotate(90deg); }
.settings-panel { position: fixed; top: 80px; right: 20px; width: 320px; background: var(--card-bg); backdrop-filter: blur(20px); border-radius: 16px; padding: 24px; border: 1px solid var(--card-border); box-shadow: 0 10px 40px rgba(0,0,0,0.3); z-index: 99; }
.settings-panel h3 { color: var(--text-color); margin-bottom: 20px; font-size: 18px; }
.setting-group { margin-bottom: 20px; }
.setting-group label { display: block; color: var(--accent-color); margin-bottom: 10px; font-size: 14px; font-weight: 500; }
.theme-toggle { display: flex; gap: 8px; }
.theme-toggle-btn { flex: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--card-border); background: rgba(255,255,255,0.05); color: var(--text-color); cursor: pointer; transition: all 0.3s ease; font-size: 13px; }
.theme-toggle-btn.active { background: var(--accent-color); border-color: var(--accent-color); color: #fff; }
.folder-select { width: 100%; padding: 10px 12px; background: rgba(255,255,255,0.05); border: 1px solid var(--card-border); border-radius: 8px; color: var(--text-color); font-size: 14px; cursor: pointer; }
.theme-selector { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.theme-btn { width: 40px; height: 40px; border-radius: 8px; border: 2px solid transparent; cursor: pointer; }
.theme-btn.active { border-color: #fff; transform: scale(1.1); }
.bg-selector { display: flex; gap: 10px; margin-bottom: 10px; }
.bg-selector button { flex: 1; padding: 8px; border-radius: 6px; border: 1px solid var(--card-border); background: rgba(255,255,255,0.05); color: var(--text-color); cursor: pointer; }
.bg-selector button.active { background: var(--accent-color); border-color: var(--accent-color); }
.color-picker input { width: 100%; height: 40px; border: none; border-radius: 6px; }
.image-picker input { width: 100%; padding: 8px; background: rgba(255,255,255,0.05); border: 1px solid var(--card-border); border-radius: 6px; color: var(--text-color); }
.blur-picker { margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--card-border); }
.blur-picker label { display: block; margin-bottom: 10px; font-size: 13px; color: var(--text-color-secondary); }
.blur-slider, .width-slider { width: 100%; height: 6px; border-radius: 3px; background: var(--card-border); outline: none; -webkit-appearance: none; }
.blur-slider::-webkit-slider-thumb, .width-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: var(--accent-color); cursor: pointer; }
.close-settings { width: 100%; padding: 12px; background: var(--accent-color); border: none; border-radius: 8px; color: #fff; font-weight: 500; cursor: pointer; }

.context-menu { position: fixed; background: var(--card-bg); backdrop-filter: blur(20px); border-radius: 12px; border: 1px solid var(--card-border); box-shadow: 0 10px 40px rgba(0,0,0,0.4); z-index: 1000; min-width: 240px; }
.context-menu-header { padding: 12px 16px; border-bottom: 1px solid var(--card-border); background: rgba(0,0,0,0.2); }
.context-menu-title { font-size: 13px; font-weight: 600; color: var(--text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.context-menu-items { padding: 8px; }
.context-menu-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border: none; background: transparent; color: var(--text-color); font-size: 13px; cursor: pointer; border-radius: 8px; }
.context-menu-item:hover { background: var(--accent-color); color: #fff; }
.context-menu-item.danger:hover { background: #ef4444; }
.context-menu-divider { height: 1px; background: var(--card-border); margin: 8px 0; }
.favicon-url-input { padding: 8px; }
.favicon-url-input input { width: 100%; padding: 8px 12px; border: 1px solid var(--card-border); border-radius: 6px; background: rgba(255,255,255,0.05); color: var(--text-color); margin-bottom: 8px; }
.favicon-url-buttons { display: flex; gap: 8px; }
.favicon-url-buttons button { flex: 1; padding: 6px; border: none; border-radius: 6px; background: var(--accent-color); color: white; cursor: pointer; font-size: 12px; }
.favicon-url-buttons button:last-child { background: rgba(255,255,255,0.1); }

.content { max-width: 1800px; margin: 0 auto; position: relative; z-index: 1; }
.time-section { text-align: center; margin-bottom: 20px; }
.time { font-size: 80px; font-weight: 200; color: var(--text-color); }
.date { font-size: 16px; color: var(--text-color-secondary); text-transform: capitalize; }
.loading, .error { text-align: center; color: var(--text-color); font-size: 18px; }
.error { color: #ef4444; }

/* Изменения для поддержки компактного режима через CSS-переменные */
.bookmarks-container { 
  display: flex; 
  flex-direction: column; 
  gap: var(--container-gap, 10px); 
  transition: gap 0.3s ease;
}

.folder-section { 
  display: flex; 
  flex-direction: column; 
  gap: 16px; 
  padding: var(--folder-padding, 20px); 
  background: var(--root-bg, color-mix(in srgb, var(--theme-accent, #a855f7) 8%, transparent)); 
  border-radius: 16px; 
  border: var(--folder-border, 1px solid var(--card-border)); 
  transition: all 0.3s ease;
}

.root-section { 
  background: var(--root-bg, color-mix(in srgb, var(--theme-accent, #a855f7) 8%, transparent)); 
  /* border-color: var(--root-border, 1px solid color-mix(in srgb, var(--theme-accent, #a855f7) 20%, transparent));  */
  transition: all 0.3s ease;
}

.section-title-wrapper { display: flex; align-items: center; gap: 16px; }
.section-title { color: var(--text-color); font-size: 18px; font-weight: 600; white-space: nowrap; display: flex; align-items: center; }
.section-divider { flex: 1; height: 1px; opacity: 0.4; }
.bookmarks-grid { display: flex; flex-wrap: wrap; gap: 16px; }
.empty-state { text-align: center; padding: 60px 20px; color: var(--text-color-secondary); font-size: 16px; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>