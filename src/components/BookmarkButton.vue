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
const isLoading = ref(true)

const getCustomFavicon = () => props.customFavicons[props.bookmark.id] || null

const getDominantColor = async (url) => {
  if (!url) return props.theme.accent
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
    const data = ctx.getImageData(0, 0, 64, 64).data, colorMap = new Map()
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
      const brightness = (r * 299 + g * 587 + b * 114) / 1000
      if (brightness < 30 || brightness > 240) continue
      const key = `${Math.round(r / 32) * 32},${Math.round(g / 32) * 32},${Math.round(b / 32) * 32}`
      colorMap.set(key, (colorMap.get(key) || 0) + brightness / 255)
    }
    if (colorMap.size === 0) return props.theme.accent
    let maxWeight = 0, dominantKey = null
    for (const [key, weight] of colorMap) if (weight > maxWeight) { maxWeight = weight; dominantKey = key }
    if (dominantKey) return `rgb(${dominantKey})`
  } catch (e) {}
  return props.theme.accent
}

const bookmarkGradient = computed(() => {
  if (props.isFolder) return `linear-gradient(135deg, ${props.theme.primary}20 0%, rgba(123, 123, 123, 0.15) 100%)`
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
    isLoading.value = false
    return
  }

  try {
    const url = props.bookmark.url
    const hostname = new URL(url).hostname

    // 1. Custom favicon (check first)
    const custom = getCustomFavicon()
    if (custom) {
      const exists = await checkImageExists(custom)
      if (exists) {
        faviconUrl.value = custom
        hasFavicon.value = true
        dominantColor.value = await getDominantColor(custom)
        isLoading.value = false
        return
      }
    }

    // 2. Firefox history
    try {
      const history = await browser.history.search({ text: url, maxResults: 1, startTime: 0 })
      if (history[0]?.favIconUrl) {
        faviconUrl.value = history[0].favIconUrl
        hasFavicon.value = true
        dominantColor.value = await getDominantColor(history[0].favIconUrl)
        isLoading.value = false
        return
      }
    } catch (e) {}

    // 3. Tabs API
    try {
      const tabs = await browser.tabs.query({ url })
      if (tabs[0]?.favIconUrl) {
        faviconUrl.value = tabs[0].favIconUrl
        hasFavicon.value = true
        dominantColor.value = await getDominantColor(tabs[0].favIconUrl)
        isLoading.value = false
        return
      }
    } catch (e) {}

    // 4. Local sites
    const isLocal = url.includes('192.168.') || url.includes('localhost') || url.includes('127.') || url.startsWith('file://')
    if (isLocal) {
      for (const path of ['/favicon.ico', '/favicon.png', '/static/favicon.ico', '/assets/favicon.ico']) {
        try {
          const localUrl = new URL(path, url).href
          const exists = await checkImageExists(localUrl)
          if (exists) {
            faviconUrl.value = localUrl
            hasFavicon.value = true
            dominantColor.value = await getDominantColor(localUrl)
            isLoading.value = false
            return
          }
        } catch (e) {}
      }
    }

    // 5. External services
    if (!isLocal && !url.startsWith('file://')) {
      const googleFavicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`
      if (await checkImageExists(googleFavicon)) {
        faviconUrl.value = googleFavicon
        hasFavicon.value = true
        dominantColor.value = await getDominantColor(googleFavicon)
        isLoading.value = false
        return
      }

      const ddgFavicon = `https://icons.duckduckgo.com/ip3/${hostname}.ico`
      if (await checkImageExists(ddgFavicon)) {
        faviconUrl.value = ddgFavicon
        hasFavicon.value = true
        dominantColor.value = await getDominantColor(ddgFavicon)
        isLoading.value = false
        return
      }
    }

    // 6. Direct favicon.ico
    if (!url.startsWith('file://')) {
      try {
        const directFavicon = new URL('/favicon.ico', url).href
        if (await checkImageExists(directFavicon)) {
          faviconUrl.value = directFavicon
          hasFavicon.value = true
          dominantColor.value = await getDominantColor(directFavicon)
          isLoading.value = false
          return
        }
      } catch (e) {}
    }

    hasFavicon.value = false
    faviconUrl.value = null
    dominantColor.value = props.theme.accent
  } catch (e) {
    hasFavicon.value = false
    faviconUrl.value = null
    dominantColor.value = props.theme.accent
  } finally {
    isLoading.value = false
  }
}

const handleClick = () => { if (props.bookmark.url) browser.tabs.create({ url: props.bookmark.url }) }
const handleContextMenu = (e) => { if (!props.isFolder) emit('contextmenu', e, props.bookmark) }

// Watch for changes in customFavicons prop
watch(() => props.customFavicons, (newVal, oldVal) => {
  if (newVal[props.bookmark.id] !== oldVal?.[props.bookmark.id]) {
    getFavicon()
  }
}, { deep: true })

// Watch for theme changes
watch(() => props.theme, () => {
  if (!hasFavicon.value) {
    dominantColor.value = props.theme.accent
  }
}, { deep: true })

onMounted(getFavicon)
</script>

<template>
  <button class="bookmark-button" @click="handleClick" @contextmenu.prevent="handleContextMenu"
    :class="{ 'has-favicon': hasFavicon }"
    :style="{ background: bookmarkGradient, '--dominant-color': dominantColor, '--theme-accent': props.theme.accent }">
    <div class="button-icon">
      <img v-if="!isFolder && hasFavicon && faviconUrl" :src="faviconUrl" class="favicon" @error="hasFavicon = false"/>
      <svg v-else-if="!isFolder" width="22" height="22" viewBox="0 0 24 24" fill="none" :stroke="props.theme.accent" stroke-width="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" :stroke="props.theme.accent" stroke-width="1.5">
        <path d="M13 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v2"/>
        <path d="M19 15v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-4"/>
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
  border-color: color-mix(in srgb, var(--theme-accent, #a855f7) 50%, transparent);
}

.bookmark-button:hover::before {
  opacity: 1;
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