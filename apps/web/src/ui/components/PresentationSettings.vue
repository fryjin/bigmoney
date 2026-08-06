<script setup lang="ts">
import type {
  MotionPreference,
  PresentationPreferences,
  QualityPreference
} from '../../presentation/preferences';
import type { BuildInfo } from '../../runtime/buildInfo';
import { shortCommit } from '../../runtime/buildInfo';
import type { RuntimeHealth } from '../../runtime/runtimeHealth';

const props = defineProps<{
  preferences: PresentationPreferences;
  failedAssets: readonly string[];
  buildInfo: BuildInfo;
  runtimeHealth: RuntimeHealth | null;
}>();

const emit = defineEmits<{
  close: [];
  update: [preferences: PresentationPreferences];
}>();

const qualityOptions: readonly {
  value: QualityPreference;
  label: string;
  description: string;
}[] = [
  {
    value: 'high',
    label: '高质量',
    description: '保留完整环境装饰与城市交通。'
  },
  {
    value: 'standard',
    label: '标准',
    description: '推荐用于当前技术切片与iPad。'
  },
  {
    value: 'economy',
    label: '省电',
    description: '隐藏非必要交通并缩短部分动画。'
  }
];

const motionOptions: readonly {
  value: MotionPreference;
  label: string;
  description: string;
}[] = [
  {
    value: 'full',
    label: '完整动效',
    description: '使用完整投骰、移动与结算动画。'
  },
  {
    value: 'reduced',
    label: '减少动态',
    description: '保留状态反馈，同时显著缩短动画。'
  }
];

function updateQuality(quality: QualityPreference): void {
  emit('update', { ...props.preferences, quality });
}

function updateMotion(motion: MotionPreference): void {
  emit('update', { ...props.preferences, motion });
}
</script>

<template>
  <section class="presentation-settings" role="dialog" aria-modal="false" aria-label="显示设置">
    <header>
      <div>
        <span>Presentation</span>
        <h2>显示与动效</h2>
      </div>
      <button type="button" aria-label="关闭显示设置" @click="emit('close')">×</button>
    </header>

    <div class="setting-group">
      <div class="setting-title">
        <strong>画面质量</strong>
        <small>切换后立即作用于非必要场景元素。</small>
      </div>
      <button
        v-for="option in qualityOptions"
        :key="option.value"
        type="button"
        class="setting-option"
        :class="{ selected: preferences.quality === option.value }"
        @click="updateQuality(option.value)"
      >
        <span class="selection-dot"></span>
        <span>
          <strong>{{ option.label }}</strong>
          <small>{{ option.description }}</small>
        </span>
      </button>
    </div>

    <div class="setting-group">
      <div class="setting-title">
        <strong>动画强度</strong>
        <small>不会改变任何规则结果或结算顺序。</small>
      </div>
      <button
        v-for="option in motionOptions"
        :key="option.value"
        type="button"
        class="setting-option"
        :class="{ selected: preferences.motion === option.value }"
        @click="updateMotion(option.value)"
      >
        <span class="selection-dot"></span>
        <span>
          <strong>{{ option.label }}</strong>
          <small>{{ option.description }}</small>
        </span>
      </button>
    </div>

    <div class="setting-group diagnostics">
      <div class="setting-title">
        <strong>部署诊断</strong>
        <small>用于 Cloudflare Pages 与 iPad 真机验收，不包含账号或用户数据。</small>
      </div>
      <dl class="diagnostic-grid">
        <div><dt>版本</dt><dd>{{ buildInfo.version }}</dd></div>
        <div><dt>渠道</dt><dd>{{ buildInfo.channel }}</dd></div>
        <div><dt>提交</dt><dd>{{ shortCommit(buildInfo.commit) }}</dd></div>
        <div><dt>网络</dt><dd>{{ runtimeHealth?.online ? '在线' : '离线' }}</dd></div>
        <div><dt>Service Worker</dt><dd>{{ runtimeHealth?.serviceWorkerControlled ? '已接管' : runtimeHealth?.serviceWorkerSupported ? '待接管' : '不支持' }}</dd></div>
        <div><dt>IndexedDB</dt><dd>{{ runtimeHealth?.indexedDbSupported ? '可用' : '不可用' }}</dd></div>
        <div><dt>本地设置</dt><dd>{{ runtimeHealth?.localStorageAvailable ? '可用' : '不可用' }}</dd></div>
        <div><dt>显示模式</dt><dd>{{ runtimeHealth?.standalone ? '主屏幕应用' : '浏览器' }}</dd></div>
        <div><dt>视口</dt><dd>{{ runtimeHealth?.viewport ?? '检测中' }}</dd></div>
      </dl>
    </div>

    <div class="asset-health" :class="{ warning: failedAssets.length > 0 }">
      <span class="health-dot"></span>
      <div>
        <strong>{{ failedAssets.length ? '部分视觉资源加载失败' : '视觉资源接口正常' }}</strong>
        <small v-if="failedAssets.length">{{ failedAssets.join('、') }}</small>
        <small v-else>当前技术切片资源均已进入统一注册表。</small>
      </div>
    </div>
  </section>
