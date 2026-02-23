<script setup>
import { ref, onMounted, computed, watch } from 'vue'

const props = defineProps({
  bookmark: { type: Object, required: true },
  isFolder: { type: Boolean, default: false },
  theme: { type: Object, default: () => ({ primary: '#7b2cbf', accent: '#a855f7' }) },
  customFavicons: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['contextmenu', 'update:favicon'])
const faviconUrl = ref(null)
const hasFavicon = ref(true)
const dominantColor = ref('#666666')
const secondaryColor = ref(null)
const isLoading = ref(true)

const getCustomFavicon = () => props.customFavicons[props.bookmark.id] || null

// Get two most frequent colors for gradient
const getFaviconColors = async (url) => {
  if (!url) return { primary: props.theme.accent, secondary: props.theme.primary }
  try {
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    await Promise.race([
      new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
    ])
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d')
    canvas.width = canvas.height = 64
    ctx.drawImage(img, 0, 0, 64, 64)
    const data = ctx.getImageData(0, 0, 64, 64).data
    const colorMap = new Map()
    
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
      const brightness = (r * 299 + g * 587 + b * 114) / 1000
      if (brightness < 30 || brightness > 240) continue
      const key = `${Math.round(r / 16) * 16},${Math.round(g / 16) * 16},${Math.round(b / 16) * 16}`
      colorMap.set(key, (colorMap.get(key) || 0) + 1)
    }
    
    if (colorMap.size === 0) return { primary: props.theme.accent, secondary: props.theme.primary }
    
    const sortedColors = Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
    
    const primary = sortedColors[0] ? `rgb(${sortedColors[0][0]})` : props.theme.accent
    const secondary = sortedColors[1] ? `rgb(${sortedColors[1][0]})` : props.theme.primary
    
    return { primary, secondary }
  } catch (e) {
    return { primary: props.theme.accent, secondary: props.theme.primary }
  }
}

const bookmarkGradient = computed(() => {
  if (props.isFolder) {
    // More pronounced gradient for folders
    return `linear-gradient(135deg, ${props.theme.accent}40 0%, ${props.theme.primary}60 50%, rgba(123, 123, 123, 0.1) 100%)`
  }
  // For bookmarks: gradient from most frequent to least frequent color
  if (hasFavicon.value && secondaryColor.value) {
    return `linear-gradient(135deg, ${dominantColor.value}35 0%, ${secondaryColor.value}25 100%)`
  }
  return `linear-gradient(135deg, ${dominantColor.value}25 0%, rgba(123, 123, 123, 0.1) 50%, rgba(255, 255, 255, 0.05) 100%)`
})

const checkImageExists = (url) => {
  return new Promise((resolve) => {
    if (url.includes('192.168.') || url.includes('localhost') || url.includes('127.')) {
      fetch(url, { method: 'HEAD', mode: 'no-cors' })
        .then(() => resolve(true))
        .catch(() => {
          const img = new Image()
          img.onload = () => resolve(true)
          img.onerror = () => resolve(false)
          img.src = url
          setTimeout(() => resolve(false), 3000)
        })
    } else {
      const img = new Image()
      img.crossOrigin = 'Anonymous'
      img.onload = () => resolve(true)
      img.onerror = () => resolve(false)
      img.src = url
      setTimeout(() => resolve(false), 3000)
    }
  })
}

const getFavicon = async () => {
  isLoading.value = true
  if (props.isFolder || !props.bookmark.url) {
    hasFavicon.value = false
    dominantColor.value = props.theme.accent
    secondaryColor.value = null
    isLoading.value = false
    return
  }

  try {
    const url = props.bookmark.url
    const hostname = new URL(url).hostname

    const custom = getCustomFavicon()
    if (custom) {
      const exists = await checkImageExists(custom)
      if (exists) {
        faviconUrl.value = custom
        hasFavicon.value = true
        const colors = await getFaviconColors(custom)
        dominantColor.value = colors.primary
        secondaryColor.value = colors.secondary
        isLoading.value = false
        return
      }
    }

    try {
      const history = await browser.history.search({ text: url, maxResults: 1, startTime: 0 })
      if (history[0]?.favIconUrl) {
        faviconUrl.value = history[0].favIconUrl
        hasFavicon.value = true
        const colors = await getFaviconColors(history[0].favIconUrl)
        dominantColor.value = colors.primary
        secondaryColor.value = colors.secondary
        isLoading.value = false
        return
      }
    } catch (e) {}

    try {
      const tabs = await browser.tabs.query({ url })
      if (tabs[0]?.favIconUrl) {
        faviconUrl.value = tabs[0].favIconUrl
        hasFavicon.value = true
        const colors = await getFaviconColors(tabs[0].favIconUrl)
        dominantColor.value = colors.primary
        secondaryColor.value = colors.secondary
        isLoading.value = false
        return
      }
    } catch (e) {}

    const isLocal = url.includes('192.168.') || url.includes('localhost') || url.includes('127.') || url.startsWith('file://')
    if (isLocal) {
      for (const path of ['/favicon.ico', '/favicon.png', '/static/favicon.ico', '/assets/favicon.ico']) {
        try {
          const localUrl = new URL(path, url).href
          const exists = await checkImageExists(localUrl)
          if (exists) {
            faviconUrl.value = localUrl
            hasFavicon.value = true
            const colors = await getFaviconColors(localUrl)
            dominantColor.value = colors.primary
            secondaryColor.value = colors.secondary
            isLoading.value = false
            return
          }
        } catch (e) {}
      }
    }

    if (!isLocal && !url.startsWith('file://')) {
      const googleFavicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`
      if (await checkImageExists(googleFavicon)) {
        faviconUrl.value = googleFavicon
        hasFavicon.value = true
        const colors = await getFaviconColors(googleFavicon)
        dominantColor.value = colors.primary
        secondaryColor.value = colors.secondary
        isLoading.value = false
        return
      }

      const ddgFavicon = `https://icons.duckduckgo.com/ip3/${hostname}.ico`
      if (await checkImageExists(ddgFavicon)) {
        faviconUrl.value = ddgFavicon
        hasFavicon.value = true
        const colors = await getFaviconColors(ddgFavicon)
        dominantColor.value = colors.primary
        secondaryColor.value = colors.secondary
        isLoading.value = false
        return
      }
    }

    if (!url.startsWith('file://')) {
      try {
        const directFavicon = new URL('/favicon.ico', url).href
        if (await checkImageExists(directFavicon)) {
          faviconUrl.value = directFavicon
          hasFavicon.value = true
          const colors = await getFaviconColors(directFavicon)
          dominantColor.value = colors.primary
          secondaryColor.value = colors.secondary
          isLoading.value = false
          return
        }
      } catch (e) {}
    }

    hasFavicon.value = false
    faviconUrl.value = null
    dominantColor.value = props.theme.accent
    secondaryColor.value = null
  } catch (e) {
    hasFavicon.value = false
    faviconUrl.value = null
    dominantColor.value = props.theme.accent
    secondaryColor.value = null
  } finally {
    isLoading.value = false
  }
}

