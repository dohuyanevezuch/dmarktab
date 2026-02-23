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
  compactMode: false,
  hideDateTime: false
})

const customFavicons = ref({})

// Новое состояние для контекстного меню
const contextMenu = ref({ 
  show: false, 
  x: 0, 
  y: 0, 
  bookmark: null,
  isFolder: false
})

// Состояние для модального окна редактирования
const editModal = ref({
  show: false,
  bookmark: null,
  isFolder: false,
  title: '',
  url: '',
  faviconUrl: '',
  parentId: '',
  index: 0,
  siblings: [],
  allFolders: [],
  expandedFolders: new Set(), // Для отслеживания развернутых папок
  targetFolderChildren: [] // Дочерние элементы выбранной папки
})

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
  } catch (err) { console.error('Error saving custom favicons:', err) }
}

watch(() => customFavicons.value, () => {
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

const toggleCompactMode = () => {
  settings.value.compactMode = !settings.value.compactMode
}

const toggleHideDateTime = () => {
  settings.value.hideDateTime = !settings.value.hideDateTime
}

// Функции контекстного меню
const showContextMenu = (event, bookmark, isFolder = false) => {
  event.preventDefault()
  contextMenu.value = { 
    show: true, 
    x: event.clientX, 
    y: event.clientY, 
    bookmark: bookmark,
    isFolder: isFolder
  }
}

const hideContextMenu = () => { 
  contextMenu.value.show = false 
}

const openBookmark = () => {
  if (contextMenu.value.bookmark?.url) { 
    browser.tabs.create({ url: contextMenu.value.bookmark.url })
    hideContextMenu()
  }
}

const copyBookmarkUrl = () => {
  if (contextMenu.value.bookmark?.url) { 
    navigator.clipboard.writeText(contextMenu.value.bookmark.url)
    hideContextMenu()
  }
}

// Получение видимых папок с учетом свернутых
const getVisibleFolders = computed(() => {
  if (!editModal.value.allFolders) return []
  
  const visible = []
  let skipDepth = -1
  
  for (const folder of editModal.value.allFolders) {
    // Если мы внутри свернутой папки, пропускаем
    if (skipDepth >= 0 && folder.depth > skipDepth) {
      continue
    }
    skipDepth = -1
    
    visible.push(folder)
    
    // Если папка свернута, запоминаем глубину для пропуска детей
    if (!editModal.value.expandedFolders.has(folder.id)) {
      skipDepth = folder.depth
    }
  }
  
  return visible
})

// Переключение сворачивания папки
const toggleFolderExpand = (folderId) => {
  if (editModal.value.expandedFolders.has(folderId)) {
    editModal.value.expandedFolders.delete(folderId)
  } else {
    editModal.value.expandedFolders.add(folderId)
  }
}

// Проверка, есть ли дети у папки
const hasChildren = (folderId) => {
  const folderIndex = editModal.value.allFolders.findIndex(f => f.id === folderId)
  if (folderIndex === -1) return false
  const folder = editModal.value.allFolders[folderIndex]
  const nextFolder = editModal.value.allFolders[folderIndex + 1]
  return nextFolder && nextFolder.depth > folder.depth
}

// Загрузка дочерних элементов целевой папки для позиционирования
const loadTargetFolderChildren = async (folderId) => {
  try {
    const children = await browser.bookmarks.getChildren(folderId)
    // Фильтруем текущую закладку/папку из списка (если она там есть)
    const filtered = children.filter(child => child.id !== editModal.value.bookmark?.id)
    editModal.value.targetFolderChildren = filtered
  } catch (e) {
    editModal.value.targetFolderChildren = []
  }
}

// Обработка выбора папки
const selectTargetFolder = async (folderId) => {
  if (folderId === editModal.value.bookmark?.id) return
  
  editModal.value.parentId = folderId
  editModal.value.index = 0 // Сброс позиции при смене папки
  
  // Загружаем детей новой папки
  await loadTargetFolderChildren(folderId)
}

const openEditModal = async () => {
  const bookmark = contextMenu.value.bookmark
  if (!bookmark) return
  
  // Получаем все папки для выбора родительской
  const tree = await browser.bookmarks.getTree()
  const allFoldersList = []
  
  const traverse = (nodes, depth = 0) => {
    for (const node of nodes) {
      if (!node.url) {
        allFoldersList.push({
          id: node.id,
          title: node.title || 'Без названия',
          depth: depth,
          hasChildren: false // Будет определено позже
        })
        if (node.children) {
          traverse(node.children, depth + 1)
        }
      }
    }
  }
  traverse(tree)
  
  // Определяем hasChildren для каждой папки
  for (let i = 0; i < allFoldersList.length; i++) {
    const current = allFoldersList[i]
    const next = allFoldersList[i + 1]
    current.hasChildren = next && next.depth > current.depth
  }
  
  // Получаем информацию о текущей закладке/папке
  const [bookmarkInfo] = await browser.bookmarks.get(bookmark.id)
  const siblings = await browser.bookmarks.getChildren(bookmarkInfo.parentId)
  
  // По умолчанию разворачиваем корневые папки
  const expanded = new Set()
  allFoldersList.forEach(f => {
    if (f.depth === 0) expanded.add(f.id)
  })
  
  editModal.value = {
    show: true,
    bookmark: bookmark,
    isFolder: contextMenu.value.isFolder,
    title: bookmark.title || '',
    url: bookmark.url || '',
    faviconUrl: customFavicons.value[bookmark.id] || '',
    parentId: bookmarkInfo.parentId,
    index: bookmarkInfo.index,
    siblings: siblings,
    allFolders: allFoldersList,
    expandedFolders: expanded,
    targetFolderChildren: siblings.filter(s => s.id !== bookmark.id)
  }
  
  hideContextMenu()
}

const closeEditModal = () => {
  editModal.value.show = false
}

const saveBookmarkEdit = async () => {
  try {
    const { bookmark, title, url, faviconUrl, parentId, index, isFolder } = editModal.value
    
    // Обновляем заголовок и URL (если не папка)
    if (isFolder) {
      await browser.bookmarks.update(bookmark.id, { title })
    } else {
      await browser.bookmarks.update(bookmark.id, { title, url })
    }
    
    // Обновляем favicon если есть
    if (!isFolder && faviconUrl) {
      const newFavicons = { ...customFavicons.value }
      newFavicons[bookmark.id] = faviconUrl
      customFavicons.value = newFavicons
    } else if (!isFolder && !faviconUrl && customFavicons.value[bookmark.id]) {
      const newFavicons = { ...customFavicons.value }
      delete newFavicons[bookmark.id]
      customFavicons.value = newFavicons
    }
    
    // Перемещаем если изменилась папка или позиция
    const [currentInfo] = await browser.bookmarks.get(bookmark.id)
    if (currentInfo.parentId !== parentId || currentInfo.index !== index) {
      await browser.bookmarks.move(bookmark.id, { parentId, index })
    }
    
    // Перезагружаем контент
    await loadRootContent()
    closeEditModal()
  } catch (err) {
    console.error('Error saving bookmark:', err)
    alert('Ошибка при сохранении: ' + err.message)
  }
}

const handleEditFaviconFile = (event) => {
  const file = event.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      editModal.value.faviconUrl = e.target.result
    }
    reader.readAsDataURL(file)
  }
}