</template>

<style scoped>
.presentation-settings {
  position: absolute;
  z-index: 70;
  top: max(68px, calc(env(safe-area-inset-top) + 54px));
  right: max(22px, env(safe-area-inset-right));
  width: min(360px, calc(100vw - 44px));
  max-height: calc(100% - 110px);
  padding: 18px;
  overflow-y: auto;
  border: 1px solid rgba(34, 52, 58, 0.12);
  border-radius: 24px;
  background: rgba(251, 253, 249, 0.96);
  box-shadow: 0 24px 80px rgba(23, 43, 50, 0.22);
  color: #22343a;
  backdrop-filter: blur(22px) saturate(1.08);
  -webkit-backdrop-filter: blur(22px) saturate(1.08);
}

header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

header span {
  color: #6c7d80;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

h2 {
  margin: 3px 0 0;
  font-size: 22px;
  letter-spacing: -0.04em;
}

header button {
  display: grid;
  width: 34px;
  height: 34px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 12px;
  background: rgba(34, 52, 58, 0.08);
  cursor: pointer;
  font-size: 22px;
}

.setting-group {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}

.setting-title {
  display: grid;
  gap: 2px;
  margin-bottom: 2px;
}

.setting-title strong {
  font-size: 14px;
}

.setting-title small,
.setting-option small,
.asset-health small {
  color: #66787c;
  font-size: 11px;
  line-height: 1.45;
}

.setting-option {
  display: grid;
  grid-template-columns: 18px 1fr;
  gap: 10px;
  width: 100%;
  padding: 11px 12px;
  border: 1px solid rgba(34, 52, 58, 0.09);
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.68);
  cursor: pointer;
  text-align: left;
}

.setting-option > span:last-child {
  display: grid;
  gap: 2px;
}

.setting-option.selected {
  border-color: rgba(62, 139, 124, 0.45);
  background: rgba(214, 237, 229, 0.78);
  box-shadow: inset 0 0 0 1px rgba(62, 139, 124, 0.12);
}

.selection-dot {
  width: 14px;
  height: 14px;
  margin-top: 2px;
  border: 2px solid #819093;
  border-radius: 50%;
}

.setting-option.selected .selection-dot {
  border: 4px solid #3e8b7c;
  background: #fff;
}

.asset-health {
  display: grid;
  grid-template-columns: 10px 1fr;
  gap: 10px;
  margin-top: 18px;
  padding: 12px;
  border-radius: 15px;
  background: rgba(214, 237, 229, 0.56);
}

.asset-health > div {
  display: grid;
  gap: 2px;
}

.health-dot {
  width: 9px;
  height: 9px;
  margin-top: 4px;
  border-radius: 50%;
  background: #4a9a7f;
  box-shadow: 0 0 0 4px rgba(74, 154, 127, 0.14);
}

.asset-health.warning {
  background: rgba(247, 223, 192, 0.72);
}

.asset-health.warning .health-dot {
  background: #c47737;
  box-shadow: 0 0 0 4px rgba(196, 119, 55, 0.14);
}

@media (max-height: 700px) {
  .presentation-settings {
    top: 58px;
    max-height: calc(100% - 82px);
  }
}

.diagnostics {
  padding-top: 4px;
}

.diagnostic-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px 12px;
  margin: 2px 0 0;
  padding: 12px;
  border: 1px solid rgba(34, 52, 58, 0.08);
  border-radius: 15px;
  background: rgba(236, 243, 239, 0.72);
}

.diagnostic-grid div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.diagnostic-grid dt {
  color: #6d7d80;
  font-size: 10px;
}

.diagnostic-grid dd {
  max-width: 120px;
  margin: 0;
  overflow: hidden;
  color: #28423f;
  font-size: 10px;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

</style>
