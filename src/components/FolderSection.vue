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
          <path d="M13 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v2"/>
          <path d="M19 15v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-4"/>
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
              <path d="M5 12l-2 0l9 -9l9 9l-2 0l0 7a2 2 0 0 1 -2 2l-5 0l0 -9z"/>
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