const getPositionLabel = (index, total) => {
  return `${index + 1} из ${total}`
}

onMounted(() => {
  updateTime()
  setInterval(updateTime, 1000)
  loadSettings().then(() => { getAvailableFolders().then(() => { loadRootContent() }) })
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.context-menu') && !e.target.closest('.edit-modal')) {
      hideContextMenu()
    }
  })
})
</script>

<template>
  <div class="app-wrapper">
    <div class="background-layer" :style="[{ filter: settings.backgroundType === 'image' ? `blur(${settings.backgroundBlur}px)` : 'none' }, appBackground]"></div>
    
    <div 
      class="app-container" 
      :data-theme="settings.isLightTheme ? 'light' : 'dark'"
      :style="{
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
      }"
    >
      
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
          
          <div class="setting-group">
            <label>Режим отображения</label>
            <div class="theme-toggle">
              <button :class="['theme-toggle-btn', { active: !settings.compactMode }]" @click="toggleCompactMode">Обычный</button>
              <button :class="['theme-toggle-btn', { active: settings.compactMode }]" @click="toggleCompactMode">Компактный</button>
            </div>
          </div>
          
          <div class="setting-group">
            <label>Показ времени и даты</label>
            <div class="theme-toggle">
              <button :class="['theme-toggle-btn', { active: !settings.hideDateTime }]" @click="toggleHideDateTime">Показать</button>
              <button :class="['theme-toggle-btn', { active: settings.hideDateTime }]" @click="toggleHideDateTime">Скрыть</button>
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

      <!-- Контекстное меню -->
      <transition name="fade">
        <div v-if="contextMenu.show" class="context-menu" :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }" @click.stop>
          <div class="context-menu-items">
            <button v-if="!contextMenu.isFolder" class="context-menu-item" @click="openBookmark">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              Открыть
            </button>
            <button v-if="!contextMenu.isFolder" class="context-menu-item" @click="copyBookmarkUrl">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Скопировать
            </button>
            <button class="context-menu-item" @click="openEditModal">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Редактировать
            </button>
          </div>
        </div>
      </transition>

      <!-- Модальное окно редактирования -->
      <transition name="fade">
        <div v-if="editModal.show" class="edit-modal-overlay" @click="closeEditModal">
          <div class="edit-modal" @click.stop>
            <div class="edit-modal-header">
              <h3>{{ editModal.isFolder ? 'Редактировать папку' : 'Редактировать закладку' }}</h3>
              <button class="close-btn" @click="closeEditModal">×</button>
            </div>
            
            <div class="edit-modal-body">
              <!-- Название -->
              <div class="form-group">
                <label>Название</label>
                <input type="text" v-model="editModal.title" class="form-input" placeholder="Введите название...">
              </div>
              
              <!-- URL (только для закладок) -->
              <div v-if="!editModal.isFolder" class="form-group">
                <label>Ссылка</label>
                <input type="text" v-model="editModal.url" class="form-input" placeholder="https://...">
              </div>
              
              <!-- Иконка (только для закладок) -->
              <div v-if="!editModal.isFolder" class="form-group">
                <label>Иконка</label>
                <div class="favicon-input-group">
                  <input type="text" v-model="editModal.faviconUrl" class="form-input" placeholder="URL иконки...">
                  <label class="file-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <input type="file" accept="image/*" @change="handleEditFaviconFile" style="display: none;">
                  </label>
                </div>
                <img v-if="editModal.faviconUrl" :src="editModal.faviconUrl" class="favicon-preview" @error="editModal.faviconUrl = ''">
              </div>
              
              <!-- Родительская папка - Древовидная структура со сворачиванием -->
              <div class="form-group">
                <label>Вхождение в папку</label>
                <div class="folder-hierarchy" @click.stop>
                  <div 
                    v-for="folder in getVisibleFolders" 
                    :key="folder.id"
                    :class="['folder-tree-item', { 
                      selected: editModal.parentId === folder.id,
                      current: folder.id === editModal.bookmark?.id 
                    }]"
                    :style="{ paddingLeft: (12 + folder.depth * 24) + 'px' }"
                    @click="selectTargetFolder(folder.id)"
                  >
                    <!-- Кнопка сворачивания/разворачивания -->
                    <button 
                      v-if="folder.hasChildren" 
                      class="expand-btn"
                      :class="{ expanded: editModal.expandedFolders.has(folder.id) }"
                      @click.stop="toggleFolderExpand(folder.id)"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </button>
                    <span v-else class="expand-placeholder"></span>
                    
                    <!-- Иконка папки -->
                    <svg 
                      class="folder-tree-icon" 
                      width="18" 
                      height="18" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      :stroke="folder.id === editModal.parentId ? 'var(--accent-color)' : 'currentColor'" 
                      stroke-width="2"
                    >
                      <path d="M2.75 8.623v7.379a4 4 0 0 0 4 4h10.5a4 4 0 0 0 4-4v-5.69a4 4 0 0 0-4-4H12M2.75 8.624V6.998a3 3 0 0 1 3-3h2.9a2.5 2.5 0 0 1 1.768.732L12 6.313m-9.25 2.31h5.904a2.5 2.5 0 0 0 1.768-.732L12 6.313"/>
                    </svg>
                    
                    <span class="folder-tree-title" :class="{ 'root-folder': folder.depth === 0 }">{{ folder.title }}</span>
                    
                    <!-- Галочка выбранного элемента -->
                    <svg 
                      v-if="folder.id === editModal.parentId" 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="var(--accent-color)" 
                      stroke-width="3"
                      style="margin-left: auto;"
                    >
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                </div>
              </div>
              
              <!-- Позиция - динамически обновляется при смене папки -->
              <div class="form-group">
                <label>Позиция в папке</label>
                <select v-model.number="editModal.index" class="form-select">
                  <option 
                    v-for="n in editModal.targetFolderChildren.length + 1" 
                    :key="n - 1" 
                    :value="n - 1"
                  >
                    {{ getPositionLabel(n - 1, editModal.targetFolderChildren.length + 1) }}
                    <template v-if="n - 1 < editModal.targetFolderChildren.length">
                      — {{ editModal.targetFolderChildren[n - 1].title }}
                    </template>
                    <template v-else>— (в конец)</template>
                  </option>
                </select>
              </div>
            </div>
            
            <div class="edit-modal-footer">
              <button class="btn-secondary" @click="closeEditModal">Отмена</button>
              <button class="btn-primary" @click="saveBookmarkEdit">Сохранить</button>
            </div>
          </div>
        </div>
      </transition>

      <div class="content" :style="{ maxWidth: containerWidth + 'px' }">
        <div v-if="!settings.hideDateTime" class="time-section">
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
              <BookmarkButton 
                v-for="bookmark in rootBookmarks" 
                :key="bookmark.id" 
                :bookmark="bookmark" 
                :is-folder="false" 
                :theme="currentTheme" 
                :custom-favicons="customFavicons" 
                @contextmenu="(e, b) => showContextMenu(e, b, false)"
              />
            </div>
          </div>
          <FolderSection 
            v-for="folder in rootFolders" 
            :key="folder.id" 
            :folder="folder" 
            :theme="currentTheme" 
            :custom-favicons="customFavicons"
            @bookmark-contextmenu="(e, b) => showContextMenu(e, b, false)"
            @folder-contextmenu="(e, f) => showContextMenu(e, f, true)"
          />
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

/* Контекстное меню */
.context-menu { 
  position: fixed; 
  background: var(--card-bg); 
  backdrop-filter: blur(20px); 
  border-radius: 12px; 
  border: 1px solid var(--card-border); 
  box-shadow: 0 10px 40px rgba(0,0,0,0.4); 
  z-index: 1000; 
  min-width: 180px;
  overflow: hidden;
}
.context-menu-items { padding: 6px; }
.context-menu-item { 
  display: flex; 
  align-items: center; 
  gap: 10px; 
  width: 100%; 
  padding: 10px 12px; 
  border: none; 
  background: transparent; 
  color: var(--text-color); 
  font-size: 14px; 
  cursor: pointer; 
  border-radius: 8px;
  transition: all 0.2s ease;
}
.context-menu-item:hover { 
  background: var(--accent-color); 
  color: #fff; 
}

