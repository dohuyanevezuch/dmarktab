<script setup>
import { ref, onMounted, computed } from 'vue'
import BookmarkButton from './BookmarkButton.vue'

const props = defineProps({
  folder: {
    type: Object,
    required: true
  },
  theme: {
    type: Object,
    default: () => ({ primary: '#7b2cbf', accent: '#a855f7' })
  },
  customFavicons: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['bookmark-contextmenu'])

const navigationStack = ref([{
  id: props.folder.id,
  title: '',
  isRoot: true
}])

const currentLevelBookmarks = ref([])
const currentLevelFolders = ref([])
const activeIndex = ref(0)

const loadFolderContent = async (folderId, stackIndex) => {
  try {
    const children = await browser.bookmarks.getChildren(folderId)
    currentLevelBookmarks.value = children.filter(item => item.url)
    currentLevelFolders.value = children.filter(item => !item.url)
    navigationStack.value = navigationStack.value.slice(0, stackIndex + 1)
    activeIndex.value = stackIndex
  } catch (err) {
    console.error('Error loading folder content:', err)
  }
}

const navigateToFolder = async (folder, levelIndex) => {
  if (levelIndex < navigationStack.value.length - 1) {
    navigationStack.value = navigationStack.value.slice(0, levelIndex + 1)
    activeIndex.value = levelIndex
  } else {
    navigationStack.value.push({
      id: folder.id,
      title: folder.title,
      isRoot: false
    })
    activeIndex.value = navigationStack.value.length - 1
  }
  await loadFolderContent(folder.id, activeIndex.value)
}

const navigateToLevel = async (index) => {
  const stackItem = navigationStack.value[index]
  await loadFolderContent(stackItem.id, index)
}

const showBreadcrumbs = computed(() => {
  return currentLevelFolders.value.length > 0 || navigationStack.value.length > 1
})

const handleBookmarkContextMenu = (event, bookmark) => {
  emit('bookmark-contextmenu', event, bookmark)
}

onMounted(async () => {
  await loadFolderContent(props.folder.id, 0)
})
</script>

<template>
  <div class="folder-section">
    <div class="section-title-wrapper">
      <h2 class="section-title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" :stroke="theme.accent" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px;">
          <path d="m3.882 18.043l4.041-5.623a4 4 0 0 1 3.249-1.665h8.752M3.882 18.043a3.65 3.65 0 0 0 2.777 1.277h8.343a4 4 0 0 0 3.405-1.9l2.918-4.734a1.287 1.287 0 0 0-1.115-1.931h-.286M3.882 18.043A3.65 3.65 0 0 1 3 15.661V7.424A2.744 2.744 0 0 1 5.744 4.68h2.653c.607 0 1.189.24 1.618.67l.911.91a1.83 1.83 0 0 0 1.294.537l4.044-.001a3.66 3.66 0 0 1 3.66 3.66v.299"/>
        </svg>
        {{ folder.title }}
      </h2>

      <div v-if="showBreadcrumbs" class="breadcrumbs">
        <span 
          v-for="(navItem, index) in navigationStack" 
          :key="navItem.id + '-' + index"
          class="breadcrumbs-separator"
        >
          <span 
            :class="['breadcrumbs-item', { active: index === activeIndex }]"
            @click="navigateToLevel(index)"
          >
            <svg v-if="navItem.isRoot" width="14" height="14" viewBox="0 0 24 24" fill="none" :stroke="theme.accent" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;">
              <path d="M15.29 20.663h3.017a2.194 2.194 0 0 0 2.193-2.194v-6.454a3.3 3.3 0 0 0-1.13-2.48l-5.93-5.166a2.194 2.194 0 0 0-2.88 0L4.63 9.534a3.3 3.3 0 0 0-1.13 2.481v6.454c0 1.212.982 2.194 2.194 2.194h3.29m6.306 0v-6.581c0-.908-.736-1.645-1.645-1.645H10.63c-.909 0-1.645.737-1.645 1.645v6.581m6.306 0H8.984"/>
            </svg>
            {{ navItem.title }}
          </span>
        </span>
      </div>

      <div class="section-divider" :style="{ background: theme.accent }"></div>
    </div>

    <div v-if="currentLevelFolders.length > 0" class="bookmarks-grid">
      <BookmarkButton 
        v-for="subfolder in currentLevelFolders" 
        :key="subfolder.id"
        :bookmark="subfolder"
        :is-folder="true"
        :theme="theme"
        @click="navigateToFolder(subfolder, navigationStack.length)"
      />
    </div>

    <div v-if="currentLevelBookmarks.length > 0" class="bookmarks-grid">
      <BookmarkButton 
        v-for="bookmark in currentLevelBookmarks" 
        :key="bookmark.id"
        :bookmark="bookmark"
        :is-folder="false"
        :theme="theme"
        :custom-favicons="customFavicons"
        @contextmenu="handleBookmarkContextMenu"
      />
    </div>
  </div>
</template>

<style scoped>
.folder-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.section-title-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.section-title {
  color: var(--text-color, #eaeaea);
  font-size: 18px;
  font-weight: 600;
  white-space: nowrap;
  display: flex;
  align-items: center;
}
.breadcrumbs {
  display: flex;
  align-items: center;
  gap: 0;
  font-size: 13px;
  color: var(--text-color-secondary, rgba(234, 234, 234, 0.7));
}
.breadcrumbs-separator {
  display: flex;
  align-items: center;
  gap: 0;
}
.breadcrumbs-separator:not(:first-child)::before {
  content: '/';
  color: var(--text-color-secondary, rgba(234, 234, 234, 0.4));
  margin: 0 8px;
}
.breadcrumbs-item {
  cursor: pointer;
  transition: all 0.3s ease;
  padding: 4px 8px;
  border-radius: 6px;
  color: var(--text-color-secondary, rgba(234, 234, 234, 0.7));
  display: inline-flex;
  align-items: center;
}
.breadcrumbs-item:hover {
  background: rgba(123, 123, 123, 0.1);
  color: var(--text-color, #eaeaea);
}
.breadcrumbs-item.active {
  color: var(--accent-color, #a855f7);
  font-weight: 500;
}
.section-divider {
  flex: 1;
  height: 1px;
  opacity: 0.4;
}
.bookmarks-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
</style>