const handleClick = () => { if (props.bookmark.url) browser.tabs.create({ url: props.bookmark.url }) }
const handleContextMenu = (e) => { if (!props.isFolder) emit('contextmenu', e, props.bookmark) }

watch(() => props.customFavicons, (newVal, oldVal) => {
  if (newVal[props.bookmark.id] !== oldVal?.[props.bookmark.id]) {
    getFavicon()
  }
}, { deep: true })

watch(() => props.theme, () => {
  if (!hasFavicon.value) {
    dominantColor.value = props.theme.accent
    secondaryColor.value = null
  }
}, { deep: true })

onMounted(getFavicon)
</script>

<template>
  <button class="bookmark-button" 
    :class="{ 'has-favicon': hasFavicon, 'is-folder': isFolder }"
    @click="handleClick" 
    @contextmenu.prevent="handleContextMenu"
    :style="{ 
      background: bookmarkGradient, 
      '--dominant-color': dominantColor, 
      '--theme-accent': props.theme.accent,
      '--theme-primary': props.theme.primary
    }">
    <div class="button-icon">
      <img v-if="!isFolder && hasFavicon && faviconUrl" :src="faviconUrl" class="favicon" @error="hasFavicon = false"/>
      <svg v-else-if="!isFolder" width="22" height="22" viewBox="0 0 24 24" fill="none" :stroke="props.theme.accent" stroke-width="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" :stroke="props.theme.accent" stroke-width="1.5">
        <path d="M2.75 8.623v7.379a4 4 0 0 0 4 4h10.5a4 4 0 0 0 4-4v-5.69a4 4 0 0 0-4-4H12M2.75 8.624V6.998a3 3 0 0 1 3-3h2.9a2.5 2.5 0 0 1 1.768.732L12 6.313m-9.25 2.31h5.904a2.5 2.5 0 0 0 1.768-.732L12 6.313"/>
      </svg>
    </div>
    <span class="button-text">{{ bookmark.title }}</span>
  </button>
</template>

<style scoped>
.bookmark-button {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border: 1px solid rgba(123, 123, 123, 0.2);
  border-radius: 12px;
  color: var(--text-color, #eaeaea);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  width: 220px;
  height: 46px;
  backdrop-filter: blur(var(--card-blur, 10px));
  position: relative;
  overflow: hidden;
}

/* Folder height is 38px */
.bookmark-button.is-folder {
  height: 33px;
  padding: 8px 14px;
  border: 1px solid color-mix(in srgb, var(--theme-accent, #a855f7) 40%, transparent);
}

.bookmark-button::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%);
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
}

.bookmark-button:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 8px 25px rgba(0,0,0,0.3);
  border-color: var(--theme-accent, #a855f7);
}

.bookmark-button:hover::before {
  opacity: 1;
}

.bookmark-button.is-folder:hover {
  border-color: var(--theme-accent, #a855f7);
  box-shadow: 0 6px 20px color-mix(in srgb, var(--theme-accent, #a855f7) 30%, transparent);
}

.bookmark-button.has-favicon {
  border-color: color-mix(in srgb, var(--theme-accent, #a855f7) 30%, transparent);
}

.button-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.bookmark-button.is-folder .button-icon {
  width: 20px;
  height: 20px;
}

.favicon {
  width: 20px;
  height: 20px;
  object-fit: contain;
  border-radius: 4px;
}

.button-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  text-align: left;
  min-width: 0;
}
</style>