/* Модальное окно редактирования */
.edit-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(5px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.edit-modal {
  background: var(--card-bg);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid var(--card-border);
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}

.edit-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--card-border);
}

.edit-modal-header h3 {
  color: var(--text-color);
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: rgba(255,255,255,0.1);
  color: var(--text-color);
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255,255,255,0.2);
}

.edit-modal-body {
  padding: 24px;
  overflow-y: auto;
  max-height: 60vh;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  color: var(--accent-color);
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Исправленные стили для форм с поддержкой темной темы */
.form-input, .form-select {
  width: 100%;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--card-border);
  border-radius: 10px;
  color: var(--text-color);
  font-size: 14px;
  outline: none;
  transition: all 0.2s;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
}

.form-input:focus, .form-select:focus {
  border-color: var(--accent-color);
  background: rgba(0, 0, 0, 0.3);
}

/* Светлая тема - светлый фон */
.app-container[data-theme="light"] .form-input,
.app-container[data-theme="light"] .form-select {
  background: rgba(255, 255, 255, 0.8);
  color: #1f2937;
}

.app-container[data-theme="light"] .form-input:focus,
.app-container[data-theme="light"] .form-select:focus {
  background: rgba(255, 255, 255, 0.95);
}

/* Стили для опций селекта - принудительно темные для контраста */
.form-select option {
  background: #1f2937;
  color: #eaeaea;
  padding: 8px;
}

