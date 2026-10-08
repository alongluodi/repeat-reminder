<script setup>
/**
 * 客户档案（卡片列表）
 *
 * 不做表格：老板在手机上只需要「这个人多久没来了 / 常做什么 / 值多少钱」，
 * 所以卡片只放这 4 个信息 + 一个距上次到店的天数。
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import BottomTab from '@/components/BottomTab.vue'
import EmptyState from '@/components/EmptyState.vue'
import { fetchCustomerList } from '@/api/customer'
import { gapText } from '@/utils/date'
import { money, maskPhone } from '@/utils/format'
import { toast } from '@/utils/toast'

const PAGE_SIZE = 12

const router = useRouter()
const keyword = ref('')
const rows = ref([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const loadingMore = ref(false)
let searchTimer = null

async function load(reset = true) {
  if (reset) {
    page.value = 1
    loading.value = true
  } else {
    loadingMore.value = true
  }
  try {
    const kw = keyword.value
    // 一个搜索框同时支持「称呼 / 手机号」：纯数字按手机号检索，否则按称呼检索
    // （后端 CrmCustomer 有 searchNameAttr / searchPhoneAttr 两个搜索器，两者是 AND 关系，
    //   所以这里只传命中的那一个，不要同时传）
    const isPhone = kw !== '' && /^\d+$/.test(kw)
    const res = await fetchCustomerList({
      page: page.value,
      limit: PAGE_SIZE,
      ...(kw ? (isPhone ? { phone: kw } : { name: kw }) : {})
    })
    const list = res?.data || []
    rows.value = reset ? list : [...rows.value, ...list]
    total.value = Number(res?.total || list.length)
  } catch (e) {
    if (reset) rows.value = []
    toast(e.message || '客户列表加载失败')
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function loadMore() {
  if (loadingMore.value || loading.value || rows.value.length >= total.value) return
  page.value += 1
  load(false)
}

function onScroll() {
  const doc = document.documentElement
  if (doc.scrollHeight - doc.scrollTop - window.innerHeight < 160) loadMore()
}

function onInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => load(true), 350)
}

onMounted(() => {
  load(true)
  window.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<template>
  <div class="page">
    <NavBar title="客户" />

    <div class="search">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <circle cx="11" cy="11" r="6" fill="none" stroke="#bbb" stroke-width="1.8" />
        <path d="M16 16l4 4" stroke="#bbb" stroke-width="1.8" stroke-linecap="round" />
      </svg>
      <input
        v-model.trim="keyword"
        class="search__input"
        type="search"
        placeholder="搜称呼 / 手机号"
        @input="onInput"
      />
      <button v-if="keyword" type="button" class="search__clear" @click="((keyword = ''), load(true))">
        清空
      </button>
    </div>

    <div class="page-body">
      <EmptyState v-if="loading" loading text="" />

      <EmptyState
        v-else-if="!rows.length"
        text="没找到客户"
        hint="换个称呼或手机号再试试"
      />

      <template v-else>
        <div class="clist">
          <article
            v-for="c in rows"
            :key="c.id"
            class="ccard"
            @click="router.push(`/customer/${c.id}`)"
          >
            <div class="ccard__avatar">{{ (c.name || '客')[0] }}</div>
            <div class="ccard__main">
              <div class="ccard__row">
                <span class="ccard__name">{{ c.name }}</span>
                <span class="ccard__gap">{{ gapText(c.last_visit_time) }}</span>
              </div>
              <div class="ccard__row ccard__row--sub">
                <span v-if="c.project_name" class="ccard__chip">{{ c.project_name }}</span>
                <span v-if="c.phone" class="t-weak">{{ maskPhone(c.phone) }}</span>
              </div>
              <div v-if="c.visits_count !== undefined" class="ccard__stats">
                到店 {{ c.visits_count }} 次 · 累计 {{ money(c.total_amount) }}
              </div>
            </div>
            <svg class="ccard__arrow" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                d="M9 5l7 7-7 7"
                fill="none"
                stroke="#ccc"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </article>
        </div>

        <div class="loading-more">
          <template v-if="loadingMore">加载中…</template>
          <template v-else-if="rows.length < total">
            <button type="button" class="load-btn" @click="loadMore">加载更多</button>
          </template>
          <template v-else>共 {{ total }} 位客户</template>
        </div>
      </template>
    </div>

    <BottomTab />
  </div>
</template>

<style scoped>
.search {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: var(--sp-2) var(--sp-2) 0;
  padding: 0 var(--sp-2);
  height: 40px;
  border-radius: 20px;
  background: var(--c-white);
  box-shadow: var(--shadow-card);
}

.search__input {
  flex: 1;
  min-width: 0;
  height: 100%;
  font-size: var(--fs-base);
}

.search__input::-webkit-search-cancel-button {
  display: none;
}

.search__clear {
  flex: none;
  color: var(--c-pink-deep);
  font-size: var(--fs-sm);
  cursor: pointer;
}

.clist {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.ccard {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2);
  border-radius: var(--r-card);
  background: var(--c-white);
  box-shadow: var(--shadow-card);
  cursor: pointer;
}

.ccard__avatar {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--c-pink);
  color: #7d4a4a;
  font-size: var(--fs-title);
  font-weight: 600;
}

.ccard__main {
  flex: 1;
  min-width: 0;
}

.ccard__row {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
}

.ccard__row--sub {
  margin-top: 2px;
}

.ccard__name {
  font-size: var(--fs-title);
  font-weight: 600;
}

.ccard__gap {
  margin-left: auto;
  flex: none;
  color: var(--c-pink-deep);
  font-size: var(--fs-sm);
}

.ccard__chip {
  padding: 1px 8px;
  border-radius: 10px;
  background: var(--c-pink-soft);
  color: #b96f6f;
  font-size: var(--fs-xs);
}

.ccard__stats {
  margin-top: 4px;
  font-size: var(--fs-sm);
  color: var(--c-text-sub);
}

.ccard__arrow {
  flex: none;
}

.load-btn {
  padding: 6px 22px;
  border-radius: var(--r-chip);
  background: var(--c-white);
  color: var(--c-text-sub);
  font-size: var(--fs-sm);
  cursor: pointer;
}
</style>