/* Для светлой темы */
.app-container[data-theme="light"] .form-select option {
  background: #ffffff;
  color: #1f2937;
}

.favicon-input-group {
  display: flex;
  gap: 8px;
}

.favicon-input-group .form-input {
  flex: 1;
}

.file-btn {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  border: 1px solid var(--card-border);
  background: rgba(255,255,255,0.05);
  color: var(--text-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.file-btn:hover {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: #fff;
}

.favicon-preview {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  margin-top: 12px;
  object-fit: contain;
  border: 1px solid var(--card-border);
  padding: 4px;
  background: rgba(255,255,255,0.05);
}

.edit-modal-footer {
  display: flex;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid var(--card-border);
  justify-content: flex-end;
}

.btn-secondary, .btn-primary {
  padding: 12px 24px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-secondary {
  background: rgba(255,255,255,0.1);
  color: var(--text-color);
}

.btn-secondary:hover {
  background: rgba(255,255,255,0.15);
}

.btn-primary {
  background: var(--accent-color);
  color: #fff;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Древовидная структура папок */
.folder-hierarchy {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--card-border);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.2);
  padding: 8px 0;
}

.app-container[data-theme="light"] .folder-hierarchy {
  background: rgba(255, 255, 255, 0.8);
}

.folder-tree-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-color);
  border-left: 3px solid transparent;
  margin: 2px 8px;
  border-radius: 0 8px 8px 0;
  min-height: 40px;
}

.folder-tree-item:hover {
  background: rgba(255, 255, 255, 0.1);
  border-left-color: var(--accent-color);
}

.app-container[data-theme="light"] .folder-tree-item:hover {
  background: rgba(0, 0, 0, 0.05);
}

.folder-tree-item.selected {
  background: color-mix(in srgb, var(--accent-color) 20%, transparent);
  border-left-color: var(--accent-color);
}

.folder-tree-item.current {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Кнопка сворачивания/разворачивания */
.expand-btn {
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--text-color-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
  margin-right: 4px;
  flex-shrink: 0;
}

.expand-btn:hover {
  background: rgba(255,255,255,0.1);
  color: var(--text-color);
}

.expand-btn.expanded svg {
  transform: rotate(90deg);
}

.expand-placeholder {
  width: 20px;
  margin-right: 4px;
  flex-shrink: 0;
}

.folder-tree-icon {
  width: 18px;
  height: 18px;
  margin-right: 8px;
  flex-shrink: 0;
}

.folder-tree-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
}

.folder-tree-title.root-folder {
  font-weight: 600;
  color: var(--accent-color);
}

/* Скроллбар для дерева */
.folder-hierarchy::-webkit-scrollbar {
  width: 8px;
}

.folder-hierarchy::-webkit-scrollbar-track {
  background: transparent;
}

.folder-hierarchy::-webkit-scrollbar-thumb {
  background: var(--card-border);
  border-radius: 4px;
}

.folder-hierarchy::-webkit-scrollbar-thumb:hover {
  background: var(--accent-color);
}

.content { max-width: 1800px; margin: 0 auto; position: relative; z-index: 1; }
.time-section { text-align: center; margin-bottom: 20px; }
.time { font-size: 80px; font-weight: 200; color: var(--text-color); }
.date { font-size: 16px; color: var(--text-color-secondary); text-transform: capitalize; }
.loading, .error { text-align: center; color: var(--text-color); font-size: 18px; }
.error { color: #ef4444; }

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